interface ContractPdfData {
  contractCode: string
  contractContent?: string | null
}

const GENERAL_TERMS = 'Hai bên đã đọc, hiểu, tự nguyện ký và chịu trách nhiệm về thông tin cung cấp. Hợp đồng được lập thành các bản có giá trị như nhau.'
const SIGNATURE_BLOCK = `ĐẠI DIỆN BÊN A                              BÊN B
(Ký, ghi rõ họ tên, chức vụ, đóng dấu)       (Ký, ghi rõ họ tên)`

interface ContractDocumentPlot {
  code: string
  zoneName?: string | null
  areaSqm?: number | null
  agreedPrice: number
}

function upgradePurchaseBase(baseContent: string, plots: ContractDocumentPlot[]) {
  if (!plots.length) return baseContent
  const article1 = /ĐIỀU\s+1\s*\./iu.exec(baseContent)
  const article3 = /ĐIỀU\s+3\s*\./iu.exec(baseContent)
  if (!article1 || !article3 || article3.index <= article1.index) return baseContent
  const details = plots.map((plot, index) =>
    `${index + 1}. Lô ${plot.code}${plot.zoneName ? `, ${plot.zoneName}` : ''}, diện tích ${plot.areaSqm ?? '...'} m².`,
  ).join('\n')
  const prices = plots.map((plot, index) =>
    `${index + 1}. Lô ${plot.code}: ${Number(plot.agreedPrice).toLocaleString('vi-VN')} đồng.`,
  ).join('\n')
  const total = plots.reduce((sum, plot) => sum + Number(plot.agreedPrice), 0).toLocaleString('vi-VN')
  const articles = `ĐIỀU 1. ĐỐI TƯỢNG HỢP ĐỒNG
Bên A cung cấp cho Bên B quyền sử dụng các vị trí phần mộ sau theo dữ liệu hệ thống:
${details}
Các vị trí trên được sử dụng theo quy hoạch và quy chế quản lý nghĩa trang. Hợp đồng này không mặc nhiên là hợp đồng chuyển nhượng quyền sử dụng đất.

ĐIỀU 2. GIÁ TRỊ VÀ THANH TOÁN
${prices}
Tổng giá trị hợp đồng: ${total} đồng. Thời hạn, phương thức và chứng từ thanh toán thực hiện theo thỏa thuận/phiếu thu hợp lệ của hai bên.`
  return [baseContent.slice(0, article1.index).trim(), articles, baseContent.slice(article3.index).trim()]
    .filter(Boolean)
    .join('\n\n')
}

export function composeContractDocument(
  baseContent: string,
  inheritanceContent: string,
  plots: ContractDocumentPlot[] = [],
) {
  const inheritance = inheritanceContent.trim()
  const legacyFreeBase = baseContent.trim().replace(/(?:\r?\n)+\s*ĐIỀU\s+6\s*\.[\s\S]*$/iu, '').trim()
  const stableBase = upgradePurchaseBase(legacyFreeBase, plots)
  const sections = [stableBase]
  if (inheritance) {
    sections.push(`ĐIỀU 6. THÔNG TIN/NGUYỆN VỌNG VỀ THỪA KẾ\n${inheritance}`)
  }
  sections.push(
    `ĐIỀU ${inheritance ? 7 : 6}. ĐIỀU KHOẢN CHUNG\n${GENERAL_TERMS}`,
    SIGNATURE_BLOCK,
  )
  return sections.join('\n\n')
}

export async function downloadContractPdf(contract: ContractPdfData) {
  const { default: html2pdf } = await import('html2pdf.js')
  const documentRoot = document.createElement('article')
  documentRoot.style.cssText = [
    'width: 720px',
    'padding: 32px 38px',
    'background: #ffffff',
    'color: #000000',
    'font-family: Times New Roman, serif',
    'font-size: 14px',
    'line-height: 1.6',
  ].join(';')

  const content = document.createElement('div')
  content.style.whiteSpace = 'pre-wrap'
  content.textContent = contract.contractContent || 'Hợp đồng chưa có nội dung điện tử.'
  documentRoot.appendChild(content)

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `${contract.contractCode}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    })
    .from(documentRoot)
    .save()
}
