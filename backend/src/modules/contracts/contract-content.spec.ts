import {
  composeContractContent,
  extractContractBaseContent,
  upgradePurchaseContractBase,
} from './contract-content';

describe('contract content composition', () => {
  const base =
    'ĐIỀU 1. ĐỐI TƯỢNG\nNội dung\n\nĐIỀU 3. QUYỀN VÀ NGHĨA VỤ\nGiữ nguyên\n\nĐIỀU 5. THỜI HẠN\nNội dung';

  it('omits inheritance and numbers general terms as article 6 when empty', () => {
    const content = composeContractContent(base, '');
    expect(content).not.toContain('THÔNG TIN/NGUYỆN VỌNG VỀ THỪA KẾ');
    expect(content).toContain('ĐIỀU 6. ĐIỀU KHOẢN CHUNG');
  });

  it('adds inheritance as article 6 and renumbers general terms to article 7', () => {
    const content = composeContractContent(base, 'Nguyện vọng của khách hàng');
    expect(content).toContain(
      'ĐIỀU 6. THÔNG TIN/NGUYỆN VỌNG VỀ THỪA KẾ',
    );
    expect(content).toContain('Nguyện vọng của khách hàng');
    expect(content).toContain('ĐIỀU 7. ĐIỀU KHOẢN CHUNG');
  });

  it('extracts the stable base from legacy generated content', () => {
    expect(
      extractContractBaseContent(`${base}\n\nĐIỀU 6. ĐIỀU KHOẢN CHUNG\nCũ`),
    ).toBe(base);
  });

  it('removes the legacy article 6 before composing the current template', () => {
    const legacy = `${base}\n\nĐIỀU 6. THÔNG TIN CŨ\n[ĐỂ TRỐNG - CHỈ ADMIN CẬP NHẬT]`;
    const content = composeContractContent(legacy, 'Nội dung mới');
    expect(content).not.toContain('CHỈ ADMIN CẬP NHẬT');
    expect(content.match(/ĐIỀU 6\./gu)).toHaveLength(1);
    expect(content).toContain('Nội dung mới');
  });

  it('upgrades articles 1 and 2 from system plot data while preserving article 3 onward', () => {
    const upgraded = upgradePurchaseContractBase(base, [
      { code: 'A-01', zoneName: 'Khu A', areaSqm: 5, price: 12000000 },
      { code: 'A-02', zoneName: 'Khu A', areaSqm: 6, price: 15000000 },
    ]);
    expect(upgraded).toContain('1. Lô A-01, Khu A, diện tích 5 m².');
    expect(upgraded).toContain('2. Lô A-02: 15.000.000 đồng.');
    expect(upgraded).toContain('Tổng giá trị hợp đồng: 27.000.000 đồng.');
    expect(upgraded).toContain('ĐIỀU 3.');
  });
});
