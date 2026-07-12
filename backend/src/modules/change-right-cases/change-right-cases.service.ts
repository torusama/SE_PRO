import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import {
  CaseType,
  ChangeRightPolicyConfiguration,
  policyViolations,
} from './change-right-policy';
import { CreateChangeRightCaseDto } from './dto/create-change-right-case.dto';
import { CreatePolicyVersionDto } from './dto/create-policy-version.dto';

@Injectable()
export class ChangeRightCasesService {
  constructor(private readonly database: DatabaseService) {}

  listPolicies() {
    return this.database.query(
      `SELECT policy_version_id AS id, code, version, status,
              effective_from AS "effectiveFrom", effective_to AS "effectiveTo",
              configuration_json AS configuration, created_by AS "createdBy",
              approved_by AS "approvedBy", created_at AS "createdAt",
              published_at AS "publishedAt"
       FROM change_right_policy_versions ORDER BY code, version DESC`,
    );
  }

  async createPolicyVersion(adminId: number, dto: CreatePolicyVersionDto) {
    this.assertSingleHolderPolicy(dto.configuration);
    return this.database.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `change-right-policy:${dto.code.trim()}`,
      ]);
      const latest = await client.query<{ version: number }>(
        `SELECT COALESCE(MAX(version), 0)::int AS version
         FROM change_right_policy_versions WHERE code = $1`,
        [dto.code.trim()],
      );
      const version = latest.rows[0].version + 1;
      const result = await client.query(
        `INSERT INTO change_right_policy_versions
           (code, version, configuration_json, created_by)
         VALUES ($1, $2, $3::jsonb, $4)
         RETURNING policy_version_id AS id, code, version, status,
                   configuration_json AS configuration`,
        [dto.code.trim(), version, JSON.stringify(dto.configuration), adminId],
      );
      return result.rows[0];
    });
  }

  async publishPolicy(adminId: number, id: number) {
    return this.database.transaction(async (client) => {
      const found = await client.query<{
        policy_version_id: number;
        code: string;
        status: string;
        created_by: number;
        configuration_json: ChangeRightPolicyConfiguration;
      }>(
        `SELECT policy_version_id, code, status, created_by, configuration_json
         FROM change_right_policy_versions WHERE policy_version_id = $1 FOR UPDATE`,
        [id],
      );
      const policy = found.rows[0];
      if (!policy) throw new NotFoundException('POLICY_VERSION_NOT_FOUND');
      if (policy.status !== 'DRAFT') throw new ConflictException('POLICY_NOT_DRAFT');
      if (Number(policy.created_by) === adminId) {
        throw new ConflictException('MAKER_CHECKER_CONFLICT');
      }
      const violations = policyViolations(policy.configuration_json);
      if (violations.length) {
        throw new BadRequestException({ code: 'POLICY_NOT_PUBLISHABLE', violations });
      }
      await client.query(
        `UPDATE change_right_policy_versions
         SET status = 'RETIRED', effective_to = NOW()
         WHERE code = $1 AND status = 'PUBLISHED' AND effective_to IS NULL`,
        [policy.code],
      );
      const result = await client.query(
        `UPDATE change_right_policy_versions
         SET status = 'PUBLISHED', effective_from = NOW(), published_at = NOW(), approved_by = $2
         WHERE policy_version_id = $1
         RETURNING policy_version_id AS id, code, version, status,
                   configuration_json AS configuration, effective_from AS "effectiveFrom"`,
        [id, adminId],
      );
      return result.rows[0];
    });
  }

  listMine(userId: number) {
    return this.database.query(
      `${this.caseSelect()} WHERE c.created_by_user_id = $1 ORDER BY c.created_at DESC`,
      [userId],
    );
  }

  async getMine(userId: number, caseId: string) {
    const result = await this.database.queryOne(
      `${this.caseSelect()} WHERE c.case_id = $1 AND c.created_by_user_id = $2`,
      [caseId, userId],
    );
    if (!result) throw new NotFoundException('CASE_NOT_FOUND');
    return result;
  }

  async createDraft(userId: number, dto: CreateChangeRightCaseDto) {
    const source = await this.database.queryOne<{
      contract_id: number;
      plot_id: number;
      holder_user_id: number;
    }>(
      `SELECT c.contract_id, c.plot_id, urr.holder_user_id
       FROM contracts c
       JOIN usage_right_records urr ON urr.contract_id = c.contract_id
         AND urr.plot_id = c.plot_id AND urr.status = 'ACTIVE'
       WHERE c.contract_id = $1 AND c.plot_id = $2
         AND c.status = 'active' AND c.is_deleted = FALSE`,
      [dto.sourceContractId, dto.plotId],
    );
    if (!source) throw new BadRequestException('SOURCE_CONTRACT_NOT_ACTIVE');
    if (dto.caseType === 'TRANSFER' && Number(source.holder_user_id) !== userId) {
      throw new ForbiddenException('APPLICANT_NOT_AUTHORIZED');
    }
    const id = randomUUID();
    return this.database.queryOne(
      `INSERT INTO change_right_cases
         (case_id, case_type, plot_id, source_contract_id, created_by_user_id, customer_reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING case_id AS id, case_type AS "caseType", status, plot_id AS "plotId",
                 source_contract_id AS "sourceContractId", lock_version AS "lockVersion"`,
      [id, dto.caseType, dto.plotId, dto.sourceContractId, userId, dto.customerReason ?? null],
    );
  }

  async submit(userId: number, caseId: string, expectedLockVersion: number) {
    return this.database.transaction(async (client) => {
      const found = await client.query<any>(
        `SELECT c.*, p.plot_code, p.status AS plot_status,
                ct.contract_code, ct.status AS contract_status, ct.contract_date,
                urr.usage_right_record_id, urr.holder_user_id, urr.effective_from,
                u.full_name AS holder_name,
                RIGHT(COALESCE(u.id_card_number, ''), 4) AS identity_last4
         FROM change_right_cases c
         JOIN plots p ON p.plot_id = c.plot_id
         JOIN contracts ct ON ct.contract_id = c.source_contract_id
         JOIN usage_right_records urr ON urr.plot_id = c.plot_id AND urr.status = 'ACTIVE'
         JOIN users u ON u.user_id = urr.holder_user_id
         WHERE c.case_id = $1 AND c.created_by_user_id = $2 FOR UPDATE OF c, p, ct, urr`,
        [caseId, userId],
      );
      const item = found.rows[0];
      if (!item) throw new NotFoundException('CASE_NOT_FOUND');
      if (item.status !== 'DRAFT') throw new ConflictException('CASE_NOT_DRAFT');
      if (Number(item.lock_version) !== expectedLockVersion) {
        throw new ConflictException('CASE_STATE_CONFLICT');
      }
      if (item.contract_status !== 'active') throw new ConflictException('SOURCE_CONTRACT_NOT_ACTIVE');
      if (item.case_type === 'TRANSFER' && Number(item.holder_user_id) !== userId) {
        throw new ForbiddenException('APPLICANT_NOT_AUTHORIZED');
      }
      const policyResult = await client.query<any>(
        `SELECT * FROM change_right_policy_versions
         WHERE status = 'PUBLISHED' AND effective_from <= NOW()
           AND (effective_to IS NULL OR effective_to > NOW())
         ORDER BY effective_from DESC LIMIT 1`,
      );
      const policy = policyResult.rows[0];
      if (!policy) throw new ConflictException('POLICY_VERSION_MISMATCH');
      const config = policy.configuration_json as ChangeRightPolicyConfiguration;
      this.assertCaseAllowed(item.case_type, config);
      const requirements = config.document_requirements?.[item.case_type as CaseType] ?? [];
      if (!requirements.length) throw new ConflictException('MISSING_REQUIRED_DOCUMENT_POLICY');

      const competing = await client.query(
        `SELECT 1 FROM change_right_cases
         WHERE plot_id = $1 AND case_id <> $2
           AND status NOT IN ('DRAFT','APPROVED','REJECTED','WITHDRAWN','CANCELLED','ARCHIVED')
         LIMIT 1`,
        [item.plot_id, caseId],
      );
      if (competing.rowCount) throw new ConflictException('ACTIVE_CASE_ALREADY_EXISTS');

      const now = new Date();
      const year = now.getUTCFullYear();
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `change-right-case-code:${year}`,
      ]);
      const sequence = await client.query<{ value: string }>(
        `SELECT LPAD((COUNT(*) + 1)::text, 6, '0') AS value
         FROM change_right_cases WHERE submitted_at >= $1 AND submitted_at < $2`,
        [`${year}-01-01`, `${year + 1}-01-01`],
      );
      const caseCode = `CR-${year}-${sequence.rows[0].value}`;
      const plotSnapshot = { plot_id: item.plot_id, plot_code: item.plot_code, usage_status: item.plot_status };
      const contractSnapshot = { contract_id: item.source_contract_id, contract_number: item.contract_code, signed_at: item.contract_date };
      const holderSnapshot = { usage_right_record_id: item.usage_right_record_id, holder_id: item.holder_user_id, holder_name: item.holder_name, identity_last4: item.identity_last4, effective_from: item.effective_from, co_holders: [] };

      for (const requirement of requirements) {
        await client.query(
          `INSERT INTO change_right_case_requirements
             (requirement_id, case_id, requirement_code, display_name, description,
              is_required, policy_item_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [randomUUID(), caseId, requirement.code, requirement.displayName,
            requirement.description ?? null, requirement.required !== false, policy.version],
        );
      }
      await client.query(
        `INSERT INTO change_right_plot_locks (plot_lock_id, plot_id, case_id, lock_type)
         VALUES ($1,$2,$3,$4)`,
        [randomUUID(), item.plot_id, caseId,
          item.case_type === 'INHERITANCE' ? 'INHERITANCE_REVIEW_LOCK' : 'TRANSFER_REVIEW_LOCK'],
      );
      const updated = await client.query(
        `UPDATE change_right_cases SET case_code=$2, status='SUBMITTED', submitted_by_user_id=$3,
           policy_version_id=$4, plot_snapshot_json=$5::jsonb, contract_snapshot_json=$6::jsonb,
           current_holder_snapshot_json=$7::jsonb, submitted_at=NOW(), lock_version=lock_version+1,
           updated_at=NOW()
         WHERE case_id=$1
         RETURNING case_id AS id, case_code AS "caseCode", case_type AS "caseType", status,
                   submitted_at AS "submittedAt", lock_version AS "lockVersion"`,
        [caseId, caseCode, userId, policy.policy_version_id, JSON.stringify(plotSnapshot),
          JSON.stringify(contractSnapshot), JSON.stringify(holderSnapshot)],
      );
      await client.query(
        `INSERT INTO change_right_audit_events
           (audit_event_id, actor_user_id, action, aggregate_type, aggregate_id, case_id, after_json)
         VALUES ($1,$2,'ChangeRightCaseSubmitted','ChangeOfUsageRightCase',$3,$3,$4::jsonb)`,
        [randomUUID(), userId, caseId, JSON.stringify({ caseCode, status: 'SUBMITTED' })],
      );
      await client.query(
        `INSERT INTO change_right_outbox_events (outbox_event_id,event_type,aggregate_id,payload_json)
         VALUES ($1,'ChangeRightCaseSubmitted',$2,$3::jsonb)`,
        [randomUUID(), caseId, JSON.stringify({ caseId, caseCode, userId })],
      );
      return updated.rows[0];
    });
  }

  private assertSingleHolderPolicy(config: ChangeRightPolicyConfiguration) {
    if (config.allow_multiple_holders !== false) {
      throw new BadRequestException('MULTIPLE_HOLDERS_NOT_ALLOWED');
    }
  }

  private assertCaseAllowed(type: CaseType, config: ChangeRightPolicyConfiguration) {
    this.assertSingleHolderPolicy(config);
    if (type === 'TRANSFER' && !config.allow_transfer) throw new BadRequestException('PLOT_NOT_ELIGIBLE');
    if (type === 'INHERITANCE' && !config.allow_inheritance) throw new BadRequestException('PLOT_NOT_ELIGIBLE');
  }

  private caseSelect() {
    return `SELECT c.case_id AS id, c.case_code AS "caseCode", c.case_type AS "caseType",
      c.status, c.status_reason_code AS "statusReasonCode", c.customer_reason AS "customerReason",
      c.plot_id AS "plotId", p.plot_code AS "plotCode", c.source_contract_id AS "sourceContractId",
      ct.contract_code AS "sourceContractCode", c.submitted_at AS "submittedAt",
      c.lock_version AS "lockVersion", c.created_at AS "createdAt"
      FROM change_right_cases c JOIN plots p ON p.plot_id=c.plot_id
      JOIN contracts ct ON ct.contract_id=c.source_contract_id`;
  }
}
