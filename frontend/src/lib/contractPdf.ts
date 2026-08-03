interface ContractPdfData {
  contractCode: string
  contractContent?: string | null
  contractDate?: string | null
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

interface PdfDocument {
  internal: {
    getNumberOfPages(): number
    pageSize: {
      getWidth(): number
      getHeight(): number
    }
  }
  setPage(page: number): void
  setFont(fontName: string, fontStyle: string): void
  setFontSize(size: number): void
  setTextColor(red: number, green: number, blue: number): void
  text(value: string, x: number, y: number, options?: { align?: string }): void
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

function appendTextElement(
  root: HTMLElement,
  tagName: 'div' | 'h1' | 'h2' | 'p',
  text: string,
  cssText: string,
) {
  const element = document.createElement(tagName)
  element.textContent = text
  element.style.cssText = cssText
  element.style.setProperty('color', '#000000', 'important')
  element.style.setProperty('-webkit-text-fill-color', '#000000', 'important')
  element.style.setProperty('opacity', '1', 'important')
  element.style.setProperty('text-shadow', 'none', 'important')
  root.appendChild(element)
  return element
}

function formatContractDate(value?: string | null) {
  if (!value) return 'Ngày ..... tháng ..... năm ........'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ngày ..... tháng ..... năm ........'
  return `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`
}

function appendSignatureBlock(root: HTMLElement) {
  const signature = document.createElement('div')
  signature.dataset.pdfSection = 'signatures'
  signature.style.cssText = [
    'display:grid',
    'grid-template-columns:1fr 1fr',
    'gap:34px',
    'margin-top:30px',
    'min-height:150px',
    'break-inside:avoid',
    'page-break-inside:avoid',
    'text-align:center',
  ].join(';')

  const parties = [
    ['ĐẠI DIỆN BÊN A', '(Ký, ghi rõ họ tên, chức vụ và đóng dấu)'],
    ['BÊN B', '(Ký, ghi rõ họ tên)'],
  ]
  parties.forEach(([title, note]) => {
    const column = document.createElement('div')
    appendTextElement(column, 'p', title, 'margin:0;font-weight:700;font-size:15px;text-align:center')
    appendTextElement(column, 'p', note, 'margin:4px 0 0;font-style:italic;font-size:13px;line-height:1.35;text-align:center')
    signature.appendChild(column)
  })
  root.appendChild(signature)
}

export function createContractPdfElement(contract: ContractPdfData) {
  const root = document.createElement('article')
  root.dataset.contractPdf = 'true'
  root.style.cssText = [
    'width:605px',
    'box-sizing:border-box',
    'background:#ffffff',
    'color:#000000',
    'font-family:"Times New Roman",Times,serif',
    'font-size:15px',
    'line-height:1.55',
  ].join(';')
  root.style.setProperty('color', '#000000', 'important')
  root.style.setProperty('-webkit-text-fill-color', '#000000', 'important')
  root.style.setProperty('opacity', '1', 'important')

  const lines = (contract.contractContent || 'Hợp đồng chưa có nội dung điện tử.')
    .replace(/\r\n/g, '\n')
    .split('\n')

  let dateAdded = false
  let signatureAdded = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue

    if (line === 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM') {
      appendTextElement(root, 'p', line, 'margin:0;text-align:center;font-size:17px;font-weight:700;line-height:1.35')
      continue
    }
    if (line === 'Độc lập - Tự do - Hạnh phúc') {
      appendTextElement(root, 'p', line, 'margin:0;text-align:center;font-size:15px;font-weight:700;line-height:1.35')
      appendTextElement(root, 'div', '', 'width:150px;border-top:1px solid #000;margin:5px auto 12px')
      appendTextElement(root, 'p', formatContractDate(contract.contractDate), 'margin:0 0 20px;text-align:center;font-style:italic')
      dateAdded = true
      continue
    }
    if (/^HỢP ĐỒNG\b/u.test(line)) {
      if (!dateAdded) {
        appendTextElement(root, 'p', formatContractDate(contract.contractDate), 'margin:0 0 20px;text-align:center;font-style:italic')
        dateAdded = true
      }
      appendTextElement(root, 'h1', line, 'margin:0 12px 4px;text-align:center;font-size:19px;line-height:1.35;font-weight:700')
      continue
    }
    if (/^Số\s*:/iu.test(line)) {
      appendTextElement(root, 'p', line, 'margin:0 0 22px;text-align:center;font-size:15px')
      continue
    }
    if (/^ĐIỀU\s+\d+\s*\./iu.test(line)) {
      appendTextElement(root, 'h2', line, 'margin:16px 0 7px;font-size:15.5px;line-height:1.4;font-weight:700;break-after:avoid;page-break-after:avoid')
      continue
    }
    if (/^BÊN\s+[AB]\s*-/u.test(line)) {
      appendTextElement(root, 'h2', line, 'margin:15px 0 7px;font-size:15px;line-height:1.4;font-weight:700;break-after:avoid;page-break-after:avoid')
      continue
    }
    if (/^ĐẠI DIỆN BÊN A\b/u.test(line)) {
      appendSignatureBlock(root)
      signatureAdded = true
      index += 1
      continue
    }

    const isFieldOrList = /^(?:Tên|Mã số thuế|Địa chỉ|Đại diện|Chức vụ|Họ tên|CCCD\/CMND|Điện thoại|\d+\.)\s*/u.test(line)
    appendTextElement(
      root,
      'p',
      line,
      `margin:0 0 6px;text-align:justify;${isFieldOrList ? '' : 'text-indent:24px;'}`,
    )
  }

  if (!signatureAdded) appendSignatureBlock(root)
  return root
}

export async function createContractPdfBlob(contract: ContractPdfData) {
  const { default: html2pdf } = await import('html2pdf.js')
  const staging = document.createElement('div')
  staging.style.cssText = 'position:fixed;left:-10000px;top:0;width:605px;background:#fff;z-index:-1'
  staging.appendChild(createContractPdfElement(contract))
  document.body.appendChild(staging)

  try {
    const worker = html2pdf()
      .set({
        margin: [18, 25, 18, 25],
        filename: `${contract.contractCode}.pdf`,
        image: { type: 'png', quality: 1 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(staging.firstElementChild as HTMLElement)
      .toPdf()

    const pdf = await worker.get('pdf') as PdfDocument
    const totalPages = pdf.internal.getNumberOfPages()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page)
      pdf.setFont('times', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(0, 0, 0)
      pdf.text(`Trang ${page} / ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    }
    return await worker.outputPdf('blob') as Blob
  } finally {
    staging.remove()
  }
}

export async function downloadContractPdf(contract: ContractPdfData) {
  const blob = await createContractPdfBlob(contract)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${contract.contractCode}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
