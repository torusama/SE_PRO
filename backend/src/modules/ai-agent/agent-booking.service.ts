import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CemeteryServicesService } from '../cemetery-services/cemetery-services.service';
import { ReservationsService } from '../reservations/reservations.service';
import { RemindersService } from '../reminders/reminders.service';
import { ScheduleService } from '../schedule/schedule.service';
import { MemorialEmailDraftService } from './memorial-email-draft.service';
import { AgentPlan } from './agent-planner';
import { AgentClientActionDto } from './dto/chat.dto';
import {
  AgentPendingAction,
  AgentUiDirective,
  RecommendationOption,
} from './types/agent-response.types';

export interface OwnedPlotContext {
  plotId: number;
  plotCode: string;
  zoneName: string;
  direction: string | null;
  areaSqm: number;
  plotType: string;
}

interface ServiceType {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  category: string;
}

interface ProfileSummary {
  fullName: string | null;
  phone: string | null;
  email: string;
}

interface PlotSelection {
  plotIds: number[];
  plotCodes: string[];
}

export interface AgentBookingTurn {
  handled: true;
  intent:
    | 'plot_request'
    | 'service_booking'
    | 'appointment_booking'
    | 'memorial_reminder';
  assistantMessage: string;
  pendingAction?: AgentPendingAction;
  suggestedServices?: ServiceType[];
  quickReplies?: Array<{
    id: string;
    label: string;
    message: string;
    emphasis?: 'normal' | 'strong';
  }>;
  uiDirective?: AgentUiDirective;
}

@Injectable()
export class AgentBookingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly reservations: ReservationsService,
    private readonly cemeteryServices: CemeteryServicesService,
    private readonly reminders: RemindersService,
    private readonly schedule: ScheduleService,
    private readonly memorialDrafts: MemorialEmailDraftService,
  ) {}

  async loadPendingAction(
    conversationId: number | null,
  ): Promise<AgentPendingAction | undefined> {
    if (!conversationId) return undefined;
    const row = await this.database.queryOne<{
      pendingAction: AgentPendingAction | null;
    }>(
      `SELECT extracted_data->'pendingAction' AS "pendingAction"
       FROM ai_messages
       WHERE conversation_id = $1 AND role = 'assistant'
       ORDER BY created_at DESC, message_id DESC
       LIMIT 1`,
      [conversationId],
    );
    return this.isPendingAction(row?.pendingAction)
      ? row?.pendingAction
      : undefined;
  }

  async handleTurn(input: {
    conversationId: number | null;
    userId: number | null;
    plan: AgentPlan;
    clientAction?: AgentClientActionDto;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn | null> {
    const bookingAction =
      input.clientAction ||
      input.pendingAction ||
      [
        'prepare_plot_request',
        'prepare_service_order',
        'prepare_appointment',
        'prepare_memorial_reminder',
        'confirm_pending_action',
        'cancel_pending_action',
      ].includes(input.plan.action);
    if (!bookingAction) return null;

    if (!input.userId) {
      return {
        handled: true,
        intent:
          input.pendingAction?.kind === 'appointment' ||
          input.plan.intent === 'appointment_booking'
            ? 'appointment_booking'
            : input.pendingAction?.kind === 'memorial_reminder' ||
                input.plan.intent === 'memorial_reminder'
              ? 'memorial_reminder'
              :
          input.clientAction?.type === 'START_SERVICE_ORDER' ||
          input.pendingAction?.kind === 'service_order' ||
          input.plan.intent === 'service_booking'
            ? 'service_booking'
            : 'plot_request',
        assistantMessage:
          'Để mình thay bạn tạo yêu cầu và dùng đúng thông tin hồ sơ, bạn vui lòng đăng nhập tài khoản khách hàng rồi tiếp tục tại cuộc trò chuyện này nhé.',
      };
    }
    const authenticatedInput = { ...input, userId: input.userId };

    if (input.plan.action === 'cancel_pending_action') {
      return {
        handled: true,
        intent:
          input.pendingAction?.kind === 'appointment'
            ? 'appointment_booking'
            : input.pendingAction?.kind === 'memorial_reminder'
              ? 'memorial_reminder'
              : input.pendingAction?.kind === 'service_order'
            ? 'service_booking'
            : 'plot_request',
        assistantMessage: input.pendingAction
          ? 'Mình đã hủy yêu cầu đang chuẩn bị. Chưa có đơn, lịch hẹn hoặc lịch nhắc nào được tạo.'
          : 'Hiện không có yêu cầu nào đang chờ xác nhận để hủy.',
      };
    }

    if (input.plan.action === 'confirm_pending_action') {
      return this.confirm(authenticatedInput.userId, input.pendingAction);
    }

    if (
      input.pendingAction?.kind === 'appointment' ||
      input.plan.action === 'prepare_appointment'
    ) {
      return this.prepareAppointment(authenticatedInput);
    }

    if (
      input.pendingAction?.kind === 'memorial_reminder' ||
      input.plan.action === 'prepare_memorial_reminder'
    ) {
      return this.prepareMemorialReminder(authenticatedInput);
    }

    if (
      input.clientAction?.type === 'START_SERVICE_ORDER' ||
      input.pendingAction?.kind === 'service_order' ||
      input.plan.action === 'prepare_service_order'
    ) {
      return this.prepareServiceOrder(authenticatedInput);
    }

    return this.preparePlotRequest(authenticatedInput);
  }

  private async preparePlotRequest(input: {
    conversationId: number | null;
    userId: number;
    plan: AgentPlan;
    clientAction?: AgentClientActionDto;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const existing =
      input.pendingAction?.kind === 'plot_request'
        ? input.pendingAction
        : undefined;
    const selected = await this.resolveRecommendedOption(
      input.conversationId,
      input.clientAction,
      input.plan.requirements.selectedPlotCode,
    );
    const pending: AgentPendingAction = {
      kind: 'plot_request',
      stage: 'collecting',
      plotIds: selected?.plotIds ?? existing?.plotIds ?? [],
      plotCodes: selected?.plotCodes ?? existing?.plotCodes ?? [],
      requestType: input.plan.requirements.requestType ?? existing?.requestType,
      note: input.plan.requirements.note ?? existing?.note,
    };

    if (!pending.plotIds.length) {
      return {
        handled: true,
        intent: 'plot_request',
        assistantMessage:
          'Mình chưa xác định được phương án lô nào bạn muốn đặt yêu cầu. Bạn hãy chọn “Đặt yêu cầu” ngay trên thẻ lô phù hợp, hoặc gửi chính xác mã lô để mình kiểm tra nhé.',
      };
    }

    const plots = await this.validateAvailablePlots(
      pending.plotIds,
      pending.plotCodes,
    );
    pending.plotCodes = plots.map((plot) => plot.plotCode);
    if (!pending.requestType) {
      const primaryCode = pending.plotCodes[0];
      return {
        handled: true,
        intent: 'plot_request',
        pendingAction: pending,
        assistantMessage: `Mình đã ghi nhận phương án **${pending.plotCodes.join(', ')}** và sẽ dùng thông tin có sẵn trong tài khoản của bạn. Bạn muốn **giữ chỗ tạm thời** hay **gửi yêu cầu mua lô**?`,
        quickReplies: [
          {
            id: 'plot-request-reserve',
            label: 'Giữ chỗ tạm thời',
            message: primaryCode
              ? `Mình muốn giữ chỗ tạm thời cho lô ${primaryCode}.`
              : 'Mình muốn giữ chỗ tạm thời cho phương án này.',
            emphasis: 'strong',
          },
          {
            id: 'plot-request-purchase',
            label: 'Gửi yêu cầu mua lô',
            message: primaryCode
              ? `Mình muốn gửi yêu cầu mua lô ${primaryCode}.`
              : 'Mình muốn gửi yêu cầu mua lô cho phương án này.',
            emphasis: 'strong',
          },
        ],
      };
    }

    pending.stage = 'awaiting_confirmation';
    const profile = await this.profile(input.userId);
    const total = plots.reduce((sum, plot) => sum + plot.price, 0);
    pending.quotedTotal = total;
    const requestLabel =
      pending.requestType === 'reserve'
        ? 'Giữ chỗ tạm thời'
        : 'Gửi yêu cầu mua';
    return {
      handled: true,
      intent: 'plot_request',
      pendingAction: pending,
      assistantMessage: [
        'Mình đã chuẩn bị yêu cầu như sau:',
        `- Hình thức: **${requestLabel}**`,
        `- Lô: **${pending.plotCodes.join(', ')}**`,
        `- Tổng giá niêm yết: **${total.toLocaleString('vi-VN')} VND**`,
        `- Người yêu cầu: **${profile.fullName || profile.email}** (lấy từ tài khoản hiện tại)`,
        '',
        'Bạn xác nhận để mình gửi yêu cầu này không? Chỉ khi bạn trả lời xác nhận thì hệ thống mới tạo yêu cầu.',
      ].join('\n'),
    };
  }

  private async prepareServiceOrder(input: {
    userId: number;
    plan: AgentPlan;
    clientAction?: AgentClientActionDto;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const existing =
      input.pendingAction?.kind === 'service_order'
        ? input.pendingAction
        : undefined;
    const service = await this.resolveServiceType(
      input.clientAction?.serviceTypeId ??
        input.plan.requirements.serviceTypeId ??
        existing?.serviceTypeId,
      input.clientAction?.serviceName ??
        input.plan.requirements.serviceQuery ??
        existing?.serviceName,
    );
    const ownedPlots = await this.getOwnedPlots(input.userId);

    if (!ownedPlots.length) {
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage:
          'Tài khoản của bạn hiện chưa có lô nào thuộc quyền sử dụng nên mình chưa thể tạo đơn dịch vụ gắn với phần mộ. Nếu bạn muốn, mình có thể tư vấn một lô phù hợp trước hoặc giới thiệu quy trình mua lô.',
        quickReplies: [
          {
            id: 'service-no-owned-plot-consultation',
            label: 'Tư vấn thêm về lô đất phù hợp',
            message:
              'Mình chưa sở hữu lô nào. Hãy tư vấn cho mình các lô đất phù hợp để sau này có thể sử dụng dịch vụ chăm sóc.',
            emphasis: 'strong',
          },
        ],
      };
    }

    const requestedCode =
      input.plan.requirements.selectedPlotCode ?? existing?.plotCode;
    const selectedPlot =
      ownedPlots.find(
        (plot) =>
          plot.plotId === existing?.plotId ||
          this.normalize(plot.plotCode) === this.normalize(requestedCode ?? ''),
      ) ?? (ownedPlots.length === 1 ? ownedPlots[0] : undefined);
    const pending: AgentPendingAction = {
      kind: 'service_order',
      stage: 'collecting',
      serviceTypeId: service?.id ?? existing?.serviceTypeId,
      serviceName: service?.name ?? existing?.serviceName,
      plotId: selectedPlot?.plotId,
      plotCode: selectedPlot?.plotCode,
      requestedDate:
        input.plan.requirements.requestedDate ?? existing?.requestedDate,
      quotedPrice: service?.basePrice ?? existing?.quotedPrice,
      serviceUnit: service?.unit ?? existing?.serviceUnit,
      note: input.plan.requirements.note ?? existing?.note,
    };

    if (!service) {
      const services = await this.activeServices();
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: pending,
        suggestedServices: services,
        assistantMessage:
          'Bạn muốn đặt dịch vụ nào? Mình có thể hỗ trợ các dịch vụ đang hoạt động bên dưới; bạn chỉ cần nói tên dịch vụ mong muốn.',
      };
    }
    if (!selectedPlot) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: pending,
        assistantMessage: `Tài khoản của bạn đang có nhiều lô: **${ownedPlots.map((plot) => plot.plotCode).join(', ')}**. Bạn muốn đặt dịch vụ **${service.name}** cho lô nào?`,
        quickReplies: ownedPlots.slice(0, 6).map((plot) => ({
          id: `service-plot-${plot.plotId}`,
          label: plot.plotCode,
          message: `Mình muốn đặt dịch vụ ${service.name} cho lô ${plot.plotCode}.`,
          emphasis: 'strong' as const,
        })),
      };
    }
    if (
      pending.requestedDate &&
      !this.isValidFutureDate(pending.requestedDate)
    ) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: {
          ...pending,
          requestedDate: undefined,
        },
        assistantMessage: `Ngày **${pending.requestedDate}** không hợp lệ hoặc đã qua. Bạn cho mình một ngày khác từ hôm nay trở đi nhé; mình cần ghi nhận ngày mong muốn trước khi chuyển sang bước xác nhận và thanh toán.`,
      };
    }

    if (!pending.requestedDate) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: pending,
        assistantMessage: [
          `Mình đã ghi nhận dịch vụ **${service.name}** cho lô **${selectedPlot.plotCode}**.`,
          '',
          '**Bạn muốn dịch vụ được thực hiện vào ngày nào?** Bạn có thể nói “ngày mai”, “3 ngày nữa” hoặc gửi ngày cụ thể. Mình sẽ ghi nhận ngày mong muốn trước khi chuyển sang bước xác nhận và thanh toán.',
        ].join('\n'),
        quickReplies: [
          {
            id: 'service-date-tomorrow',
            label: 'Ngày mai',
            message: 'Mình muốn thực hiện dịch vụ vào ngày mai.',
            emphasis: 'strong',
          },
          {
            id: 'service-date-three-days',
            label: '3 ngày nữa',
            message: 'Mình muốn thực hiện dịch vụ sau 3 ngày nữa.',
          },
        ],
      };
    }

    pending.stage = 'awaiting_confirmation';
    const profile = await this.profile(input.userId);
    return {
      handled: true,
      intent: 'service_booking',
      pendingAction: pending,
      assistantMessage: [
        'Mình đã chuẩn bị đơn dịch vụ:',
        `- Dịch vụ: **${service.name}**`,
        `- Lô áp dụng: **${selectedPlot.plotCode}**`,
        `- Ngày mong muốn: **${pending.requestedDate}**`,
        `- Chi phí dự kiến: **${service.basePrice.toLocaleString('vi-VN')} VND/${service.unit}**`,
        `- Khách hàng: **${profile.fullName || profile.email}** (lấy từ tài khoản hiện tại)`,
        '',
        'Bạn xác nhận để mình gửi đơn dịch vụ này không? Sau khi đơn được xác nhận, panel dịch vụ bên phải sẽ mở bước thanh toán; khi thanh toán được ghi nhận, panel sẽ tự chuyển sang lịch với ngày bạn vừa chọn để bạn kiểm tra hoặc điều chỉnh lần cuối.',
      ].join('\n'),
      quickReplies: [
        {
          id: 'service-confirm-order',
          label: 'Xác nhận đặt dịch vụ',
          message: 'Mình xác nhận đặt dịch vụ này.',
          emphasis: 'strong',
        },
        {
          id: 'service-cancel-order',
          label: 'Chưa đặt lúc này',
          message: 'Mình chưa muốn đặt dịch vụ này, hãy hủy bước xác nhận.',
        },
      ],
    };
  }

  private async prepareAppointment(input: {
    userId: number;
    plan: AgentPlan;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const existing =
      input.pendingAction?.kind === 'appointment'
        ? input.pendingAction
        : undefined;
    const startTime =
      input.plan.requirements.appointmentStartTime ?? existing?.startTime;
    const pending: AgentPendingAction = {
      kind: 'appointment',
      stage: 'collecting',
      appointmentDate:
        input.plan.requirements.appointmentDate ?? existing?.appointmentDate,
      startTime,
      endTime:
        input.plan.requirements.appointmentEndTime ??
        existing?.endTime ??
        (startTime ? this.addMinutes(startTime, 60) : undefined),
      topic:
        input.plan.requirements.appointmentTopic ??
        existing?.topic ??
        'Tham quan và tư vấn lô đất',
      note: input.plan.requirements.note ?? existing?.note,
      selectedPlotCode:
        input.plan.requirements.selectedPlotCode ?? existing?.selectedPlotCode,
    };

    if (!pending.appointmentDate || !this.isValidFutureDate(pending.appointmentDate)) {
      pending.appointmentDate = undefined;
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: pending,
        uiDirective: { type: 'OPEN_APPOINTMENT_CALENDAR' },
        assistantMessage:
          'Bạn muốn gặp ban quản lý vào ngày nào? Mình sẽ mở lịch để bạn chọn ngày phù hợp.',
      };
    }
    if (!pending.startTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(pending.startTime)) {
      pending.startTime = undefined;
      pending.endTime = undefined;
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: pending,
        uiDirective: {
          type: 'OPEN_APPOINTMENT_CALENDAR',
          appointmentDate: pending.appointmentDate,
        },
        assistantMessage: `Bạn muốn gặp ban quản lý lúc mấy giờ ngày **${pending.appointmentDate}**?`,
      };
    }
    if (
      !pending.endTime ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(pending.endTime) ||
      pending.endTime <= pending.startTime
    ) {
      pending.endTime = this.addMinutes(pending.startTime, 60);
    }
    pending.stage = 'awaiting_confirmation';
    const subject =
      pending.selectedPlotCode &&
      !this.normalize(pending.topic ?? '').includes(
        this.normalize(pending.selectedPlotCode),
      )
        ? `${pending.topic} · Lô ${pending.selectedPlotCode}`
        : pending.topic;
    return {
      handled: true,
      intent: 'appointment_booking',
      pendingAction: pending,
      uiDirective: {
        type: 'OPEN_APPOINTMENT_CALENDAR',
        appointmentDate: pending.appointmentDate,
      },
      assistantMessage: [
        'Mình đã chuẩn bị lịch hẹn với ban quản lý:',
        `- Ngày: **${pending.appointmentDate}**`,
        `- Thời gian: **${pending.startTime}–${pending.endTime}**`,
        `- Nội dung: **${subject}**`,
        '',
        'Bạn xác nhận để mình gửi yêu cầu đặt lịch này không?',
      ].join('\n'),
    };
  }

  private async prepareMemorialReminder(input: {
    userId: number;
    plan: AgentPlan;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const existing =
      input.pendingAction?.kind === 'memorial_reminder'
        ? input.pendingAction
        : undefined;
    const profile = await this.profile(input.userId);
    const reminderDate = input.plan.requirements.reminderDate;
    const parsedDate = reminderDate ? this.parseIsoDate(reminderDate) : null;
    const notifyEmails = [
      ...(input.plan.requirements.reminderNotifyEmails ?? []),
      ...(existing?.notifyEmails ?? []),
      ...(profile.email ? [profile.email] : []),
    ]
      .map((email) => email.trim().toLowerCase())
      .filter((email, index, values) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        values.indexOf(email) === index,
      )
      .slice(0, 10);
    const recurring =
      input.plan.requirements.reminderRecurring ?? existing?.isRecurring ?? true;
    const title =
      input.plan.requirements.reminderTitle ??
      existing?.title ??
      'Ngày tưởng niệm người thân';
    const calendarType =
      input.plan.requirements.reminderCalendarType ??
      existing?.calendarType ??
      'solar';
    const dateLabel = recurring
      ? parsedDate
        ? `${parsedDate.day}/${parsedDate.month} hằng năm (${calendarType === 'lunar' ? 'âm lịch' : 'dương lịch'})`
        : 'chưa xác định'
      : reminderDate ?? existing?.specificDate ?? 'chưa xác định';
    const fallbackDescription = this.defaultMemorialMessage(
      profile.fullName,
      title,
      dateLabel,
    );
    const description =
      input.plan.requirements.reminderDescription ??
      existing?.description ??
      (parsedDate
        ? await this.memorialDrafts.generate({
            customerName: profile.fullName,
            title,
            dateLabel,
            fallback: fallbackDescription,
          })
        : fallbackDescription);
    const pending: AgentPendingAction = {
      kind: 'memorial_reminder',
      stage: 'collecting',
      title,
      description,
      specificDate: recurring ? undefined : reminderDate ?? existing?.specificDate,
      remindMonth: parsedDate?.month ?? existing?.remindMonth,
      remindDay: parsedDate?.day ?? existing?.remindDay,
      isRecurring: recurring,
      calendarType,
      notifyDaysBefore:
        input.plan.requirements.reminderNotifyDaysBefore ??
        existing?.notifyDaysBefore ??
        3,
      notifyEmails,
    };

    if (
      (!pending.isRecurring &&
        (!pending.specificDate || !this.isValidFutureDate(pending.specificDate))) ||
      (pending.isRecurring && (!pending.remindMonth || !pending.remindDay))
    ) {
      return {
        handled: true,
        intent: 'memorial_reminder',
        pendingAction: pending,
        uiDirective: { type: 'OPEN_REMINDER_CALENDAR' },
        assistantMessage:
          'Bạn muốn nhắc vào ngày nào? Bạn có thể nói rõ ngày dương lịch hoặc âm lịch và đây là lịch hằng năm hay chỉ nhắc một lần.',
      };
    }
    if (!pending.notifyEmails.length) {
      return {
        handled: true,
        intent: 'memorial_reminder',
        pendingAction: pending,
        uiDirective: { type: 'OPEN_REMINDER_CALENDAR' },
        assistantMessage:
          'Bạn muốn gửi lời nhắc tưởng niệm tới địa chỉ email nào?',
      };
    }
    pending.stage = 'awaiting_confirmation';
    const confirmedDateLabel = pending.isRecurring
      ? `${pending.remindDay}/${pending.remindMonth} hằng năm (${pending.calendarType === 'lunar' ? 'âm lịch' : 'dương lịch'})`
      : pending.specificDate;
    return {
      handled: true,
      intent: 'memorial_reminder',
      pendingAction: pending,
      uiDirective: {
        type: 'OPEN_REMINDER_CALENDAR',
        reminderDate: pending.specificDate,
      },
      assistantMessage: [
        'Mình đã soạn lịch nhắc tưởng niệm:',
        `- Sự kiện: **${pending.title}**`,
        `- Ngày nhắc: **${confirmedDateLabel}**`,
        `- Gửi trước: **${pending.notifyDaysBefore} ngày**`,
        `- Người nhận: **${pending.notifyEmails.join(', ')}**`,
        '',
        pending.description ?? '',
        '',
        'Bạn xác nhận để mình lưu lịch và dùng nội dung trên cho email nhắc không?',
      ].join('\n'),
    };
  }

  private async confirm(
    userId: number,
    pending?: AgentPendingAction,
  ): Promise<AgentBookingTurn> {
    if (!pending || pending.stage !== 'awaiting_confirmation') {
      return {
        handled: true,
        intent:
          pending?.kind === 'appointment'
            ? 'appointment_booking'
            : pending?.kind === 'memorial_reminder'
              ? 'memorial_reminder'
              : pending?.kind === 'service_order'
                ? 'service_booking'
                : 'plot_request',
        pendingAction: pending,
        assistantMessage:
          'Yêu cầu vẫn còn thiếu thông tin nên mình chưa thể gửi. Bạn trả lời câu hỏi gần nhất để mình hoàn tất trước nhé.',
      };
    }

    if (pending.kind === 'appointment') {
      if (
        !pending.appointmentDate ||
        !pending.startTime ||
        !pending.endTime ||
        !this.isValidFutureDate(pending.appointmentDate)
      ) {
        throw new BadRequestException('Thông tin lịch hẹn chưa đầy đủ');
      }
      const baseTopic = pending.topic ?? 'Tham quan và tư vấn lô đất';
      const topic =
        pending.selectedPlotCode &&
        !this.normalize(baseTopic).includes(
          this.normalize(pending.selectedPlotCode),
        )
          ? `${baseTopic} · Lô ${pending.selectedPlotCode}`
          : baseTopic;
      const result = await this.schedule.bookAppointment(userId, {
        appointmentDate: pending.appointmentDate,
        startTime: pending.startTime,
        endTime: pending.endTime,
        note: [topic, pending.note].filter(Boolean).join(' — '),
      });
      const id = this.resultId(result);
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage: `Đã gửi yêu cầu đặt lịch${id ? ` **#${id}**` : ''} với ban quản lý vào **${pending.startTime}–${pending.endTime}, ngày ${pending.appointmentDate}**. Lịch đang chờ ban quản lý xác nhận.`,
        uiDirective: {
          type: 'OPEN_APPOINTMENT_CALENDAR',
          appointmentId: id,
          appointmentDate: pending.appointmentDate,
        },
      };
    }

    if (pending.kind === 'memorial_reminder') {
      if (
        !pending.title ||
        !pending.description ||
        !pending.notifyEmails.length ||
        (pending.isRecurring && (!pending.remindMonth || !pending.remindDay)) ||
        (!pending.isRecurring && !pending.specificDate)
      ) {
        throw new BadRequestException('Thông tin lịch nhắc chưa đầy đủ');
      }
      const result = await this.reminders.create(userId, {
        title: pending.title,
        description: pending.description,
        reminderType: 'memorial',
        isRecurring: pending.isRecurring,
        calendarType: pending.calendarType,
        remindMonth: pending.isRecurring ? pending.remindMonth : undefined,
        remindDay: pending.isRecurring ? pending.remindDay : undefined,
        lunarMonth:
          pending.isRecurring && pending.calendarType === 'lunar'
            ? pending.remindMonth
            : undefined,
        lunarDay:
          pending.isRecurring && pending.calendarType === 'lunar'
            ? pending.remindDay
            : undefined,
        specificDate: pending.isRecurring ? undefined : pending.specificDate,
        notifyDaysBefore: pending.notifyDaysBefore,
        notifyEmail: true,
        notifyEmails: pending.notifyEmails,
      });
      const id = this.resultId(result);
      const reminderDate = pending.isRecurring
        ? undefined
        : pending.specificDate;
      return {
        handled: true,
        intent: 'memorial_reminder',
        assistantMessage: `Đã lưu lịch nhắc${id ? ` **#${id}**` : ''} **${pending.title}**. Hệ thống sẽ gửi thông báo và email tới **${pending.notifyEmails.join(', ')}** trước ${pending.notifyDaysBefore} ngày.`,
        uiDirective: {
          type: 'OPEN_REMINDER_CALENDAR',
          reminderId: id,
          reminderDate,
        },
      };
    }

    if (pending.kind === 'plot_request') {
      if (!pending.requestType) {
        throw new BadRequestException('Reservation type is missing');
      }
      const plots = await this.validateAvailablePlots(
        pending.plotIds,
        pending.plotCodes,
      );
      const currentTotal = plots.reduce((sum, plot) => sum + plot.price, 0);
      if (
        pending.quotedTotal === undefined ||
        Math.abs(currentTotal - pending.quotedTotal) >= 0.01
      ) {
        const previousTotal = pending.quotedTotal;
        const updatedPending: AgentPendingAction = {
          ...pending,
          quotedTotal: currentTotal,
        };
        return {
          handled: true,
          intent: 'plot_request',
          pendingAction: updatedPending,
          assistantMessage: [
            previousTotal === undefined
              ? 'Mình cần bạn xác nhận lại giá hiện tại trước khi gửi yêu cầu.'
              : `Giá niêm yết của phương án đã thay đổi từ **${previousTotal.toLocaleString('vi-VN')} VND** thành **${currentTotal.toLocaleString('vi-VN')} VND**.`,
            `- Lô: **${pending.plotCodes.join(', ')}**`,
            `- Tổng giá mới: **${currentTotal.toLocaleString('vi-VN')} VND**`,
            '',
            'Bạn có đồng ý với tổng giá mới để mình gửi yêu cầu không?',
          ].join('\n'),
        };
      }
      const result = await this.reservations.create(
        userId,
        {
          type: pending.requestType,
          plotIds: pending.plotIds,
          note:
            pending.note ??
            'Yêu cầu được Trợ lý AI thiết lập theo xác nhận của khách hàng',
        },
        false,
        currentTotal,
      );
      const id = this.resultId(result);
      return {
        handled: true,
        intent: 'plot_request',
        assistantMessage: `Đã gửi yêu cầu ${pending.requestType === 'reserve' ? 'giữ chỗ' : 'mua lô'}${id ? ` **#${id}**` : ''} cho **${pending.plotCodes.join(', ')}**. Bạn có thể theo dõi trạng thái trong mục yêu cầu của tài khoản. Nếu bạn muốn, mình có thể tư vấn thêm lô khác, dịch vụ chăm sóc hoặc giải thích bước tiếp theo ngay bây giờ.`,
        quickReplies: [
          {
            id: 'after-plot-request-other-options',
            label: 'Tư vấn thêm lô khác',
            message:
              'Gợi ý cho mình thêm vài lô khác phù hợp với tiêu chí hiện tại nhé.',
            emphasis: 'strong',
          },
          {
            id: 'after-plot-request-services',
            label: 'Xem dịch vụ chăm sóc',
            message: 'Cho mình xem các dịch vụ chăm sóc hiện có.',
          },
          {
            id: 'after-plot-request-process',
            label: 'Hỏi bước tiếp theo',
            message: 'Giải thích giúp mình bước tiếp theo sau khi đã gửi yêu cầu.',
          },
        ],
      };
    }

    if (!pending.serviceTypeId || !pending.plotId) {
      throw new BadRequestException('Service order information is incomplete');
    }
    if (!pending.requestedDate) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: {
          ...pending,
          stage: 'collecting',
        },
        assistantMessage:
          'Mình còn thiếu ngày bạn muốn thực hiện dịch vụ. Bạn cho mình một ngày mong muốn trước khi mình tạo đơn nhé.',
      };
    }
    if (
      pending.requestedDate &&
      !this.isValidFutureDate(pending.requestedDate)
    ) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: {
          ...pending,
          stage: 'collecting',
          requestedDate: undefined,
        },
        assistantMessage:
          'Ngày thực hiện đã qua hoặc không còn hợp lệ. Bạn chọn lại một ngày từ hôm nay trở đi để mình tiếp tục tạo đơn dịch vụ nhé.',
      };
    }
    const currentService = await this.resolveServiceType(pending.serviceTypeId);
    if (!currentService) {
      throw new BadRequestException(
        'Dịch vụ này hiện không còn hoạt động. Mình có thể giới thiệu các dịch vụ đang nhận đơn để bạn chọn phương án khác.',
      );
    }
    if (
      pending.quotedPrice === undefined ||
      Math.abs(currentService.basePrice - pending.quotedPrice) >= 0.01
    ) {
      const previousPrice = pending.quotedPrice;
      const updatedPending: AgentPendingAction = {
        ...pending,
        serviceName: currentService.name,
        quotedPrice: currentService.basePrice,
        serviceUnit: currentService.unit,
      };
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: updatedPending,
        assistantMessage: [
          previousPrice === undefined
            ? 'Mình cần bạn xác nhận lại mức giá hiện tại trước khi gửi đơn dịch vụ.'
            : `Giá dịch vụ **${currentService.name}** đã thay đổi từ **${previousPrice.toLocaleString('vi-VN')} VND** thành **${currentService.basePrice.toLocaleString('vi-VN')} VND/${currentService.unit}**.`,
          `- Lô áp dụng: **${pending.plotCode}**`,
          `- Ngày mong muốn: **${pending.requestedDate}**`,
          '',
          'Bạn có đồng ý với mức giá mới để mình gửi đơn không?',
        ].join('\n'),
      };
    }
    const result = await this.cemeteryServices.createOrder(userId, {
      serviceTypeId: pending.serviceTypeId,
      plotId: pending.plotId,
      requestedDate: pending.requestedDate,
      note:
        pending.note ??
        'Đơn dịch vụ được Trợ lý AI thiết lập theo xác nhận của khách hàng',
    });
    const id = this.resultId(result);
    const dateText = ` với ngày mong muốn **${pending.requestedDate}**`;
    return {
      handled: true,
      intent: 'service_booking',
      assistantMessage: `${(result as { reused?: boolean }).reused ? 'Đơn này đã được ghi nhận trước đó' : 'Đã gửi đơn dịch vụ'}${id ? ` **#${id}**` : ''} **${pending.serviceName ?? ''}** cho lô **${pending.plotCode}**${dateText}. Mình đã mở panel **Đã đặt → Thanh toán → Chọn lịch** ở bên phải. Sau khi bạn xác nhận đã thanh toán, panel sẽ tự chuyển sang lịch và tô sẵn ngày mong muốn để bạn kiểm tra hoặc đổi ngày.`,
      uiDirective: {
        type: 'SHOW_INLINE_SERVICE_PAYMENT',
        serviceTypeId: pending.serviceTypeId,
        orderId: id,
        amount: currentService.basePrice,
        paymentStatus: 'unpaid',
      },
    };
  }

  private async resolveRecommendedOption(
    conversationId: number | null,
    clientAction?: AgentClientActionDto,
    selectedPlotCode?: string,
  ): Promise<PlotSelection | undefined> {
    if (!conversationId) {
      return selectedPlotCode
        ? this.resolvePlotByCode(selectedPlotCode)
        : undefined;
    }
    const rows = await this.database.query<{ metadata: unknown }>(
      `SELECT metadata
       FROM ai_messages
       WHERE conversation_id = $1 AND role = 'assistant'
       ORDER BY created_at DESC, message_id DESC
       LIMIT 20`,
      [conversationId],
    );
    const options = rows.flatMap((row) => this.recommendations(row.metadata));
    if (clientAction?.plotIds?.length) {
      const requested = [...new Set(clientAction.plotIds)].sort(
        (a, b) => a - b,
      );
      const matched = options.find(
        (option) =>
          [...option.plotIds].sort((a, b) => a - b).join(',') ===
          requested.join(','),
      );
      if (!matched) {
        throw new ForbiddenException(
          'Selected plots were not recommended in this conversation',
        );
      }
      return matched;
    }
    if (selectedPlotCode) {
      const code = this.normalize(selectedPlotCode);
      const recommended = options.find((option) =>
        option.plotCodes.some((plotCode) => this.normalize(plotCode) === code),
      );
      return recommended ?? this.resolvePlotByCode(selectedPlotCode);
    }
    return options.length === 1 ? options[0] : undefined;
  }

  private recommendations(metadata: unknown): RecommendationOption[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const value = (metadata as { recommendations?: unknown }).recommendations;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (option): option is RecommendationOption =>
        !!option &&
        typeof option === 'object' &&
        Array.isArray((option as RecommendationOption).plotIds) &&
        Array.isArray((option as RecommendationOption).plotCodes),
    );
  }

  private async resolvePlotByCode(
    selectedPlotCode: string,
  ): Promise<PlotSelection> {
    await this.reservations.releaseExpiredReservations();
    const plot = await this.database.queryOne<{
      plotId: number;
      plotCode: string;
      status: string;
      zoneId: number;
      plotType: string;
      price: number | string;
    }>(
      `SELECT plot_id AS "plotId", plot_code AS "plotCode", status,
              zone_id AS "zoneId", plot_type AS "plotType", price::float
       FROM plots
       WHERE UPPER(plot_code) = UPPER($1) AND is_deleted = FALSE`,
      [selectedPlotCode.trim()],
    );
    if (!plot) {
      throw new BadRequestException(
        `Mình không tìm thấy mã lô ${selectedPlotCode.trim()} trong quỹ đất hiện tại. Bạn kiểm tra lại mã hoặc để mình tìm phương án khác nhé.`,
      );
    }
    if (plot.status === 'available') {
      return {
        plotIds: [plot.plotId],
        plotCodes: [plot.plotCode],
      };
    }

    const alternatives = await this.database.query<{
      plotCode: string;
      price: number | string;
    }>(
      `SELECT plot_code AS "plotCode", price::float
       FROM vw_plots_map
       WHERE status = 'available'
         AND zone_id = $1
         AND plot_type = $2
       ORDER BY ABS(price - $3), price ASC
       LIMIT 3`,
      [plot.zoneId, plot.plotType, Number(plot.price)],
    );
    const statusLabel: Record<string, string> = {
      sold: 'đã được mua',
      pending: 'đang được giữ trong một yêu cầu khác',
      reserved: 'đã được giữ chỗ',
      locked: 'đang tạm khóa',
    };
    const alternativeText = alternatives.length
      ? ` Các lô cùng loại gần mức giá này còn sẵn sàng gồm ${alternatives
          .map(
            (item) =>
              `**${item.plotCode}** (${Number(item.price).toLocaleString('vi-VN')} VND)`,
          )
          .join(', ')}.`
      : ' Hiện chưa có lô cùng loại gần mức giá này; mình có thể giúp bạn nới khu vực hoặc ngân sách để tìm lại.';
    throw new BadRequestException(
      `Lô **${plot.plotCode}** ${statusLabel[plot.status] ?? 'hiện không còn sẵn sàng'}, nên mình không thể tạo yêu cầu cho lô này.${alternativeText}`,
    );
  }

  private async validateAvailablePlots(
    plotIds: number[],
    expectedCodes: string[],
  ) {
    const rows = await this.database.query<{
      plotId: number;
      plotCode: string;
      price: number | string;
      status: string;
    }>(
      `SELECT plot_id AS "plotId", plot_code AS "plotCode",
              price::float, status
       FROM plots
       WHERE plot_id = ANY($1::int[]) AND is_deleted = FALSE
       ORDER BY plot_id`,
      [plotIds],
    );
    if (
      rows.length !== plotIds.length ||
      rows.some((plot) => plot.status !== 'available')
    ) {
      throw new BadRequestException(
        'Một hoặc nhiều lô đã không còn sẵn sàng. Bạn hãy để mình tìm phương án mới.',
      );
    }
    if (
      expectedCodes.length &&
      rows.some((row) => !expectedCodes.includes(row.plotCode))
    ) {
      throw new BadRequestException('Selected plot information has changed');
    }
    return rows.map((row) => ({ ...row, price: Number(row.price) }));
  }

  private async resolveServiceType(id?: number, query?: string) {
    const services = await this.activeServices();
    if (id) return services.find((service) => service.id === id);
    const normalized = this.normalize(query ?? '');
    if (!normalized) return undefined;
    const exact = services.find(
      (service) => this.normalize(service.name) === normalized,
    );
    if (exact) return exact;
    const tokens = normalized.split(/\s+/).filter((token) => token.length > 2);
    const ranked = services
      .map((service) => {
        const haystack = this.normalize(
          `${service.name} ${service.description ?? ''}`,
        );
        return {
          service,
          score: tokens.filter((token) => haystack.includes(token)).length,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.score && (!ranked[1] || ranked[0].score > ranked[1].score)
      ? ranked[0].service
      : undefined;
  }

  private async activeServices(): Promise<ServiceType[]> {
    const rows = await this.cemeteryServices.serviceTypes();
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : null,
      basePrice: Number(row.basePrice),
      unit: String(row.unit),
      category: String(row.category),
    }));
  }

  getOwnedPlots(userId: number | null): Promise<OwnedPlotContext[]> {
    if (!userId) return Promise.resolve([]);
    return this.database.query<OwnedPlotContext>(
      `SELECT DISTINCT p.plot_id AS "plotId", p.plot_code AS "plotCode",
              z.zone_name AS "zoneName", p.direction,
              p.area_sqm::float AS "areaSqm", p.plot_type AS "plotType"
       FROM ownership_records o
       JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       JOIN contracts c ON c.contract_id = o.contract_id
                        AND c.status = 'active' AND c.is_deleted = FALSE
       WHERE o.user_id = $1 AND o.is_current = TRUE
       ORDER BY p.plot_code`,
      [userId],
    );
  }

  private async profile(userId: number): Promise<ProfileSummary> {
    const row = await this.database.queryOne<ProfileSummary>(
      `SELECT full_name AS "fullName", phone_number AS phone, email
       FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new ForbiddenException('Customer account not found');
    return row;
  }

  private isValidFutureDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }

  private parseIsoDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(`${value}T00:00:00`);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return { year, month, day };
  }

  private addMinutes(value: string, minutes: number) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return undefined;
    const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
    if (total >= 24 * 60) return '23:59';
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private defaultMemorialMessage(
    customerName: string | null,
    title: string,
    dateLabel: string,
  ) {
    const greeting = customerName?.trim()
      ? `Kính gửi gia đình ${customerName.trim()},`
      : 'Kính gửi gia đình,';
    return `${greeting}\n\nVĩnh Phúc Viên trân trọng gửi lời nhắc về sự kiện “${title}” vào ${dateLabel}. Mong gia đình có đủ thời gian sắp xếp việc thăm viếng, chuẩn bị những nội dung phù hợp và cùng nhau gìn giữ những ký ức quý giá về người thân.\n\nNếu cần hỗ trợ chăm sóc phần mộ hoặc chuẩn bị cho ngày tưởng niệm, gia đình có thể liên hệ với chúng tôi.`;
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private resultId(result: unknown) {
    if (!result || typeof result !== 'object') return undefined;
    const value = (result as { id?: unknown }).id;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  }

  private isPendingAction(value: unknown): value is AgentPendingAction {
    if (!value || typeof value !== 'object') return false;
    const action = value as { kind?: unknown; stage?: unknown };
    return (
      (action.kind === 'plot_request' ||
        action.kind === 'service_order' ||
        action.kind === 'appointment' ||
        action.kind === 'memorial_reminder') &&
      (action.stage === 'collecting' ||
        action.stage === 'awaiting_confirmation')
    );
  }
}
