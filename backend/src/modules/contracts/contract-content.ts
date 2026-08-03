const GENERAL_TERMS =
  'Hai bên đã đọc, hiểu, tự nguyện ký và chịu trách nhiệm về thông tin cung cấp. Hợp đồng được lập thành các bản có giá trị như nhau.';

const SIGNATURE_BLOCK = `ĐẠI DIỆN BÊN A                              BÊN B
(Ký, ghi rõ họ tên, chức vụ, đóng dấu)       (Ký, ghi rõ họ tên)`;

export interface PurchaseContractPlotContent {
  code: string;
  zoneName?: string | null;
  areaSqm?: number | string | null;
  price: number | string;
}

export function composeContractContent(
  baseContent: string,
  inheritanceContent?: string | null,
) {
  const inheritance = inheritanceContent?.trim();
  const sections = [extractContractBaseContent(baseContent)];

  if (inheritance) {
    sections.push(
      `ĐIỀU 6. THÔNG TIN/NGUYỆN VỌNG VỀ THỪA KẾ\n${inheritance}`,
    );
  }

  sections.push(
    `ĐIỀU ${inheritance ? 7 : 6}. ĐIỀU KHOẢN CHUNG\n${GENERAL_TERMS}`,
    SIGNATURE_BLOCK,
  );
  return sections.join('\n\n');
}

export function extractContractBaseContent(content?: string | null) {
  const value = content?.trim() ?? '';
  const marker = /(?:\r?\n)+\s*ĐIỀU\s+6\s*\./iu;
  const match = marker.exec(value);
  return match ? value.slice(0, match.index).trim() : value;
}

export function upgradePurchaseContractBase(
  content: string,
  plots: PurchaseContractPlotContent[],
) {
  const base = extractContractBaseContent(content);
  if (!plots.length) return base;
  const article1 = /ĐIỀU\s+1\s*\./iu.exec(base);
  const article3 = /ĐIỀU\s+3\s*\./iu.exec(base);
  if (!article1 || !article3 || article3.index <= article1.index) return base;

  const plotDetails = plots
    .map(
      (plot, index) =>
        `${index + 1}. Lô ${plot.code}${plot.zoneName ? `, ${plot.zoneName}` : ''}, diện tích ${plot.areaSqm ?? '...'} m².`,
    )
    .join('\n');
  const plotPrices = plots
    .map(
      (plot, index) =>
        `${index + 1}. Lô ${plot.code}: ${Number(plot.price).toLocaleString('vi-VN')} đồng.`,
    )
    .join('\n');
  const total = plots
    .reduce((sum, plot) => sum + Number(plot.price), 0)
    .toLocaleString('vi-VN');
  const articles = `ĐIỀU 1. ĐỐI TƯỢNG HỢP ĐỒNG
Bên A cung cấp cho Bên B quyền sử dụng các vị trí phần mộ sau theo dữ liệu hệ thống:
${plotDetails}
Các vị trí trên được sử dụng theo quy hoạch và quy chế quản lý nghĩa trang. Hợp đồng này không mặc nhiên là hợp đồng chuyển nhượng quyền sử dụng đất.

ĐIỀU 2. GIÁ TRỊ VÀ THANH TOÁN
${plotPrices}
Tổng giá trị hợp đồng: ${total} đồng. Thời hạn, phương thức và chứng từ thanh toán thực hiện theo thỏa thuận/phiếu thu hợp lệ của hai bên.`;

  return [base.slice(0, article1.index).trim(), articles, base.slice(article3.index).trim()]
    .filter(Boolean)
    .join('\n\n');
}
