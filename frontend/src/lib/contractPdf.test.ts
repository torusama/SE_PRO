import { describe, expect, it } from 'vitest'
import { composeContractDocument, createContractPdfElement } from './contractPdf'

describe('composeContractDocument', () => {
  const base = 'ĐIỀU 1. ĐỐI TƯỢNG\nLô A và lô B\n\nĐIỀU 3. QUYỀN VÀ NGHĨA VỤ\nGiữ nguyên\n\nĐIỀU 5. THỜI HẠN\nNội dung'

  it('uses article 6 for general terms when inheritance is empty', () => {
    const result = composeContractDocument(base, '')
    expect(result).not.toContain('THÔNG TIN/NGUYỆN VỌNG VỀ THỪA KẾ')
    expect(result).toContain('ĐIỀU 6. ĐIỀU KHOẢN CHUNG')
  })

  it('shows inheritance as article 6 and general terms as article 7', () => {
    const result = composeContractDocument(base, 'Giao cho người thừa kế hợp pháp')
    expect(result).toContain('ĐIỀU 6. THÔNG TIN/NGUYỆN VỌNG VỀ THỪA KẾ')
    expect(result).toContain('Giao cho người thừa kế hợp pháp')
    expect(result).toContain('ĐIỀU 7. ĐIỀU KHOẢN CHUNG')
  })

  it('replaces the legacy article 6 placeholder instead of appending to it', () => {
    const legacy = `${base}\n\nĐIỀU 6. THÔNG TIN CŨ\n[ĐỂ TRỐNG - CHỈ ADMIN CẬP NHẬT]`
    const result = composeContractDocument(legacy, 'Nội dung mới')
    expect(result).not.toContain('CHỈ ADMIN CẬP NHẬT')
    expect(result.match(/ĐIỀU 6\./gu)).toHaveLength(1)
    expect(result).toContain('Nội dung mới')
  })

  it('upgrades legacy articles 1 and 2 from the current plot data', () => {
    const legacy = `${base}\n\nĐIỀU 6. THÔNG TIN CŨ\n[ĐỂ TRỐNG]`
    const result = composeContractDocument(legacy, '', [
      { code: 'A-01', zoneName: 'Khu A', areaSqm: 5, agreedPrice: 12000000 },
    ])
    expect(result).toContain('1. Lô A-01, Khu A, diện tích 5 m².')
    expect(result).toContain('1. Lô A-01: 12.000.000 đồng.')
  })

  it('builds a formal A4-style document with headings and two signature columns', () => {
    const element = createContractPdfElement({
      contractCode: 'HD-2026-01',
      contractDate: '2026-08-03',
      contractContent: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc

HỢP ĐỒNG DỊCH VỤ
Số: HD-2026-01

BÊN A - ĐƠN VỊ CUNG CẤP
Tên: Vĩnh Phúc Viên

ĐIỀU 1. ĐỐI TƯỢNG HỢP ĐỒNG
Nội dung hợp đồng.

ĐẠI DIỆN BÊN A                              BÊN B
(Ký, ghi rõ họ tên, chức vụ, đóng dấu)       (Ký, ghi rõ họ tên)`,
    })

    expect(element.dataset.contractPdf).toBe('true')
    expect(element.querySelector('h1')).toHaveTextContent('HỢP ĐỒNG DỊCH VỤ')
    expect(element.querySelector('h2')).toHaveTextContent('BÊN A - ĐƠN VỊ CUNG CẤP')
    expect(element).toHaveTextContent('Ngày 03 tháng 08 năm 2026')
    expect(element.querySelector('[data-pdf-section="signatures"]')?.children).toHaveLength(2)
    expect(
      Array.from(element.querySelectorAll('h1, h2, p')).every((textElement) =>
        (textElement as HTMLElement).style.getPropertyPriority('color') === 'important'
        && (textElement as HTMLElement).style.color === 'rgb(0, 0, 0)',
      ),
    ).toBe(true)
  })
})
