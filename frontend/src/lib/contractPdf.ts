interface ContractPdfData {
  contractCode: string
  contractContent?: string | null
  inheritanceContent?: string | null
  partyASignatureName?: string | null
  partyASignedAt?: string | null
  partyBSignatureName?: string | null
  partyBSignedAt?: string | null
}

function signatureLine(name?: string | null, signedAt?: string | null) {
  if (!name) return 'Chưa ký'
  const date = signedAt ? new Date(signedAt).toLocaleString('vi-VN') : ''
  return `${name}${date ? ` — ${date}` : ''}`
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

  const appendix = document.createElement('section')
  appendix.style.cssText = 'margin-top:28px;padding-top:18px;border-top:1px solid #000;page-break-inside:avoid'
  const appendixTitle = document.createElement('h3')
  appendixTitle.textContent = 'THÔNG TIN/NGUYỆN VỌNG THỪA KẾ'
  appendixTitle.style.cssText = 'font-size:15px;margin:0 0 8px;text-align:center'
  const appendixContent = document.createElement('div')
  appendixContent.style.whiteSpace = 'pre-wrap'
  appendixContent.textContent = contract.inheritanceContent || '[Chưa có nội dung]'
  appendix.append(appendixTitle, appendixContent)
  documentRoot.appendChild(appendix)

  const signatures = document.createElement('section')
  signatures.style.cssText = 'margin-top:28px;padding-top:18px;border-top:1px solid #000;page-break-inside:avoid'
  signatures.innerHTML = '<h3 style="font-size:15px;margin:0 0 12px;text-align:center">XÁC NHẬN CHỮ KÝ ĐIỆN TỬ</h3>'
  const partyA = document.createElement('p')
  partyA.textContent = `Bên A: ${signatureLine(contract.partyASignatureName, contract.partyASignedAt)}`
  const partyB = document.createElement('p')
  partyB.textContent = `Bên B: ${signatureLine(contract.partyBSignatureName, contract.partyBSignedAt)}`
  signatures.append(partyA, partyB)
  documentRoot.appendChild(signatures)

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
