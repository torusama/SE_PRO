import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AdminAiActivityQueryDto } from './dto/admin-ai-activity-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { CreateAiDraftDto } from './dto/create-ai-draft.dto';
import { RecommendPlotsDto } from './dto/recommend-plots.dto';
import { PlotRecommendationService } from './plot-recommendation.service';

@Injectable()
export class AiAgentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly recommendations: PlotRecommendationService,
  ) {}

  recommend(dto: RecommendPlotsDto) {
    return this.recommendations.recommend(dto);
  }

  async createDraftReservation(userId: number, dto: CreateAiDraftDto) {
    if (new Set(dto.plotIds).size !== dto.plotIds.length) {
      throw new BadRequestException('Duplicate plot IDs are not allowed');
    }

    return this.database.transaction(async (client) => {
      const plotResult = await client.query<{
        id: number;
        plotCode: string;
        price: number | string;
        status: string;
      }>(
        `SELECT plot_id AS id, plot_code AS "plotCode",
                price::float, status
         FROM plots
         WHERE plot_id = ANY($1::int[]) AND is_deleted = FALSE
         ORDER BY plot_id
         FOR UPDATE`,
        [dto.plotIds],
      );
      const plots = plotResult.rows;
      if (
        plots.length !== dto.plotIds.length ||
        plots.some((plot) => plot.status !== 'available')
      ) {
        throw new BadRequestException('All plots must still be available');
      }

      const totalPrice = plots.reduce(
        (sum, plot) => sum + Number(plot.price),
        0,
      );
      const requestResult = await client.query<{
        id: number;
        status: string;
        totalPrice: number | string;
        createdAt: Date;
      }>(
        `INSERT INTO reservation_requests
           (user_id, request_type, status, total_price, note, is_ai_draft)
         VALUES ($1, 'purchase', 'draft', $2, $3, TRUE)
         RETURNING request_id AS id, status,
                   total_price::float AS "totalPrice",
                   created_at AS "createdAt"`,
        [
          userId,
          totalPrice,
          dto.note ?? 'Draft created from AI recommendation',
        ],
      );
      const request = requestResult.rows[0];

      for (const plot of plots) {
        await client.query(
          `INSERT INTO request_plots (request_id, plot_id, plot_price)
           VALUES ($1, $2, $3)`,
          [request.id, plot.id, plot.price],
        );
      }

      await client.query(
        `UPDATE ai_messages m
         SET metadata = COALESCE(m.metadata, '{}'::jsonb) ||
                        jsonb_build_object('draftRequestId', $2, 'optionId', $3)
         FROM ai_conversations c
         WHERE m.conversation_id = c.conversation_id
           AND c.session_id = $1
           AND m.role = 'assistant'
           AND m.message_id = (
             SELECT MAX(m2.message_id)
             FROM ai_messages m2
             WHERE m2.conversation_id = c.conversation_id
               AND m2.role = 'assistant'
           )`,
        [dto.sessionId, request.id, dto.optionId],
      );

      return {
        ...request,
        totalPrice: Number(request.totalPrice),
        optionId: dto.optionId,
        isAiDraft: true,
        plots: plots.map((plot) => ({
          id: Number(plot.id),
          plotCode: plot.plotCode,
          price: Number(plot.price),
          status: plot.status,
        })),
      };
    });
  }

  async adminActivity(query: AdminAiActivityQueryDto) {
    const values: unknown[] = [];
    const conditions = ['rr.is_ai_draft = TRUE', 'rr.is_deleted = FALSE'];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p})`);
    }
    if (query.status) conditions.push(`rr.status = ${add(query.status)}`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM reservation_requests rr
       JOIN users u ON u.user_id=rr.user_id ${where}`,
      values,
    );
    const limit = add(query.pageSize);
    const offset = add(query.offset);
    const items = await this.database.query(
      `SELECT rr.request_id AS id, rr.status, rr.request_type AS type,
              rr.total_price::float AS "totalPrice", rr.created_at AS "createdAt",
              u.user_id AS "customerId", u.full_name AS "customerName",
              COUNT(rp.plot_id)::int AS "plotCount",
              COALESCE(ARRAY_AGG(p.plot_code ORDER BY p.plot_code)
                FILTER (WHERE p.plot_id IS NOT NULL), '{}') AS "plotCodes"
       FROM reservation_requests rr JOIN users u ON u.user_id=rr.user_id
       LEFT JOIN request_plots rp ON rp.request_id=rr.request_id
       LEFT JOIN plots p ON p.plot_id=rp.plot_id
       ${where} GROUP BY rr.request_id,u.user_id
       ORDER BY rr.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return {
      ...paginate(items, Number(count?.total ?? 0), query.page, query.pageSize),
      capabilities: {
        recommendationTelemetry: false,
        promptHistory: false,
        modelUsage: false,
        retainedData: 'ai_reservation_drafts',
      },
    };
  }

  async adminActivityOne(id: number) {
    const item = await this.database.queryOne(
      `SELECT rr.request_id AS id, rr.status, rr.request_type AS type,
              rr.total_price::float AS "totalPrice", rr.note,
              rr.created_at AS "createdAt", u.user_id AS "customerId",
              u.full_name AS "customerName", u.email AS "customerEmail"
       FROM reservation_requests rr JOIN users u ON u.user_id=rr.user_id
       WHERE rr.request_id=$1 AND rr.is_ai_draft=TRUE AND rr.is_deleted=FALSE`,
      [id],
    );
    if (!item) throw new NotFoundException('AI activity not found');
    return item;
  }
}
