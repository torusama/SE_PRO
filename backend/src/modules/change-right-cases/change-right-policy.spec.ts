import { ChangeRightPolicyConfiguration, policyViolations } from './change-right-policy';

const valid: ChangeRightPolicyConfiguration = {
  allow_transfer: true,
  allow_gift: true,
  allow_inheritance: true,
  allow_multiple_holders: false,
  require_legal_review: true,
  require_original_inspection: true,
  require_finance_clearance: true,
  approval_levels: 2,
  document_requirements: {
    TRANSFER: [{ code: 'SIGNED_SOURCE_CONTRACT', displayName: 'Hợp đồng nguồn' }],
    INHERITANCE: [{ code: 'LEGAL_SUCCESSION_BASIS', displayName: 'Căn cứ thừa kế' }],
  },
};

describe('change-right policy publication guards', () => {
  it('accepts a versioned single-holder policy with requirements', () => {
    expect(policyViolations(valid)).toEqual([]);
  });

  it('blocks publication without official document policies', () => {
    expect(policyViolations({ ...valid, document_requirements: {} })).toEqual([
      'MISSING_TRANSFER_DOCUMENT_POLICY',
      'MISSING_INHERITANCE_DOCUMENT_POLICY',
    ]);
  });

  it('blocks multiple holders and fewer than two approval levels', () => {
    const unsafe = { ...valid, allow_multiple_holders: true, approval_levels: 1 } as unknown as ChangeRightPolicyConfiguration;
    expect(policyViolations(unsafe)).toEqual(expect.arrayContaining([
      'MULTIPLE_HOLDERS_NOT_ALLOWED',
      'APPROVAL_LEVELS_TOO_LOW',
    ]));
  });
});

