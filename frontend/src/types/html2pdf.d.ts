declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[]
    filename?: string
    image?: { type: string; quality: number }
    html2canvas?: Record<string, unknown>
    jsPDF?: Record<string, unknown>
    pagebreak?: Record<string, unknown>
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker
    from(element: HTMLElement): Html2PdfWorker
    toPdf(): Html2PdfWorker
    get(key: string): Promise<unknown>
    outputPdf(type?: string, options?: unknown): Promise<unknown>
    save(): Promise<void>
  }

  export default function html2pdf(): Html2PdfWorker
}
