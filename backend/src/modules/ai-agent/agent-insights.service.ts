import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RemindersService } from '../reminders/reminders.service';
import { calculatePlotEntranceAccess } from './cemetery-map-access';

type CompetitionLevel = 'low' | 'moderate' | 'high' | 'not_applicable';
type PricePosition =
  'below_median' | 'near_median' | 'above_median' | 'unknown';

interface PlotPressureRow {
  plotId: number;
  plotCode: string;
  status: string;
  zoneName: string;
  plotType: string;
  direction: string | null;
  areaSqm: number | string | null;
  price: number | string;
  availablePeerCount: number | string;
  medianPeerPrice: number | string | null;
  activeRequestCount: number | string;
  recentInterestCount: number | string;
  latestInterestAt: string | null;
}

interface PlotDetailRow {
  plotId: number;
  plotCode: string;
  status: string;
  zoneId: number;
  zoneCode: string;
  zoneName: string;
  zoneDescription: string | null;
  rowNumber: string | null;
  columnNumber: string | null;
  plotType: string;
  direction: string | null;
  areaSqm: number | string | null;
  price: number | string;
  description: string | null;
  imageUrl: string | null;
  reservedUntil: string | null;
  updatedAt: string | null;
}

interface CareSummaryRow {
  ownedPlotCount: number | string;
  activeContractCount: number | string;
  activeRequestCount: number | string;
  activeServiceOrderCount: number | string;
  activeTransferRequestCount: number | string;
  upcomingAppointmentCount: number | string;
  unreadNotificationCount: number | string;
}

interface CareReminder {
  title: string;
  reminderType: string;
  plotCode?: string | null;
  nextDate?: string | null;
  daysUntil?: number | null;
  isActive: boolean;
}

@Injectable()
export class AgentInsightsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly reminders: RemindersService,
  ) {}

  async getPlotDetails(plotCode: string) {
    const normalizedCode = plotCode.trim().toUpperCase();
    const row = await this.database.queryOne<PlotDetailRow>(
      `SELECT p.plot_id AS "plotId", p.plot_code AS "plotCode", p.status,
              p.zone_id AS "zoneId", z.zone_code AS "zoneCode",
              z.zone_name AS "zoneName", z.description AS "zoneDescription",
              p.row_number AS "rowNumber", p.column_number AS "columnNumber",
              p.plot_type AS "plotType", p.direction,
              p.area_sqm::float AS "areaSqm", p.price::float, p.description,
              p.image_url AS "imageUrl", p.reserved_until::text AS "reservedUntil",
              p.updated_at::text AS "updatedAt"
       FROM plots p
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE UPPER(p.plot_code) = $1 AND p.is_deleted = FALSE
       LIMIT 1`,
      [normalizedCode],
    );

    if (!row) {
      return {
        found: false as const,
        plotCode: normalizedCode,
        message: 'Plot code was not found in the current cemetery inventory.',
      };
    }

    const access = calculatePlotEntranceAccess({
      plotCode: row.plotCode,
      zoneName: row.zoneName,
      rowNumber: row.rowNumber,
      columnNumber: row.columnNumber,
    });

    return {
      found: true as const,
      generatedAt: new Date().toISOString(),
      plot: {
        plotId: Number(row.plotId),
        plotCode: row.plotCode,
        status: row.status,
        zoneId: Number(row.zoneId),
        zoneCode: row.zoneCode,
        zoneName: row.zoneName,
        zoneDescription: row.zoneDescription,
        rowNumber: row.rowNumber,
        columnNumber: row.columnNumber,
        plotType: row.plotType,
        direction: row.direction,
        areaSqm: row.areaSqm === null ? null : Number(row.areaSqm),
        listedPrice: Number(row.price),
        currency: 'VND' as const,
        description: row.description,
        imageUrl: row.imageUrl,
        reservedUntil: row.reservedUntil,
        updatedAt: row.updatedAt,
        nearestEntrance: access.nearestEntrance,
        entranceProximity: access.entranceProximity,
        accessSummary:
          access.entranceProximity === 'near'
            ? `Thuộc nhóm gần ${access.nearestEntrance === 'main' ? 'Cổng chính' : 'Cổng phụ'} trên sơ đồ nội khu`
            : access.entranceProximity === 'moderate'
              ? `Khoảng tiếp cận trung bình tới ${access.nearestEntrance === 'main' ? 'Cổng chính' : 'Cổng phụ'} trên sơ đồ nội khu`
              : access.entranceProximity === 'far'
                ? `Nằm sâu hơn so với ${access.nearestEntrance === 'main' ? 'Cổng chính' : 'Cổng phụ'} trên sơ đồ nội khu`
                : null,
      },
      source: 'authoritative_plot_inventory' as const,
    };
  }

  async analyzePlotCompetitiveness(plotCode: string) {
    const normalizedCode = plotCode.trim().toUpperCase();
    const row = await this.database.queryOne<PlotPressureRow>(
      `SELECT p.plot_id AS "plotId", p.plot_code AS "plotCode", p.status,
              z.zone_name AS "zoneName", p.plot_type AS "plotType",
              p.direction, p.area_sqm::float AS "areaSqm", p.price::float,
              (
                SELECT COUNT(*)::int
                FROM plots peer
                WHERE peer.zone_id = p.zone_id
                  AND peer.plot_type = p.plot_type
                  AND peer.status = 'available'
                  AND peer.is_deleted = FALSE
                  AND peer.plot_id <> p.plot_id
              ) AS "availablePeerCount",
              (
                SELECT percentile_cont(0.5) WITHIN GROUP
                         (ORDER BY peer.price)::float
                FROM plots peer
                WHERE peer.zone_id = p.zone_id
                  AND peer.plot_type = p.plot_type
                  AND peer.status = 'available'
                  AND peer.is_deleted = FALSE
                  AND peer.plot_id <> p.plot_id
              ) AS "medianPeerPrice",
              (
                SELECT COUNT(DISTINCT rr.request_id)::int
                FROM request_plots rp
                JOIN reservation_requests rr ON rr.request_id = rp.request_id
                WHERE rp.plot_id = p.plot_id
                  AND rr.is_deleted = FALSE
                  AND rr.request_type = 'purchase'
                  AND rr.status IN ('submitted', 'pending')
              ) AS "activeRequestCount",
              (
                SELECT COUNT(DISTINCT rr.request_id)::int
                FROM request_plots rp
                JOIN reservation_requests rr ON rr.request_id = rp.request_id
                WHERE rp.plot_id = p.plot_id
                  AND rr.is_deleted = FALSE
                  AND rr.request_type = 'purchase'
                  AND rr.status IN ('submitted', 'pending', 'approved')
                  AND rr.created_at >= NOW() - INTERVAL '30 days'
              ) AS "recentInterestCount",
              (
                SELECT MAX(rr.created_at)::text
                FROM request_plots rp
                JOIN reservation_requests rr ON rr.request_id = rp.request_id
                WHERE rp.plot_id = p.plot_id
                  AND rr.is_deleted = FALSE
                  AND rr.request_type = 'purchase'
                  AND rr.status IN ('submitted', 'pending', 'approved')
              ) AS "latestInterestAt"
       FROM plots p
       JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE UPPER(p.plot_code) = $1 AND p.is_deleted = FALSE
       LIMIT 1`,
      [normalizedCode],
    );

    if (!row) {
      return {
        found: false as const,
        plotCode: normalizedCode,
        message: 'Plot code was not found in the current cemetery inventory.',
      };
    }

    const price = Number(row.price);
    const medianPeerPrice =
      row.medianPeerPrice === null ? null : Number(row.medianPeerPrice);
    const availablePeerCount = Number(row.availablePeerCount);
    const activeRequestCount = Number(row.activeRequestCount);
    const recentInterestCount = Number(row.recentInterestCount);
    const priceDifferencePercent =
      medianPeerPrice && medianPeerPrice > 0
        ? Number(
            (((price - medianPeerPrice) / medianPeerPrice) * 100).toFixed(1),
          )
        : null;
    const pricePosition = this.pricePosition(priceDifferencePercent);
    const score = this.competitionScore(
      activeRequestCount,
      recentInterestCount,
      availablePeerCount,
    );
    const level = this.competitionLevel(row.status, score);

    return {
      found: true as const,
      generatedAt: new Date().toISOString(),
      plot: {
        plotCode: row.plotCode,
        status: row.status,
        zoneName: row.zoneName,
        plotType: row.plotType,
        direction: row.direction,
        areaSqm: row.areaSqm === null ? null : Number(row.areaSqm),
        listedPrice: price,
        currency: 'VND' as const,
      },
      internalPressure: {
        level,
        score: level === 'not_applicable' ? null : score,
        activeRequestCount,
        recentInterestCount,
        recentWindowDays: 30,
        latestInterestAt: row.latestInterestAt,
      },
      comparableInventory: {
        scope: 'same_zone_and_plot_type_available_inventory' as const,
        availableAlternativeCount: availablePeerCount,
        medianAlternativeListedPrice: medianPeerPrice,
        pricePosition,
        priceDifferencePercent,
      },
      methodology: {
        highLevelThreshold: 5,
        moderateLevelThreshold: 2,
        scoreComponents: {
          activeRequests:
            activeRequestCount >= 2 ? 3 : activeRequestCount === 1 ? 2 : 0,
          recentInterest:
            recentInterestCount >= 3 ? 2 : recentInterestCount >= 1 ? 1 : 0,
          comparableScarcity:
            availablePeerCount <= 2 ? 2 : availablePeerCount <= 5 ? 1 : 0,
        },
        excludedRequestStatuses: ['draft', 'rejected', 'cancelled'],
      },
      caveats: [
        'This is an internal point-in-time signal from current inventory and plot-purchase-request activity.',
        'It is not an external market appraisal, an investment forecast, or a guarantee that availability will change.',
        'Availability must be checked again before a purchase request is submitted.',
      ],
    };
  }

  async getCustomerCareOverview(userId: number | null) {
    if (!userId) {
      return {
        loginRequired: true as const,
        message:
          'Sign in to view account-specific owned plots, purchase requests, contracts, service orders, transfer/inheritance requests, appointments, reminders, and notifications.',
      };
    }

    const [
      summary,
      ownedPlots,
      requests,
      serviceOrders,
      transferRequests,
      appointments,
      reminders,
      latestNotifications,
    ] = await Promise.all([
      this.database.queryOne<CareSummaryRow>(
        `SELECT
             (SELECT COUNT(*)::int
                FROM ownership_records o
                JOIN contracts c ON c.contract_id = o.contract_id
                JOIN plots p ON p.plot_id = o.plot_id
               WHERE o.user_id = $1 AND o.is_current = TRUE
                 AND c.status = 'active' AND c.is_deleted = FALSE
                 AND p.is_deleted = FALSE) AS "ownedPlotCount",
             (SELECT COUNT(*)::int FROM contracts
               WHERE user_id = $1 AND status = 'active' AND is_deleted = FALSE)
               AS "activeContractCount",
             (SELECT COUNT(*)::int FROM reservation_requests
               WHERE user_id = $1 AND status IN ('draft', 'submitted', 'pending')
                 AND request_type = 'purchase'
                 AND is_deleted = FALSE) AS "activeRequestCount",
             (SELECT COUNT(*)::int FROM service_orders
               WHERE user_id = $1
                 AND status IN ('submitted', 'pending_confirm', 'confirmed', 'in_progress')
                 AND is_deleted = FALSE) AS "activeServiceOrderCount",
             (SELECT COUNT(*)::int FROM reservation_requests
               WHERE user_id = $1 AND request_type = 'transfer'
                 AND status IN ('pending', 'approved')
                 AND is_deleted = FALSE) AS "activeTransferRequestCount",
             (SELECT COUNT(*)::int FROM schedule_appointments
               WHERE requester_id = $1
                 AND status IN ('pending', 'confirmed')
                 AND appointment_date >= CURRENT_DATE)
               AS "upcomingAppointmentCount",
             (SELECT COUNT(*)::int FROM notifications
               WHERE user_id = $1 AND is_read = FALSE)
               AS "unreadNotificationCount"`,
        [userId],
      ),
      this.database.query(
        `SELECT p.plot_code AS "plotCode", z.zone_name AS "zoneName",
                  p.direction, p.plot_type AS "plotType",
                  c.contract_code AS "contractCode",
                  c.status AS "contractStatus",
                  c.payment_status AS "paymentStatus",
                  c.expiry_date::text AS "expiryDate"
           FROM ownership_records o
           JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
           JOIN cemetery_zones z ON z.zone_id = p.zone_id
           JOIN contracts c ON c.contract_id = o.contract_id
                           AND c.status = 'active' AND c.is_deleted = FALSE
           WHERE o.user_id = $1 AND o.is_current = TRUE
           ORDER BY p.plot_code
           LIMIT 10`,
        [userId],
      ),
      this.database.query(
        `SELECT rr.request_type AS type, rr.status,
                  rr.total_price::float AS "totalPrice",
                  COALESCE(ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                    FILTER (WHERE p.plot_id IS NOT NULL), '{}') AS "plotCodes",
                  rr.created_at::text AS "createdAt",
                  rr.reviewed_at::text AS "reviewedAt"
           FROM reservation_requests rr
           LEFT JOIN request_plots rp ON rp.request_id = rr.request_id
           LEFT JOIN plots p ON p.plot_id = rp.plot_id
           WHERE rr.user_id = $1 AND rr.is_deleted = FALSE
             AND rr.request_type = 'purchase'
           GROUP BY rr.request_id
           ORDER BY
             CASE WHEN rr.status IN ('draft', 'submitted', 'pending')
                  THEN 0 ELSE 1 END,
             rr.created_at DESC
           LIMIT 6`,
        [userId],
      ),
      this.database.query(
        `SELECT st.name AS "serviceName", so.status,
                  p.plot_code AS "plotCode", so.amount::float,
                  so.requested_date::text AS "requestedDate",
                  so.scheduled_date::text AS "scheduledDate",
                  so.created_at::text AS "createdAt"
           FROM service_orders so
           JOIN service_types st ON st.service_type_id = so.service_type_id
           LEFT JOIN plots p ON p.plot_id = so.plot_id
           WHERE so.user_id = $1 AND so.is_deleted = FALSE
           ORDER BY
             CASE WHEN so.status IN (
               'submitted', 'pending_confirm', 'confirmed', 'in_progress'
             ) THEN 0 ELSE 1 END,
             so.created_at DESC
           LIMIT 6`,
        [userId],
      ),
      this.database.query(
        `SELECT rr.request_id AS id, rr.transfer_type AS "transferType", rr.status,
                  trd.recipient_full_name AS "recipientName",
                  rr.admin_note AS "adminNote",
                  COALESCE((
                    SELECT ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                    FROM request_plots rp
                    JOIN plots p ON p.plot_id = rp.plot_id
                    WHERE rp.request_id = rr.request_id
                  ), '{}') AS "plotCodes",
                  appointment.scheduled_at::text AS "appointmentStart",
                  appointment.scheduled_end_at::text AS "appointmentEnd",
                  appointment.location AS "appointmentLocation",
                  appointment.customer_status AS "appointmentCustomerStatus",
                  contract.contract_code AS "contractCode",
                  contract.status AS "contractStatus",
                  contract.payment_status AS "paymentStatus",
                  contract.total_amount::float AS "contractTotalAmount",
                  contract.paid_amount::float AS "contractPaidAmount",
                  rr.created_at::text AS "createdAt",
                  rr.reviewed_at::text AS "reviewedAt"
           FROM reservation_requests rr
           JOIN transfer_request_details trd ON trd.request_id = rr.request_id
           LEFT JOIN LATERAL (
             SELECT oa.scheduled_at, oa.scheduled_end_at, oa.location,
                    oa.customer_status
             FROM offline_appointments oa
             WHERE oa.request_id = rr.request_id AND oa.is_deleted = FALSE
             ORDER BY oa.created_at DESC
             LIMIT 1
           ) appointment ON TRUE
           LEFT JOIN LATERAL (
             SELECT c.contract_code, c.status, c.payment_status,
                    c.total_amount, c.paid_amount
             FROM contracts c
             WHERE c.request_id = rr.request_id AND c.is_deleted = FALSE
             ORDER BY c.created_at DESC
             LIMIT 1
           ) contract ON TRUE
           WHERE rr.user_id = $1 AND rr.request_type = 'transfer'
             AND rr.is_deleted = FALSE
           ORDER BY
             CASE WHEN rr.status IN ('pending', 'approved') THEN 0 ELSE 1 END,
             rr.created_at DESC
           LIMIT 6`,
        [userId],
      ),
      this.database.query(
        `SELECT a.appointment_date::text AS date,
                  a.start_time::text AS "startTime",
                  a.end_time::text AS "endTime",
                  a.status, a.note, host.full_name AS "hostName"
           FROM schedule_appointments a
           JOIN users host ON host.user_id = a.host_user_id
           WHERE a.requester_id = $1
             AND a.status IN ('pending', 'confirmed')
             AND a.appointment_date >= CURRENT_DATE
           ORDER BY a.appointment_date, a.start_time
           LIMIT 5`,
        [userId],
      ),
      this.reminders.my(userId),
      this.database.query(
        `SELECT notification_id AS id, type, title, message,
                  is_read AS "isRead", created_at::text AS "createdAt"
           FROM notifications
           WHERE user_id = $1
           ORDER BY is_read ASC, created_at DESC
           LIMIT 5`,
        [userId],
      ),
    ]);

    const upcomingReminders = (reminders as CareReminder[])
      .filter(
        (reminder) =>
          reminder.isActive &&
          reminder.nextDate !== null &&
          reminder.daysUntil !== null,
      )
      .slice(0, 5)
      .map((reminder) => ({
        title: reminder.title,
        reminderType: reminder.reminderType,
        plotCode: reminder.plotCode ?? null,
        nextDate: reminder.nextDate ?? null,
        daysUntil: reminder.daysUntil ?? null,
      }));

    return {
      loginRequired: false as const,
      generatedAt: new Date().toISOString(),
      summary: {
        ownedPlotCount: Number(summary?.ownedPlotCount ?? 0),
        activeContractCount: Number(summary?.activeContractCount ?? 0),
        activeRequestCount: Number(summary?.activeRequestCount ?? 0),
        activeServiceOrderCount: Number(summary?.activeServiceOrderCount ?? 0),
        activeTransferRequestCount: Number(
          summary?.activeTransferRequestCount ?? 0,
        ),
        upcomingAppointmentCount: Number(
          summary?.upcomingAppointmentCount ?? 0,
        ),
        unreadNotificationCount: Number(summary?.unreadNotificationCount ?? 0),
        activeReminderCount: (reminders as CareReminder[]).filter(
          (reminder) => reminder.isActive,
        ).length,
      },
      ownedPlots,
      reservationRequests: requests,
      serviceOrders,
      transferRequests,
      upcomingAppointments: appointments,
      upcomingReminders,
      latestNotifications,
      limitations: [
        'Only records belonging to the authenticated account are included; identity-document contents are intentionally excluded from chat context.',
        'Statuses are a point-in-time view and may change after staff processing.',
      ],
    };
  }

  private pricePosition(differencePercent: number | null): PricePosition {
    if (differencePercent === null) return 'unknown';
    if (differencePercent < -5) return 'below_median';
    if (differencePercent > 5) return 'above_median';
    return 'near_median';
  }

  private competitionScore(
    activeRequestCount: number,
    recentInterestCount: number,
    availablePeerCount: number,
  ) {
    const activeScore =
      activeRequestCount >= 2 ? 3 : activeRequestCount === 1 ? 2 : 0;
    const recentScore =
      recentInterestCount >= 3 ? 2 : recentInterestCount >= 1 ? 1 : 0;
    const scarcityScore =
      availablePeerCount <= 2 ? 2 : availablePeerCount <= 5 ? 1 : 0;
    return activeScore + recentScore + scarcityScore;
  }

  private competitionLevel(status: string, score: number): CompetitionLevel {
    if (!['available', 'pending'].includes(status)) return 'not_applicable';
    if (score >= 5) return 'high';
    if (score >= 2) return 'moderate';
    return 'low';
  }
}
