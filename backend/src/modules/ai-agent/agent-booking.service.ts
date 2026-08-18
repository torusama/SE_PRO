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
  AgentPendingAppointmentItem,
  AgentPendingServiceItem,
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

type ApprovedAppointmentPlot = OwnedPlotContext & {
  hasActiveAppointment: boolean;
};

interface ServiceType {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  category: string;
}

interface CustomerServiceOrder {
  id: number;
  status: string;
  paymentStatus?: 'unpaid' | 'awaiting_confirmation' | 'paid';
  serviceName: string;
  plotCode?: string | null;
  requestedDate?: string | null;
  createdAt?: string | null;
  amount?: number;
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
      `WITH reset_boundary AS (
         SELECT MAX(message_id) AS reset_message_id
         FROM ai_messages
         WHERE conversation_id = $1
           AND metadata ->> 'memoryResetBoundary' = 'true'
       )
       SELECT extracted_data->'pendingAction' AS "pendingAction"
       FROM ai_messages, reset_boundary
       WHERE conversation_id = $1
         AND role = 'assistant'
         AND (
           reset_boundary.reset_message_id IS NULL
           OR message_id > reset_boundary.reset_message_id
         )
       ORDER BY created_at DESC, message_id DESC
       LIMIT 1`,
      [conversationId],
    );
    const pending = row?.pendingAction;
    if (!this.isPendingAction(pending)) return undefined;
    if (pending.kind === 'plot_request' && 'requestType' in pending) {
      const currentPending = { ...pending } as Record<string, unknown>;
      delete currentPending.requestType;
      return {
        ...currentPending,
        stage: 'collecting',
      } as AgentPendingAction;
    }
    return pending;
  }

  async handleTurn(input: {
    conversationId: number | null;
    userId: number | null;
    plan: AgentPlan;
    userMessage?: string;
    clientAction?: AgentClientActionDto;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn | null> {
    // A pending action is context for the planner, not proof that every later
    // user message belongs to that transaction. Only an explicit client action
    // or a booking action chosen for the current turn may enter this service.
    // This lets customers ask an unrelated question without the unfinished
    // appointment/service flow swallowing the turn.
    const bookingAction =
      input.clientAction ||
      [
        'prepare_plot_request',
        'prepare_service_order',
        'cancel_service_order',
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
              : input.clientAction?.type === 'START_SERVICE_ORDER' ||
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

    if (input.plan.action === 'prepare_appointment') {
      return this.prepareAppointment(authenticatedInput);
    }

    if (input.plan.action === 'prepare_memorial_reminder') {
      return this.prepareMemorialReminder(authenticatedInput);
    }

    if (input.plan.action === 'cancel_service_order') {
      return this.prepareServiceCancellation(authenticatedInput);
    }

    if (
      input.clientAction?.type === 'START_SERVICE_ORDER' ||
      input.plan.action === 'prepare_service_order'
    ) {
      return this.prepareServiceOrder(authenticatedInput);
    }

    if (
      input.clientAction?.type === 'START_PLOT_REQUEST' ||
      input.plan.action === 'prepare_plot_request'
    ) {
      return this.preparePlotRequest(authenticatedInput);
    }

    return null;
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
    pending.stage = 'awaiting_confirmation';
    const profile = await this.profile(input.userId);
    const total = plots.reduce((sum, plot) => sum + plot.price, 0);
    pending.quotedTotal = total;
    return {
      handled: true,
      intent: 'plot_request',
      pendingAction: pending,
      assistantMessage: [
        'Mình đã chuẩn bị yêu cầu như sau:',
        '- Hình thức: **Gửi yêu cầu mua**',
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
    userMessage?: string;
    clientAction?: AgentClientActionDto;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const existing =
      input.pendingAction?.kind === 'service_order' &&
      input.pendingAction.operation !== 'cancel'
        ? input.pendingAction
        : undefined;
    const requestedDateFromTurn =
      !input.userMessage || this.hasExplicitServiceDate(input.userMessage)
        ? input.plan.requirements.requestedDate
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

    let queuedItems = existing?.serviceItems?.map((item) => ({ ...item }));
    if (!queuedItems?.length && input.plan.requirements.serviceQueries?.length) {
      const resolved = await Promise.all(
        input.plan.requirements.serviceQueries.map((query) =>
          this.resolveServiceType(undefined, query),
        ),
      );
      const seen = new Set<number>();
      queuedItems = resolved
        .filter((item): item is ServiceType => Boolean(item))
        .filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .map((item, index) => ({
          serviceTypeId: item.id,
          serviceName: item.name,
          quotedPrice: item.basePrice,
          serviceUnit: item.unit,
          requestedDate: index === 0 ? requestedDateFromTurn : undefined,
          note: input.plan.requirements.note,
        }));
    }

    if (queuedItems && queuedItems.length > 1) {
      return this.prepareQueuedServiceOrder({
        ...input,
        existing,
        ownedPlots,
        items: queuedItems,
        requestedDateFromTurn,
      });
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
        requestedDateFromTurn ?? existing?.requestedDate,
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
        'Bạn xác nhận để mình gửi đơn dịch vụ này không? Sau khi đơn được tạo, panel bên phải sẽ mở bước thanh toán. Khi bạn báo đã thanh toán, đơn sẽ chờ ban quản lý duyệt; chỉ sau khi được duyệt panel mới hiển thị lịch với đúng ngày bạn vừa chọn.',
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

  private async prepareQueuedServiceOrder(input: {
    userId: number;
    plan: AgentPlan;
    userMessage?: string;
    existing?: Extract<AgentPendingAction, { kind: 'service_order' }>;
    ownedPlots: OwnedPlotContext[];
    items: AgentPendingServiceItem[];
    requestedDateFromTurn?: string;
  }): Promise<AgentBookingTurn> {
    const index = Math.min(
      Math.max(input.existing?.activeServiceItemIndex ?? 0, 0),
      input.items.length - 1,
    );
    const current = { ...input.items[index] };
    const service = await this.resolveServiceType(
      current.serviceTypeId,
      current.serviceName,
    );
    if (!service) {
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage:
          'Một dịch vụ trong danh sách hiện không còn hoạt động. Bạn chọn lại các dịch vụ đang nhận đơn giúp mình nhé.',
        suggestedServices: await this.activeServices(),
      };
    }

    const requestedCode =
      input.plan.requirements.selectedPlotCode ?? current.plotCode;
    const selectedPlot =
      input.ownedPlots.find(
        (plot) =>
          plot.plotId === current.plotId ||
          this.normalize(plot.plotCode) === this.normalize(requestedCode ?? ''),
      ) ?? (input.ownedPlots.length === 1 ? input.ownedPlots[0] : undefined);
    current.serviceTypeId = service.id;
    current.serviceName = service.name;
    current.quotedPrice = service.basePrice;
    current.serviceUnit = service.unit;
    current.plotId = selectedPlot?.plotId;
    current.plotCode = selectedPlot?.plotCode;
    current.requestedDate =
      input.requestedDateFromTurn ?? current.requestedDate;
    current.note = input.plan.requirements.note ?? current.note;
    input.items[index] = current;

    const pending: Extract<AgentPendingAction, { kind: 'service_order' }> = {
      kind: 'service_order',
      operation: 'create',
      stage: 'collecting',
      serviceItems: input.items,
      activeServiceItemIndex: index,
      serviceTypeId: current.serviceTypeId,
      serviceName: current.serviceName,
      plotId: current.plotId,
      plotCode: current.plotCode,
      requestedDate: current.requestedDate,
      quotedPrice: current.quotedPrice,
      serviceUnit: current.serviceUnit,
      note: current.note,
    };
    const position = `dịch vụ ${index + 1}/${input.items.length}`;

    if (!selectedPlot) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: pending,
        assistantMessage: `Với ${position} **${service.name}**, bạn muốn áp dụng cho lô nào: **${input.ownedPlots.map((plot) => plot.plotCode).join(', ')}**? Mình sẽ hỏi riêng từng dịch vụ, không tự chọn thay bạn.`,
        quickReplies: input.ownedPlots.slice(0, 6).map((plot) => ({
          id: `service-${index}-plot-${plot.plotId}`,
          label: plot.plotCode,
          message: `Dịch vụ ${service.name} áp dụng cho lô ${plot.plotCode}.`,
          emphasis: 'strong' as const,
        })),
      };
    }

    if (
      current.requestedDate &&
      !this.isValidFutureDate(current.requestedDate)
    ) {
      current.requestedDate = undefined;
      pending.requestedDate = undefined;
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: pending,
        assistantMessage: `Ngày đã chọn cho **${service.name}** không hợp lệ hoặc đã qua. Bạn chọn lại một ngày từ hôm nay trở đi nhé.`,
      };
    }

    if (!current.requestedDate) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: pending,
        assistantMessage: [
          `Mình đang ghi nhận ${position}: **${service.name}** cho lô **${selectedPlot.plotCode}**.`,
          '',
          `**Bạn muốn riêng dịch vụ ${service.name} được thực hiện vào ngày nào?** Mình sẽ chưa chuyển sang thanh toán cho đến khi bạn xác nhận ngày của tất cả ${input.items.length} dịch vụ.`,
        ].join('\n'),
      };
    }

    pending.stage = 'awaiting_confirmation';
    return {
      handled: true,
      intent: 'service_booking',
      pendingAction: pending,
      assistantMessage: [
        `Mình đã ghi nhận ngày cho ${position}:`,
        `- Dịch vụ: **${service.name}**`,
        `- Lô áp dụng: **${selectedPlot.plotCode}**`,
        `- Ngày mong muốn: **${current.requestedDate}**`,
        `- Chi phí dự kiến: **${service.basePrice.toLocaleString('vi-VN')} VND/${service.unit}**`,
        '',
        `Bạn xác nhận đúng ngày này cho **${service.name}** chứ? Sau khi xác nhận, mình mới chuyển sang hỏi dịch vụ tiếp theo; chưa mở thanh toán lúc này.`,
      ].join('\n'),
      quickReplies: [
        {
          id: `service-confirm-item-${index}`,
          label: `Xác nhận ngày dịch vụ ${index + 1}`,
          message: `Mình xác nhận ngày ${current.requestedDate} cho dịch vụ ${service.name}.`,
          emphasis: 'strong',
        },
      ],
    };
  }

  private async prepareServiceCancellation(input: {
    userId: number;
    plan: AgentPlan;
    userMessage?: string;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const orders = (await this.cemeteryServices.myOrders(
      input.userId,
    )) as CustomerServiceOrder[];
    const activeOrders = orders
      .filter((order) => !['completed', 'cancelled'].includes(order.status))
      .sort(
        (left, right) =>
          new Date(right.createdAt ?? 0).getTime() -
          new Date(left.createdAt ?? 0).getTime(),
      );

    const message = input.userMessage ?? '';
    const folded = this.normalize(message);
    const explicitOrderId =
      input.plan.requirements.serviceOrderId ??
      this.serviceOrderIdFromMessage(message);

    if (!activeOrders.length) {
      const exact = explicitOrderId
        ? orders.find((order) => order.id === explicitOrderId)
        : undefined;
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage:
          exact?.status === 'cancelled'
            ? `Đơn dịch vụ **#${exact.id}** đã được hủy trước đó rồi.`
            : exact?.status === 'completed'
              ? `Đơn **#${exact.id} – ${exact.serviceName}** đã hoàn thành nên không thể hủy.`
              : 'Tài khoản của bạn hiện không có đơn dịch vụ nào đang hoạt động để hủy.',
      };
    }

    const existing =
      input.pendingAction?.kind === 'service_order' &&
      input.pendingAction.operation === 'cancel'
        ? input.pendingAction
        : undefined;
    let candidates = existing?.candidateOrderIds?.length
      ? activeOrders.filter((order) =>
          existing.candidateOrderIds?.includes(order.id),
        )
      : activeOrders;
    let selected: CustomerServiceOrder | undefined;

    if (explicitOrderId) {
      selected = orders.find((order) => order.id === explicitOrderId);
      if (!selected) {
        return {
          handled: true,
          intent: 'service_booking',
          assistantMessage: `Mình không tìm thấy đơn dịch vụ **#${explicitOrderId}** trong tài khoản của bạn. Bạn kiểm tra lại mã đơn giúp mình nhé.`,
        };
      }
    }

    if (!selected && candidates.length > 1) {
      const ordinal = this.serviceOrderOrdinal(folded);
      if (ordinal && ordinal <= candidates.length) {
        selected = candidates[ordinal - 1];
      }
    }

    if (!selected) {
      const namedMatches = candidates.filter((order) => {
        const serviceName = this.normalize(order.serviceName);
        const plotCode = this.normalize(order.plotCode ?? '');
        return (
          (serviceName && folded.includes(serviceName)) ||
          (plotCode && folded.includes(plotCode))
        );
      });
      if (namedMatches.length === 1) selected = namedMatches[0];
      else if (namedMatches.length > 1) candidates = namedMatches;
    }

    const asksForLatest =
      /\b(?:vua dat|moi dat|gan nhat|moi nhat|don vua roi|don luc nay)\b/.test(
        folded,
      );
    if (!selected && asksForLatest) selected = activeOrders[0];
    if (!selected && candidates.length === 1) selected = candidates[0];

    if (!selected) {
      const pendingAction: AgentPendingAction = {
        kind: 'service_order',
        operation: 'cancel',
        stage: 'collecting',
        candidateOrderIds: candidates.map((order) => order.id),
      };
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction,
        assistantMessage: [
          'Bạn đang có nhiều đơn dịch vụ. Mình chưa hủy đơn nào; bạn chọn đúng một đơn bên dưới nhé:',
          ...candidates.map(
            (order, index) =>
              `${index + 1}. **#${order.id} – ${order.serviceName}**${order.plotCode ? ` · lô **${order.plotCode}**` : ''}${order.requestedDate ? ` · ngày **${order.requestedDate}**` : ''} · ${this.serviceOrderStatusLabel(order)}`,
          ),
        ].join('\n'),
        quickReplies: candidates.slice(0, 6).map((order) => ({
          id: `cancel-service-order-${order.id}`,
          label: `Chọn đơn #${order.id}`,
          message: `Mình muốn hủy đơn dịch vụ #${order.id}.`,
          emphasis: 'strong' as const,
        })),
      };
    }

    if (selected.status === 'cancelled') {
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage: `Đơn dịch vụ **#${selected.id}** đã được hủy trước đó rồi.`,
      };
    }
    if (selected.status === 'completed') {
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage: `Đơn **#${selected.id} – ${selected.serviceName}** đã hoàn thành nên không thể hủy.`,
      };
    }
    if (
      selected.status === 'in_progress' ||
      selected.paymentStatus === 'awaiting_confirmation' ||
      selected.paymentStatus === 'paid'
    ) {
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage: `Đơn **#${selected.id} – ${selected.serviceName}** ${selected.status === 'in_progress' ? 'đang được thực hiện' : 'đã ghi nhận thanh toán'}, nên mình không thể tự hủy vì còn liên quan xử lý/đối soát. Bạn vui lòng liên hệ ban quản lý để được hỗ trợ đúng quy trình.`,
      };
    }

    const pendingAction: AgentPendingAction = {
      kind: 'service_order',
      operation: 'cancel',
      stage: 'awaiting_confirmation',
      orderId: selected.id,
      orderStatus: selected.status,
      serviceName: selected.serviceName,
      plotCode: selected.plotCode ?? undefined,
      requestedDate: selected.requestedDate ?? undefined,
    };
    return {
      handled: true,
      intent: 'service_booking',
      pendingAction,
      assistantMessage: [
        'Mình đã xác định đơn bạn muốn hủy:',
        `- Đơn: **#${selected.id} – ${selected.serviceName}**`,
        selected.plotCode ? `- Lô áp dụng: **${selected.plotCode}**` : '',
        selected.requestedDate
          ? `- Ngày mong muốn: **${selected.requestedDate}**`
          : '',
        '',
        'Bạn xác nhận hủy đúng đơn này chứ? Sau khi xác nhận, đơn sẽ chuyển sang trạng thái đã hủy.',
      ]
        .filter(Boolean)
        .join('\n'),
      quickReplies: [
        {
          id: `confirm-cancel-service-order-${selected.id}`,
          label: `Xác nhận hủy đơn #${selected.id}`,
          message: `Mình xác nhận hủy đơn dịch vụ #${selected.id}.`,
          emphasis: 'strong',
        },
        {
          id: `keep-service-order-${selected.id}`,
          label: 'Giữ lại đơn này',
          message: 'Mình không hủy nữa, hãy giữ lại đơn dịch vụ này.',
        },
      ],
    };
  }

  private async prepareAppointment(input: {
    userId: number;
    plan: AgentPlan;
    userMessage?: string;
    pendingAction?: AgentPendingAction;
  }): Promise<AgentBookingTurn> {
    const approvedPurchasePlots = await this.getApprovedAppointmentPlots(
      input.userId,
    );
    const approvedPlots = approvedPurchasePlots.filter(
      (plot) => !plot.hasActiveAppointment,
    );
    const existing =
      input.pendingAction?.kind === 'appointment'
        ? input.pendingAction
        : undefined;
    if (!approvedPurchasePlots.length) {
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage:
          'Hiện tài khoản của bạn chưa có yêu cầu **mua lô** nào đã được ban quản lý duyệt, nên mình chưa thể mở bước đặt lịch. Khi yêu cầu mua lô được duyệt, bạn quay lại đây hoặc nhắn “đặt lịch”; mình sẽ kiểm tra lại trước khi hỏi ngày/giờ.',
        quickReplies: [
          {
            id: 'appointment-view-plot-requests',
            label: 'Xem yêu cầu lô của tôi',
            message: 'Cho mình xem tình trạng các yêu cầu mua lô của mình.',
            emphasis: 'strong',
          },
        ],
      };
    }
    if (!approvedPlots.length) {
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage:
          'Các lô mua đã được duyệt trong tài khoản của bạn hiện đều đã có lịch hẹn đang chờ hoặc đã được xác nhận, nên mình không tạo thêm lịch trùng. Nếu bạn muốn đổi/hủy lịch hiện có, hãy nói rõ lịch nào để mình hướng dẫn đúng bước.',
        quickReplies: [
          {
            id: 'appointment-view-existing',
            label: 'Xem lịch hẹn của tôi',
            message: 'Cho mình xem các lịch hẹn hiện có của mình.',
            emphasis: 'strong',
          },
        ],
      };
    }

    // If the customer explicitly names a plot that is approved but already
    // has a live appointment, explain that state instead of silently switching
    // them to another eligible plot.
    const explicitlyMentionedApprovedPlots =
      !existing?.selectedPlotCode && !existing?.appointmentItems
        ? this.findPlotMentions(input.userMessage, approvedPurchasePlots)
        : [];
    const mentionedAlreadyScheduled = explicitlyMentionedApprovedPlots.filter(
      (plot) => plot.hasActiveAppointment,
    );
    if (mentionedAlreadyScheduled.length) {
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage: [
          `Lô **${mentionedAlreadyScheduled.map((plot) => plot.plotCode).join(', ')}** đã có lịch hẹn đang chờ hoặc đã được xác nhận, nên mình không tạo lịch trùng.`,
          approvedPlots.length
            ? `Các lô đã duyệt vẫn còn cần đặt lịch: **${approvedPlots.map((plot) => plot.plotCode).join(', ')}**. Bạn muốn đặt cho lô nào?`
            : 'Hiện không còn lô đã duyệt nào cần tạo lịch mới.',
        ].join(' '),
        quickReplies: approvedPlots.slice(0, 6).map((plot) => ({
          id: `appointment-eligible-plot-${plot.plotId}`,
          label: `Đặt lịch lô ${plot.plotCode}`,
          message: `Mình muốn đặt lịch hẹn xem lô ${plot.plotCode}.`,
          emphasis: 'strong' as const,
        })),
      };
    }

    // Never treat an old recommendation or remembered plot as consent. Read
    // plot codes only from the current appointment request. The sole eligible
    // approved plot is the one safe exception because there is no ambiguity.
    const explicitlySelectedPlots =
      !existing?.selectedPlotCode && !existing?.appointmentItems
        ? this.wantsAllApprovedAppointmentPlots(input.userMessage)
          ? approvedPlots
          : this.findPlotMentions(input.userMessage, approvedPlots)
        : [];
    if (explicitlySelectedPlots.length > 1 || existing?.appointmentItems) {
      return this.prepareQueuedAppointments({
        ...input,
        approvedPlots,
        items:
          existing?.appointmentItems ??
          explicitlySelectedPlots.map((plot) => ({ plotCode: plot.plotCode })),
      });
    }
    const explicitlySelectedPlot = explicitlySelectedPlots[0];
    // A generic "đặt lịch" request is unambiguous when the account has only
    // one approved purchase plot. In that case go straight to collecting the
    // date/time instead of asking the customer to select the only possible
    // plot again. With multiple approved plots we still require an explicit
    // selection (or an explicit list) before any appointment is prepared.
    const onlyEligiblePlot =
      !existing?.selectedPlotCode &&
      !existing?.appointmentItems &&
      approvedPlots.length === 1
        ? approvedPlots[0]
        : undefined;
    const selectedPlot = approvedPlots.find(
      (plot) =>
        this.normalize(plot.plotCode) ===
        this.normalize(
          existing?.selectedPlotCode ??
            explicitlySelectedPlot?.plotCode ??
            onlyEligiblePlot?.plotCode ??
            '',
        ),
    );
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
      topic: selectedPlot
        ? this.appointmentPurpose(selectedPlot.plotCode)
        : undefined,
      selectedPlotCode: selectedPlot?.plotCode,
    };

    if (!selectedPlot) {
      return this.askForAppointmentPlot(pending, approvedPlots);
    }

    if (
      !pending.appointmentDate ||
      !this.isValidFutureDate(pending.appointmentDate)
    ) {
      pending.appointmentDate = undefined;
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: pending,
        uiDirective: {
          type: 'OPEN_APPOINTMENT_CALENDAR',
          mode: 'collecting',
          startTime: pending.startTime,
          endTime: pending.endTime,
          topic: pending.topic,
          plotCode: pending.selectedPlotCode,
        },
        assistantMessage:
          'Bạn muốn gặp ban quản lý vào ngày nào? Mình sẽ mở lịch để bạn chọn ngày phù hợp.',
      };
    }
    if (
      !pending.startTime ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(pending.startTime)
    ) {
      pending.startTime = undefined;
      pending.endTime = undefined;
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: pending,
        uiDirective: {
          type: 'OPEN_APPOINTMENT_CALENDAR',
          mode: 'collecting',
          appointmentDate: pending.appointmentDate,
          startTime: pending.startTime,
          endTime: pending.endTime,
          topic: pending.topic,
          plotCode: pending.selectedPlotCode,
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
    const subject = this.appointmentPurpose(pending.selectedPlotCode);
    return {
      handled: true,
      intent: 'appointment_booking',
      pendingAction: pending,
      uiDirective: {
        type: 'OPEN_APPOINTMENT_CALENDAR',
        mode: 'review',
        appointmentDate: pending.appointmentDate,
        startTime: pending.startTime,
        endTime: pending.endTime,
        topic: subject,
        plotCode: pending.selectedPlotCode,
      },
      assistantMessage: [
        `Mình đã chuẩn bị lịch hẹn xem lô **${pending.selectedPlotCode}**:`,
        `- Ngày: **${pending.appointmentDate}**`,
        `- Thời gian: **${pending.startTime}–${pending.endTime}**`,
        `- Mục đích: **${subject}**`,
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
      .filter(
        (email, index, values) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
          values.indexOf(email) === index,
      )
      .slice(0, 10);
    const recurring =
      input.plan.requirements.reminderRecurring ??
      existing?.isRecurring ??
      true;
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
      : (reminderDate ?? existing?.specificDate ?? 'chưa xác định');
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
      specificDate: recurring
        ? undefined
        : (reminderDate ?? existing?.specificDate),
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
        (!pending.specificDate ||
          !this.isValidFutureDate(pending.specificDate))) ||
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
      if (pending.appointmentItems?.length) {
        return this.confirmQueuedAppointments(userId, pending);
      }
      const approvedPurchasePlots = await this.getApprovedAppointmentPlots(userId);
      const approvedPlots = approvedPurchasePlots.filter(
        (plot) => !plot.hasActiveAppointment,
      );
      const approvedPlot = approvedPlots.find(
        (plot) =>
          this.normalize(plot.plotCode) ===
          this.normalize(pending.selectedPlotCode ?? ''),
      );
      if (!approvedPlot) {
        const selectedApprovedPlot = approvedPurchasePlots.find(
          (plot) =>
            this.normalize(plot.plotCode) ===
            this.normalize(pending.selectedPlotCode ?? ''),
        );
        pending.stage = 'collecting';
        pending.selectedPlotCode = undefined;
        if (selectedApprovedPlot?.hasActiveAppointment) {
          return {
            handled: true,
            intent: 'appointment_booking',
            assistantMessage: `Lô **${selectedApprovedPlot.plotCode}** vừa có một lịch hẹn đang chờ hoặc đã được xác nhận, nên mình không gửi thêm lịch trùng. Bạn có thể xem lịch hiện có hoặc chọn một lô đã duyệt khác chưa có lịch.`,
          };
        }
        if (!approvedPurchasePlots.length) {
          return {
            handled: true,
            intent: 'appointment_booking',
            assistantMessage:
              'Yêu cầu mua lô dùng cho lịch hẹn này hiện không còn ở trạng thái đã duyệt, nên mình chưa gửi lịch. Bạn vui lòng kiểm tra lại tình trạng yêu cầu mua lô trước.',
          };
        }
        if (!approvedPlots.length) {
          return {
            handled: true,
            intent: 'appointment_booking',
            assistantMessage:
              'Các lô mua đã được duyệt hiện đều đã có lịch hẹn đang chờ hoặc đã xác nhận, nên mình chưa tạo thêm lịch trùng.',
          };
        }
        return this.askForAppointmentPlot(pending, approvedPlots);
      }
      if (
        !pending.appointmentDate ||
        !pending.startTime ||
        !pending.endTime ||
        !this.isValidFutureDate(pending.appointmentDate)
      ) {
        throw new BadRequestException('Thông tin lịch hẹn chưa đầy đủ');
      }
      const topic = this.appointmentPurpose(approvedPlot.plotCode);
      const result = await this.schedule.bookAppointment(userId, {
        appointmentDate: pending.appointmentDate,
        startTime: pending.startTime,
        endTime: pending.endTime,
        note: topic,
      });
      const id = this.resultId(result);
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage: `Mình đã gửi yêu cầu đặt lịch${id ? ` **#${id}**` : ''} để xem lô **${approvedPlot.plotCode}** vào **${pending.startTime}–${pending.endTime}, ngày ${pending.appointmentDate}**. Lịch đang chờ ban quản lý xác nhận.`,
        uiDirective: {
          type: 'OPEN_APPOINTMENT_CALENDAR',
          mode: 'summary',
          appointmentId: id,
          appointmentDate: pending.appointmentDate,
          startTime: pending.startTime,
          endTime: pending.endTime,
          topic,
          plotCode: approvedPlot.plotCode,
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
        assistantMessage: `Đã gửi yêu cầu mua lô${id ? ` **#${id}**` : ''} cho **${pending.plotCodes.join(', ')}**. Bạn có thể theo dõi trạng thái trong mục yêu cầu của tài khoản. Nếu bạn muốn, mình có thể tư vấn thêm lô khác, dịch vụ chăm sóc hoặc giải thích bước tiếp theo ngay bây giờ.`,
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
            message:
              'Giải thích giúp mình bước tiếp theo sau khi đã gửi yêu cầu.',
          },
        ],
      };
    }

    if (pending.operation === 'cancel') {
      if (!pending.orderId) {
        return {
          handled: true,
          intent: 'service_booking',
          pendingAction: { ...pending, stage: 'collecting' },
          assistantMessage:
            'Mình chưa xác định được đơn dịch vụ cần hủy. Bạn chọn lại đúng một đơn giúp mình nhé.',
        };
      }
      const cancelled = (await this.cemeteryServices.cancelByCustomer(
        pending.orderId,
        userId,
      )) as unknown as CustomerServiceOrder;
      return {
        handled: true,
        intent: 'service_booking',
        assistantMessage: `Mình đã hủy đơn dịch vụ **#${cancelled.id} – ${cancelled.serviceName}**${cancelled.plotCode ? ` cho lô **${cancelled.plotCode}**` : ''}. Các đơn dịch vụ khác của bạn vẫn được giữ nguyên.`,
        quickReplies: [
          {
            id: 'after-service-cancel-view-services',
            label: 'Đặt dịch vụ khác',
            message: 'Cho mình xem các dịch vụ chăm sóc để đặt dịch vụ khác.',
            emphasis: 'strong',
          },
          {
            id: 'after-service-cancel-view-orders',
            label: 'Xem các đơn còn lại',
            message: 'Cho mình xem tình trạng các đơn dịch vụ còn lại.',
          },
        ],
      };
    }

    if (pending.serviceItems && pending.serviceItems.length > 1) {
      return this.confirmQueuedServiceOrders(userId, pending);
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
      assistantMessage: `${(result as { reused?: boolean }).reused ? 'Đơn này đã được ghi nhận trước đó' : 'Đã gửi đơn dịch vụ'}${id ? ` **#${id}**` : ''} **${pending.serviceName ?? ''}** cho lô **${pending.plotCode}**${dateText}. Mình đã mở panel thanh toán ở bên phải. Sau khi bạn báo đã chuyển khoản, đơn sẽ chờ ban quản lý duyệt. Khi thanh toán được xác nhận, bạn sẽ nhận thông báo và panel sẽ tự hiển thị đúng ngày dịch vụ đã chọn; bạn không cần xác nhận ngày thêm lần nữa.`,
      quickReplies: [
        {
          id: 'after-service-order-add-more',
          label: 'Đặt thêm dịch vụ',
          message: 'Cho mình xem các dịch vụ chăm sóc để đặt thêm dịch vụ khác.',
          emphasis: 'strong',
        },
        ...(id
          ? [
              {
                id: `after-service-order-cancel-${id}`,
                label: `Hủy đơn #${id}`,
                message: `Mình muốn hủy đơn dịch vụ #${id} vừa đặt.`,
                emphasis: 'normal' as const,
              },
            ]
          : []),
      ],
      uiDirective: {
        type: 'SHOW_INLINE_SERVICE_PAYMENT',
        serviceTypeId: pending.serviceTypeId,
        orderId: id,
        amount: currentService.basePrice,
        paymentStatus: 'unpaid',
      },
    };
  }

  private async confirmQueuedAppointments(
    userId: number,
    pending: Extract<AgentPendingAction, { kind: 'appointment' }>,
  ): Promise<AgentBookingTurn> {
    const items = (pending.appointmentItems ?? []).map((item) => ({ ...item }));
    const index = Math.min(
      Math.max(pending.activeAppointmentItemIndex ?? 0, 0),
      items.length - 1,
    );
    const current = items[index];
    if (
      !current?.appointmentDate ||
      !current.startTime ||
      !current.endTime ||
      !this.isValidFutureDate(current.appointmentDate)
    ) {
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: { ...pending, stage: 'collecting', appointmentItems: items },
        assistantMessage: `Lịch cho lô **${current?.plotCode ?? ''}** còn thiếu ngày hoặc giờ hợp lệ nên mình chưa xác nhận. Bạn bổ sung thông tin cho đúng lô này nhé.`,
      };
    }
    current.confirmed = true;
    items[index] = current;
    const nextIndex = items.findIndex((item) => !item.confirmed);
    if (nextIndex >= 0) {
      const next = items[nextIndex];
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: {
          kind: 'appointment',
          stage: 'collecting',
          appointmentItems: items,
          activeAppointmentItemIndex: nextIndex,
          selectedPlotCode: next.plotCode,
          appointmentDate: next.appointmentDate,
          startTime: next.startTime,
          endTime: next.endTime,
          topic: this.appointmentPurpose(next.plotCode),
        },
        assistantMessage: `Đã xác nhận lịch xem lô **${current.plotCode}**. Tiếp theo là lô **${next.plotCode}** (${nextIndex + 1}/${items.length}); bạn muốn hẹn vào ngày nào?`,
      };
    }

    const approvedPurchasePlots = await this.getApprovedAppointmentPlots(userId);
    const eligibleCodes = new Set(
      approvedPurchasePlots
        .filter((plot) => !plot.hasActiveAppointment)
        .map((plot) => this.normalize(plot.plotCode)),
    );
    const invalid = items.find(
      (item) => !eligibleCodes.has(this.normalize(item.plotCode)),
    );
    if (invalid) {
      const current = approvedPurchasePlots.find(
        (plot) =>
          this.normalize(plot.plotCode) === this.normalize(invalid.plotCode),
      );
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage: current?.hasActiveAppointment
          ? `Lô **${invalid.plotCode}** vừa có lịch hẹn đang chờ hoặc đã được xác nhận, nên mình không gửi thêm bộ lịch để tránh tạo trùng. Bạn kiểm tra lịch hiện có trước nhé.`
          : `Lô **${invalid.plotCode}** không còn là lô mua đã được duyệt đủ điều kiện đặt lịch, nên mình chưa gửi các lịch. Bạn kiểm tra lại yêu cầu mua lô trước nhé.`,
      };
    }

    const created = await this.schedule.bookAppointments(
      userId,
      items.map((item) => ({
        appointmentDate: item.appointmentDate!,
        startTime: item.startTime!,
        endTime: item.endTime!,
        note: this.appointmentPurpose(item.plotCode),
      })),
    );
    const appointments: Array<{ id?: number; item: AgentPendingAppointmentItem }> =
      items.map((item, itemIndex) => ({
        id: this.resultId(created[itemIndex]),
        item,
      }));
    const first = appointments[0];
    return {
      handled: true,
      intent: 'appointment_booking',
      assistantMessage: [
        `Đã gửi ${appointments.length} yêu cầu lịch hẹn sang ban quản lý:`,
        ...appointments.map(
          ({ id, item }) =>
            `- ${id ? `**#${id}** ` : ''}xem lô **${item.plotCode}** · **${item.startTime}–${item.endTime}, ngày ${item.appointmentDate}**`,
        ),
        '',
        'Các lịch này giống hệt lịch đặt thủ công và đang chờ ban quản lý xác nhận.',
      ].join('\n'),
      uiDirective: {
        type: 'OPEN_APPOINTMENT_CALENDAR',
        mode: 'summary',
        appointmentId: first.id,
        appointmentDate: first.item.appointmentDate,
        startTime: first.item.startTime,
        endTime: first.item.endTime,
        topic: this.appointmentPurpose(first.item.plotCode),
        plotCode: first.item.plotCode,
      },
    };
  }

  private async prepareQueuedAppointments(input: {
    userId: number;
    plan: AgentPlan;
    userMessage?: string;
    pendingAction?: AgentPendingAction;
    approvedPlots: ApprovedAppointmentPlot[];
    items: AgentPendingAppointmentItem[];
  }): Promise<AgentBookingTurn> {
    const existing = input.pendingAction?.kind === 'appointment'
      ? input.pendingAction
      : undefined;
    const items = input.items.map((item) => ({ ...item }));
    const index = Math.min(
      Math.max(existing?.activeAppointmentItemIndex ?? 0, 0),
      items.length - 1,
    );
    const item = items[index];
    const plot = input.approvedPlots.find(
      (candidate) =>
        this.normalize(candidate.plotCode) === this.normalize(item.plotCode),
    );
    if (!plot) {
      return {
        handled: true,
        intent: 'appointment_booking',
        assistantMessage: `Lô **${item.plotCode}** không còn ở trạng thái yêu cầu mua đã được duyệt nên mình chưa tạo lịch nào. Bạn chọn lại lô hợp lệ giúp mình nhé.`,
      };
    }
    const dateFromTurn =
      input.userMessage && this.hasExplicitServiceDate(input.userMessage)
        ? input.plan.requirements.appointmentDate
        : undefined;
    item.appointmentDate = dateFromTurn ?? item.appointmentDate;
    const timeFromTurn = input.plan.requirements.appointmentStartTime;
    if (
      timeFromTurn &&
      /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:gio|h))\b/i.test(
        input.userMessage ?? '',
      )
    ) {
      item.startTime = timeFromTurn;
      item.endTime =
        input.plan.requirements.appointmentEndTime ??
        this.addMinutes(timeFromTurn, 60);
    }
    items[index] = item;
    const pending: Extract<AgentPendingAction, { kind: 'appointment' }> = {
      kind: 'appointment',
      stage: 'collecting',
      appointmentItems: items,
      activeAppointmentItemIndex: index,
      selectedPlotCode: item.plotCode,
      appointmentDate: item.appointmentDate,
      startTime: item.startTime,
      endTime: item.endTime,
      topic: this.appointmentPurpose(item.plotCode),
    };
    const label = `lô ${index + 1}/${items.length} **${item.plotCode}**`;

    if (!item.appointmentDate || !this.isValidFutureDate(item.appointmentDate)) {
      item.appointmentDate = undefined;
      pending.appointmentDate = undefined;
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: pending,
        assistantMessage: `Bạn muốn hẹn xem ${label} vào ngày nào? Mình sẽ hỏi và xác nhận lịch riêng cho từng lô, chưa tạo lịch nào lúc này.`,
      };
    }
    if (!item.startTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime)) {
      item.startTime = undefined;
      item.endTime = undefined;
      pending.startTime = undefined;
      pending.endTime = undefined;
      return {
        handled: true,
        intent: 'appointment_booking',
        pendingAction: pending,
        assistantMessage: `Bạn muốn gặp ban quản lý lúc mấy giờ ngày **${item.appointmentDate}** để xem ${label}?`,
      };
    }
    if (!item.endTime || item.endTime <= item.startTime) {
      item.endTime = this.addMinutes(item.startTime, 60);
      pending.endTime = item.endTime;
    }
    pending.stage = 'awaiting_confirmation';
    return {
      handled: true,
      intent: 'appointment_booking',
      pendingAction: pending,
      assistantMessage: [
        `Mình đã chuẩn bị lịch hẹn cho ${label}:`,
        `- Ngày: **${item.appointmentDate}**`,
        `- Thời gian: **${item.startTime}–${item.endTime}**`,
        '',
        `Bạn xác nhận lịch riêng của lô **${item.plotCode}** chứ? Sau đó mình mới hỏi lô tiếp theo; chưa gửi lịch sang ban quản lý.`,
      ].join('\n'),
    };
  }

  private async confirmQueuedServiceOrders(
    userId: number,
    pending: Extract<AgentPendingAction, { kind: 'service_order' }>,
  ): Promise<AgentBookingTurn> {
    const items = (pending.serviceItems ?? []).map((item) => ({ ...item }));
    const index = Math.min(
      Math.max(pending.activeServiceItemIndex ?? 0, 0),
      items.length - 1,
    );
    const current = items[index];
    if (
      !current?.serviceTypeId ||
      !current.plotId ||
      !current.requestedDate ||
      !this.isValidFutureDate(current.requestedDate)
    ) {
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: {
          ...pending,
          stage: 'collecting',
          requestedDate: current?.requestedDate,
          serviceItems: items,
        },
        assistantMessage: `Dịch vụ **${current?.serviceName ?? `thứ ${index + 1}`}** vẫn thiếu lô hoặc ngày hợp lệ nên mình chưa xác nhận và chưa mở thanh toán. Bạn bổ sung đúng thông tin cho dịch vụ này nhé.`,
      };
    }
    current.confirmed = true;
    items[index] = current;

    const nextIndex = items.findIndex((item) => !item.confirmed);
    if (nextIndex >= 0) {
      const next = items[nextIndex];
      const ownedPlots = await this.getOwnedPlots(userId);
      if (ownedPlots.length === 1 && !next.plotId) {
        next.plotId = ownedPlots[0].plotId;
        next.plotCode = ownedPlots[0].plotCode;
      }
      items[nextIndex] = next;
      const nextPending: Extract<
        AgentPendingAction,
        { kind: 'service_order' }
      > = {
        kind: 'service_order',
        operation: 'create',
        stage: 'collecting',
        serviceItems: items,
        activeServiceItemIndex: nextIndex,
        serviceTypeId: next.serviceTypeId,
        serviceName: next.serviceName,
        plotId: next.plotId,
        plotCode: next.plotCode,
        requestedDate: next.requestedDate,
        quotedPrice: next.quotedPrice,
        serviceUnit: next.serviceUnit,
        note: next.note,
      };
      if (!next.plotId && ownedPlots.length > 1) {
        return {
          handled: true,
          intent: 'service_booking',
          pendingAction: nextPending,
          assistantMessage: `Đã xác nhận ngày của **${current.serviceName}**. Tiếp theo là dịch vụ **${next.serviceName}** (${nextIndex + 1}/${items.length}); bạn muốn áp dụng cho lô nào: **${ownedPlots.map((plot) => plot.plotCode).join(', ')}**?`,
          quickReplies: ownedPlots.slice(0, 6).map((plot) => ({
            id: `service-${nextIndex}-plot-${plot.plotId}`,
            label: plot.plotCode,
            message: `Dịch vụ ${next.serviceName} áp dụng cho lô ${plot.plotCode}.`,
            emphasis: 'strong' as const,
          })),
        };
      }
      return {
        handled: true,
        intent: 'service_booking',
        pendingAction: nextPending,
        assistantMessage: [
          `Đã xác nhận ngày **${current.requestedDate}** cho **${current.serviceName}**.`,
          '',
          `Tiếp theo là dịch vụ **${next.serviceName}** (${nextIndex + 1}/${items.length})${next.plotCode ? ` cho lô **${next.plotCode}**` : ''}. **Bạn muốn dịch vụ này được thực hiện vào ngày nào?** Mình vẫn chưa mở thanh toán cho đến khi bạn xác nhận đủ từng dịch vụ.`,
        ].join('\n'),
      };
    }

    const refreshed: Array<{
      item: AgentPendingServiceItem;
      service: ServiceType;
    }> = [];
    for (const item of items) {
      if (!item.serviceTypeId || !item.plotId || !item.requestedDate) {
        throw new BadRequestException('Service queue information is incomplete');
      }
      const service = await this.resolveServiceType(item.serviceTypeId);
      if (!service) {
        throw new BadRequestException(
          `Dịch vụ ${item.serviceName ?? ''} hiện không còn hoạt động.`,
        );
      }
      if (
        item.quotedPrice === undefined ||
        Math.abs(service.basePrice - item.quotedPrice) >= 0.01
      ) {
        item.quotedPrice = service.basePrice;
        item.serviceUnit = service.unit;
        item.serviceName = service.name;
        item.confirmed = false;
        const changedIndex = items.indexOf(item);
        return {
          handled: true,
          intent: 'service_booking',
          pendingAction: {
            ...pending,
            stage: 'awaiting_confirmation',
            serviceItems: items,
            activeServiceItemIndex: changedIndex,
            ...item,
          },
          assistantMessage: `Giá dịch vụ **${service.name}** vừa thay đổi thành **${service.basePrice.toLocaleString('vi-VN')} VND/${service.unit}**. Bạn xác nhận lại dịch vụ này với ngày **${item.requestedDate}** trước khi mình tạo cả nhóm đơn nhé.`,
        };
      }
      refreshed.push({ item, service });
    }

    const created: Array<{
      id?: number;
      item: AgentPendingServiceItem;
      service: ServiceType;
    }> = [];
    for (const entry of refreshed) {
      const result = await this.cemeteryServices.createOrder(userId, {
        serviceTypeId: entry.item.serviceTypeId!,
        plotId: entry.item.plotId!,
        requestedDate: entry.item.requestedDate!,
        note:
          entry.item.note ??
          'Đơn dịch vụ được Trợ lý AI thiết lập theo xác nhận của khách hàng',
      });
      created.push({
        id: this.resultId(result),
        item: entry.item,
        service: entry.service,
      });
    }
    const orderIds = created
      .map((entry) => entry.id)
      .filter((id): id is number => typeof id === 'number');
    const first = created[0];
    return {
      handled: true,
      intent: 'service_booking',
      assistantMessage: [
        `Đã tạo **${created.length} đơn dịch vụ** sau khi bạn xác nhận đủ ngày:`,
        ...created.map(
          (entry) =>
            `- ${entry.id ? `**#${entry.id}** ` : ''}**${entry.service.name}** · lô **${entry.item.plotCode}** · ngày **${entry.item.requestedDate}**`,
        ),
        '',
        'Mình đã mở panel thanh toán cho toàn bộ các đơn. Mỗi đơn sẽ cập nhật realtime riêng; khi ban quản lý duyệt thanh toán, mình sẽ báo và lịch của đúng dịch vụ đó sẽ xuất hiện.',
      ].join('\n'),
      uiDirective: {
        type: 'SHOW_INLINE_SERVICE_PAYMENT',
        serviceTypeId: first.item.serviceTypeId,
        orderId: first.id,
        orderIds,
        amount: created.reduce(
          (total, entry) => total + entry.service.basePrice,
          0,
        ),
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
      pending: 'đang được khóa tạm khi xử lý một yêu cầu mua khác',
      reserved: 'đang trong quy trình hoàn tất mua',
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

  private getApprovedAppointmentPlots(
    userId: number,
  ): Promise<ApprovedAppointmentPlot[]> {
    return this.database.query<ApprovedAppointmentPlot>(
      `SELECT DISTINCT p.plot_id AS "plotId", p.plot_code AS "plotCode",
              z.zone_name AS "zoneName", p.direction,
              p.area_sqm::float AS "areaSqm", p.plot_type AS "plotType",
              EXISTS (
                SELECT 1
                FROM schedule_appointments appointment
                WHERE appointment.requester_id = $1
                  AND appointment.status IN ('pending', 'confirmed')
                  AND (
                    BTRIM(COALESCE(appointment.note, '')) =
                      CONCAT('Hẹn xem lô đất ', p.plot_code)
                    OR (
                      appointment.note ILIKE '%Tư vấn và chọn lô đất%'
                      AND appointment.note ILIKE CONCAT('%', p.plot_code, '%')
                    )
                  )
              ) AS "hasActiveAppointment"
       FROM reservation_requests rr
       JOIN request_plots rp ON rp.request_id = rr.request_id
       JOIN plots p ON p.plot_id = rp.plot_id AND p.is_deleted = FALSE
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE rr.user_id = $1
         AND rr.request_type = 'purchase'
         AND rr.status = 'approved'
         AND rr.is_deleted = FALSE
         AND NOT EXISTS (
           SELECT 1
           FROM purchase_request_cancellations cancellation
           WHERE cancellation.request_id = rr.request_id
             AND cancellation.status IN ('pending', 'approved')
         )
       ORDER BY p.plot_code`,
      [userId],
    );
  }

  private askForAppointmentPlot(
    pending: AgentPendingAction & { kind: 'appointment' },
    plots: ApprovedAppointmentPlot[],
  ): AgentBookingTurn {
    pending.stage = 'collecting';
    pending.selectedPlotCode = undefined;
    return {
      handled: true,
      intent: 'appointment_booking',
      pendingAction: pending,
      assistantMessage: `Tài khoản của bạn có ${plots.length === 1 ? 'lô đã được duyệt' : 'các lô đã được duyệt'}: **${plots.map((plot) => plot.plotCode).join(', ')}**. Bạn muốn hẹn xem lô nào? Nếu muốn xem nhiều lô, hãy nêu các mã lô; mình sẽ hỏi và xác nhận ngày riêng từng lô. Mình không tự chọn thay bạn.`,
      quickReplies: [
        ...(plots.length > 1
          ? [
              {
                id: 'appointment-all-approved-plots',
                label: `Đặt lịch cho tất cả ${plots.length} lô`,
                message:
                  'Mình muốn đặt lịch cho tất cả các lô đã được duyệt. Hãy hỏi ngày và giờ riêng cho từng lô.',
                emphasis: 'strong' as const,
              },
            ]
          : []),
        ...plots.slice(0, 6).map((plot) => ({
          id: `appointment-plot-${plot.plotId}`,
          label: `Chọn lô ${plot.plotCode}`,
          message: `Mình muốn đặt lịch hẹn xem lô ${plot.plotCode}.`,
          emphasis: 'strong' as const,
        })),
      ],
    };
  }

  private wantsAllApprovedAppointmentPlots(userMessage?: string) {
    const message = this.normalize(userMessage ?? '');
    if (!message) return false;
    return /\b(?:tat ca|toan bo|het cac lo|ca cac lo|all)\b/.test(message);
  }

  private findPlotMention(
    userMessage: string | undefined,
    plots: ApprovedAppointmentPlot[],
  ) {
    const message = this.normalize(userMessage ?? '');
    if (!message) return undefined;
    const paddedMessage = ` ${message} `;
    const matches = plots.filter((plot) =>
      paddedMessage.includes(` ${this.normalize(plot.plotCode)} `),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }

  private findPlotMentions(
    userMessage: string | undefined,
    plots: ApprovedAppointmentPlot[],
  ) {
    const message = this.normalize(userMessage ?? '');
    if (!message) return [];
    const paddedMessage = ` ${message} `;
    return plots.filter((plot) =>
      paddedMessage.includes(` ${this.normalize(plot.plotCode)} `),
    );
  }

  private appointmentPurpose(plotCode?: string) {
    return plotCode ? `Hẹn xem lô đất ${plotCode}` : 'Hẹn xem lô đất';
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

  private hasExplicitServiceDate(value: string) {
    const message = this.normalize(value);
    return (
      /\b(?:hom nay|ngay mai|mai|ngay mot|mot|ngay kia|kia)\b/.test(message) ||
      /\b(?:sau|trong)\s+\d{1,3}\s+(?:ngay|hom)\b/.test(message) ||
      /\b\d{1,3}\s+(?:ngay|hom)\s+(?:nua|toi)\b/.test(message) ||
      /\b(?:thu\s*[2-7]|chu nhat)(?:\s+tuan\s+(?:nay|sau))?\b/.test(
        message,
      ) ||
      /\bngay\s+\d{1,2}(?:\s+thang\s+\d{1,2})?(?:\s+nam\s+\d{4})?\b/.test(
        message,
      ) ||
      /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/.test(value) ||
      /\b\d{4}-\d{2}-\d{2}\b/.test(value)
    );
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

  private serviceOrderIdFromMessage(message: string) {
    const hashMatch = message.match(/#\s*(\d{1,10})\b/);
    if (hashMatch) return Number(hashMatch[1]);
    const folded = this.normalize(message);
    const orderMatch = folded.match(
      /\bdon(?: dich vu)?(?: so| ma)?\s+(\d{1,10})\b/,
    );
    return orderMatch ? Number(orderMatch[1]) : undefined;
  }

  private serviceOrderOrdinal(foldedMessage: string) {
    const match = foldedMessage.match(/\b(?:cai|don)?\s*thu\s*(\d+)\b/);
    if (match) return Number(match[1]);
    if (/\b(?:dau tien|thu nhat|cai dau)\b/.test(foldedMessage)) return 1;
    if (/\b(?:thu hai|cai hai|cai 2)\b/.test(foldedMessage)) return 2;
    if (/\b(?:thu ba|cai ba|cai 3)\b/.test(foldedMessage)) return 3;
    return undefined;
  }

  private serviceOrderStatusLabel(order: CustomerServiceOrder) {
    if (order.status === 'in_progress') return 'đang thực hiện';
    if (order.paymentStatus === 'paid') return 'đã thanh toán';
    if (order.paymentStatus === 'awaiting_confirmation') {
      return 'đang chờ duyệt thanh toán';
    }
    if (order.status === 'confirmed') return 'đã được xác nhận';
    return 'chưa thanh toán';
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
