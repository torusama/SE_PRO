import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  CustomerAdminProposal,
  CustomerAdminProposalType,
} from './agent-planner';
import { AgentToolContext } from './tools/agent-tool.types';

export type CustomerProposalPersistenceStatus =
  | 'stored'
  | 'duplicate'
  | 'error';

export interface CustomerProposalPersistenceResult {
  status: CustomerProposalPersistenceStatus;
  proposalId?: number;
}

interface ProposalRow extends QueryResultRow {
  proposalId: number | string;
  conversationId: number | string | null;
  sourceMessageId: number | string | null;
  userId: number | string | null;
  proposalType: CustomerAdminProposalType;
  subject: string;
  content: string;
  selectedPlotCode: string | null;
  serviceName: string | null;
  proposedAmountVnd: number | string | null;
  status: 'pending' | 'accepted' | 'rejected';
  reviewNote: string | null;
  reviewedBy: number | string | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  sourceMessage: string | null;
}

@Injectable()
export class CustomerProposalService {
  private readonly logger = new Logger(CustomerProposalService.name);

  constructor(private readonly database: DatabaseService) {}

  async create(
    proposal: CustomerAdminProposal | undefined,
    context: AgentToolContext,
  ): Promise<CustomerProposalPersistenceResult | undefined> {
    if (!proposal) return undefined;

    try {
      const row = await this.database.queryOne<{ id: number | string }>(
        `INSERT INTO ai_customer_proposals
           (conversation_id, source_message_id, user_id, proposal_type,
            subject, content, selected_plot_code, service_name,
            proposed_amount_vnd, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
         ON CONFLICT (source_message_id)
           WHERE source_message_id IS NOT NULL
         DO NOTHING
         RETURNING proposal_id AS id`,
        [
          context.conversationId,
          context.sourceMessageId,
          context.userId,
          proposal.proposalType,
          proposal.subject,
          proposal.content,
          proposal.selectedPlotCode ?? null,
          proposal.serviceName ?? null,
          proposal.proposedAmountVnd ?? null,
        ],
      );
      if (row?.id) {
        return { status: 'stored', proposalId: Number(row.id) };
      }
      if (context.sourceMessageId !== null) {
        const existing = await this.database.queryOne<{ id: number | string }>(
          `SELECT proposal_id AS id
           FROM ai_customer_proposals
           WHERE source_message_id = $1`,
          [context.sourceMessageId],
        );
        if (existing?.id) {
          return { status: 'duplicate', proposalId: Number(existing.id) };
        }
      }
      return { status: 'error' };
    } catch (error) {
      this.logger.error(
        `[customer proposal] Could not persist proposal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { status: 'error' };
    }
  }

  async list(status = 'pending') {
    const normalized = ['pending', 'accepted', 'rejected', 'all'].includes(
      status,
    )
      ? status
      : 'pending';
    const rows = await this.database.query<ProposalRow>(
      `${this.selectSql()}
       ${normalized === 'all' ? '' : 'WHERE p.status = $1'}
       ORDER BY p.created_at DESC, p.proposal_id DESC
       LIMIT 250`,
      normalized === 'all' ? [] : [normalized],
    );
    return rows.map((row) => this.toPublic(row));
  }

  async review(
    proposalId: number,
    adminId: number,
    action: 'accept' | 'reject',
    reviewNote?: string,
  ) {
    const status = action === 'accept' ? 'accepted' : 'rejected';
    const updated = await this.database.queryOne<ProposalRow>(
      `UPDATE ai_customer_proposals
       SET status = $2,
           review_note = $3,
           reviewed_by = $4,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE proposal_id = $1
         AND status = 'pending'
       RETURNING
         proposal_id AS "proposalId",
         conversation_id AS "conversationId",
         source_message_id AS "sourceMessageId",
         user_id AS "userId",
         proposal_type AS "proposalType",
         subject,
         content,
         selected_plot_code AS "selectedPlotCode",
         service_name AS "serviceName",
         proposed_amount_vnd AS "proposedAmountVnd",
         status,
         review_note AS "reviewNote",
         reviewed_by AS "reviewedBy",
         reviewed_at AS "reviewedAt",
         created_at AS "createdAt",
         updated_at AS "updatedAt",
         NULL::text AS "sourceMessage"`,
      [proposalId, status, reviewNote?.trim() || null, adminId],
    );
    if (!updated) {
      const existing = await this.database.queryOne<{ id: number | string }>(
        `SELECT proposal_id AS id FROM ai_customer_proposals WHERE proposal_id = $1`,
        [proposalId],
      );
      if (!existing) throw new NotFoundException('Customer proposal not found');
      throw new NotFoundException('Customer proposal is no longer pending');
    }
    return this.toPublic(updated);
  }

  private selectSql() {
    return `SELECT
       p.proposal_id AS "proposalId",
       p.conversation_id AS "conversationId",
       p.source_message_id AS "sourceMessageId",
       p.user_id AS "userId",
       p.proposal_type AS "proposalType",
       p.subject,
       p.content,
       p.selected_plot_code AS "selectedPlotCode",
       p.service_name AS "serviceName",
       p.proposed_amount_vnd AS "proposedAmountVnd",
       p.status,
       p.review_note AS "reviewNote",
       p.reviewed_by AS "reviewedBy",
       p.reviewed_at AS "reviewedAt",
       p.created_at AS "createdAt",
       p.updated_at AS "updatedAt",
       m.content AS "sourceMessage"
     FROM ai_customer_proposals p
     LEFT JOIN ai_messages m ON m.message_id = p.source_message_id`;
  }

  private toPublic(row: ProposalRow) {
    return {
      proposalId: Number(row.proposalId),
      conversationId:
        row.conversationId === null ? null : Number(row.conversationId),
      sourceMessageId:
        row.sourceMessageId === null ? null : Number(row.sourceMessageId),
      userId: row.userId === null ? null : Number(row.userId),
      proposalType: row.proposalType,
      subject: row.subject,
      content: row.content,
      selectedPlotCode: row.selectedPlotCode,
      serviceName: row.serviceName,
      proposedAmountVnd:
        row.proposedAmountVnd === null ? null : Number(row.proposedAmountVnd),
      status: row.status,
      reviewNote: row.reviewNote,
      reviewedBy: row.reviewedBy === null ? null : Number(row.reviewedBy),
      reviewedAt:
        row.reviewedAt instanceof Date
          ? row.reviewedAt.toISOString()
          : row.reviewedAt,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : row.updatedAt,
      sourceMessage: row.sourceMessage,
    };
  }
}
