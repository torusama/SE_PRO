export type CaseType = 'TRANSFER' | 'INHERITANCE';

export interface DocumentRequirementPolicy {
  code: string;
  displayName: string;
  description?: string;
  required?: boolean;
}

export interface ChangeRightPolicyConfiguration {
  allow_transfer: boolean;
  allow_gift: boolean;
  allow_inheritance: boolean;
  allow_multiple_holders: false;
  require_legal_review: boolean;
  require_original_inspection: boolean;
  require_finance_clearance: boolean;
  approval_levels: number;
  document_requirements: Partial<Record<CaseType, DocumentRequirementPolicy[]>>;
  contract_template_ids?: Partial<Record<CaseType, string>>;
}

export function policyViolations(config: ChangeRightPolicyConfiguration): string[] {
  const violations: string[] = [];
  if (config.allow_multiple_holders !== false) {
    violations.push('MULTIPLE_HOLDERS_NOT_ALLOWED');
  }
  if (!Number.isInteger(config.approval_levels) || config.approval_levels < 2) {
    violations.push('APPROVAL_LEVELS_TOO_LOW');
  }
  for (const type of ['TRANSFER', 'INHERITANCE'] as const) {
    const enabled = type === 'TRANSFER' ? config.allow_transfer : config.allow_inheritance;
    const requirements = config.document_requirements?.[type] ?? [];
    if (enabled && requirements.length === 0) {
      violations.push(`MISSING_${type}_DOCUMENT_POLICY`);
    }
    const codes = requirements.map((item) => item.code.trim()).filter(Boolean);
    if (new Set(codes).size !== codes.length) {
      violations.push(`DUPLICATE_${type}_REQUIREMENT_CODE`);
    }
  }
  return violations;
}

