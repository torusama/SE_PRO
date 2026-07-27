import { Injectable } from '@nestjs/common';
import {
  BaziBadDirection,
  BaziGoodDirection,
  BaziSuggestion,
} from './types/agent-response.types';

export const BAZI_DISCLAIMER =
  'Gợi ý Bát tự & Phong thủy chỉ mang tính tham khảo văn hóa và tâm linh, không phải căn cứ bắt buộc cho quyết định mua lô.';

const THIEN_CAN = [
  'Canh',
  'Tân',
  'Nhâm',
  'Quý',
  'Giáp',
  'Ất',
  'Bính',
  'Đinh',
  'Mậu',
  'Kỷ',
];

const DIA_CHI = [
  'Thân',
  'Dậu',
  'Tuất',
  'Hợi',
  'Tý',
  'Sửu',
  'Dần',
  'Mão',
  'Thìn',
  'Tị',
  'Ngọ',
  'Mùi',
];

// Map 60 Giáp Tý Nạp Âm
const NAP_AM_MAP: Record<
  string,
  { element: string; name: string; meaning: string }
> = {
  'Giáp Tý': { element: 'Kim', name: 'Hải Trung Kim', meaning: 'Vàng trong biển' },
  'Ất Sửu': { element: 'Kim', name: 'Hải Trung Kim', meaning: 'Vàng trong biển' },
  'Bính Dần': { element: 'Hỏa', name: 'Lư Trung Hỏa', meaning: 'Lửa trong lò' },
  'Đinh Mão': { element: 'Hỏa', name: 'Lư Trung Hỏa', meaning: 'Lửa trong lò' },
  'Mậu Thìn': { element: 'Mộc', name: 'Đại Lâm Mộc', meaning: 'Gỗ rừng lớn' },
  'Kỷ Tị': { element: 'Mộc', name: 'Đại Lâm Mộc', meaning: 'Gỗ rừng lớn' },
  'Canh Ngọ': { element: 'Thổ', name: 'Lộ Bàng Thổ', meaning: 'Đất ven đường' },
  'Tân Mùi': { element: 'Thổ', name: 'Lộ Bàng Thổ', meaning: 'Đất ven đường' },
  'Nhâm Thân': { element: 'Kim', name: 'Kiếm Phong Kim', meaning: 'Vàng mũi kiếm' },
  'Quý Dậu': { element: 'Kim', name: 'Kiếm Phong Kim', meaning: 'Vàng mũi kiếm' },
  'Giáp Tuất': { element: 'Hỏa', name: 'Sơn Đầu Hỏa', meaning: 'Lửa trên đỉnh núi' },
  'Ất Hợi': { element: 'Hỏa', name: 'Sơn Đầu Hỏa', meaning: 'Lửa trên đỉnh núi' },
  'Bính Tý': { element: 'Thủy', name: 'Giản Hạ Thủy', meaning: 'Nước dưới khe' },
  'Đinh Sửu': { element: 'Thủy', name: 'Giản Hạ Thủy', meaning: 'Nước dưới khe' },
  'Mậu Dần': { element: 'Thổ', name: 'Thành Đầu Thổ', meaning: 'Đất trên thành' },
  'Kỷ Mão': { element: 'Thổ', name: 'Thành Đầu Thổ', meaning: 'Đất trên thành' },
  'Canh Thìn': { element: 'Kim', name: 'Bạch Lạp Kim', meaning: 'Vàng trong chân đèn' },
  'Tân Tị': { element: 'Kim', name: 'Bạch Lạp Kim', meaning: 'Vàng trong chân đèn' },
  'Nhâm Ngọ': { element: 'Mộc', name: 'Dương Liễu Mộc', meaning: 'Gỗ cây dương liễu' },
  'Quý Mùi': { element: 'Mộc', name: 'Dương Liễu Mộc', meaning: 'Gỗ cây dương liễu' },
  'Giáp Thân': { element: 'Thủy', name: 'Tuyền Trung Thủy', meaning: 'Nước trong suối' },
  'Ất Dậu': { element: 'Thủy', name: 'Tuyền Trung Thủy', meaning: 'Nước trong suối' },
  'Bính Tuất': { element: 'Thổ', name: 'Ốc Thượng Thổ', meaning: 'Đất trên mái nhà' },
  'Đinh Hợi': { element: 'Thổ', name: 'Ốc Thượng Thổ', meaning: 'Đất trên mái nhà' },
  'Mậu Tý': { element: 'Hỏa', name: 'Tích Lịch Hỏa', meaning: 'Lửa sấm sét' },
  'Kỷ Sửu': { element: 'Hỏa', name: 'Tích Lịch Hỏa', meaning: 'Lửa sấm sét' },
  'Canh Dần': { element: 'Mộc', name: 'Tùng Bách Mộc', meaning: 'Gỗ tùng bách' },
  'Tân Mão': { element: 'Mộc', name: 'Tùng Bách Mộc', meaning: 'Gỗ tùng bách' },
  'Nhâm Thìn': { element: 'Thủy', name: 'Trường Lưu Thủy', meaning: 'Nước chảy dài' },
  'Quý Tị': { element: 'Thủy', name: 'Trường Lưu Thủy', meaning: 'Nước chảy dài' },
  'Giáp Ngọ': { element: 'Kim', name: 'Sa Trung Kim', meaning: 'Vàng trong cát' },
  'Ất Mùi': { element: 'Kim', name: 'Sa Trung Kim', meaning: 'Vàng trong cát' },
  'Bính Thân': { element: 'Hỏa', name: 'Sơn Hạ Hỏa', meaning: 'Lửa dưới chân núi' },
  'Đinh Dậu': { element: 'Hỏa', name: 'Sơn Hạ Hỏa', meaning: 'Lửa dưới chân núi' },
  'Mậu Tuất': { element: 'Mộc', name: 'Bình Địa Mộc', meaning: 'Gỗ đồng bằng' },
  'Kỷ Hợi': { element: 'Mộc', name: 'Bình Địa Mộc', meaning: 'Gỗ đồng bằng' },
  'Canh Tý': { element: 'Thổ', name: 'Bích Thượng Thổ', meaning: 'Đất trên tường' },
  'Tân Sửu': { element: 'Thổ', name: 'Bích Thượng Thổ', meaning: 'Đất trên tường' },
  'Nhâm Dần': { element: 'Kim', name: 'Kim Bạch Kim', meaning: 'Vàng pha bạc' },
  'Quý Mão': { element: 'Kim', name: 'Kim Bạch Kim', meaning: 'Vàng pha bạc' },
  'Giáp Thìn': { element: 'Hỏa', name: 'Phúc Đăng Hỏa', meaning: 'Lửa đèn dầu' },
  'Ất Tị': { element: 'Hỏa', name: 'Phúc Đăng Hỏa', meaning: 'Lửa đèn dầu' },
  'Bính Ngọ': { element: 'Thủy', name: 'Thiên Hà Thủy', meaning: 'Nước trên trời' },
  'Đinh Mùi': { element: 'Thủy', name: 'Thiên Hà Thủy', meaning: 'Nước trên trời' },
  'Mậu Thân': { element: 'Thổ', name: 'Đại Trạch Thổ', meaning: 'Đất đầm lầy' },
  'Kỷ Dậu': { element: 'Thổ', name: 'Đại Trạch Thổ', meaning: 'Đất đầm lầy' },
  'Canh Tuất': { element: 'Kim', name: 'Thoa Xuyên Kim', meaning: 'Vàng trang sức' },
  'Tân Hợi': { element: 'Kim', name: 'Thoa Xuyên Kim', meaning: 'Vàng trang sức' },
  'Nhâm Tý': { element: 'Mộc', name: 'Tang Đố Mộc', meaning: 'Gỗ cây dâu' },
  'Quý Sửu': { element: 'Mộc', name: 'Tang Đố Mộc', meaning: 'Gỗ cây dâu' },
  'Giáp Dần': { element: 'Thủy', name: 'Đại Khê Thủy', meaning: 'Nước khe lớn' },
  'Ất Mão': { element: 'Thủy', name: 'Đại Khê Thủy', meaning: 'Nước khe lớn' },
  'Bính Thìn': { element: 'Thổ', name: 'Sa Trung Thổ', meaning: 'Đất trong cát' },
  'Đinh Tị': { element: 'Thổ', name: 'Sa Trung Thổ', meaning: 'Đất trong cát' },
  'Mậu Ngọ': { element: 'Hỏa', name: 'Thiên Thượng Hỏa', meaning: 'Lửa trên trời' },
  'Kỷ Mùi': { element: 'Hỏa', name: 'Thiên Thượng Hỏa', meaning: 'Lửa trên trời' },
  'Canh Thân': { element: 'Mộc', name: 'Thạch Lựu Mộc', meaning: 'Gỗ cây lựu đá' },
  'Tân Dậu': { element: 'Mộc', name: 'Thạch Lựu Mộc', meaning: 'Gỗ cây lựu đá' },
  'Nhâm Tuất': { element: 'Thủy', name: 'Đại Hải Thủy', meaning: 'Nước biển lớn' },
  'Quý Hợi': { element: 'Thủy', name: 'Đại Hải Thủy', meaning: 'Nước biển lớn' },
};

// Cung mệnh & Bát trạch directions
interface CungInfo {
  cung: string;
  group: 'Đông Tứ Mệnh' | 'Tây Tứ Mệnh';
  good: BaziGoodDirection[];
  bad: BaziBadDirection[];
}

const CUNG_BAT_TRACH: Record<number, CungInfo> = {
  1: {
    cung: 'Khảm',
    group: 'Đông Tứ Mệnh',
    good: [
      { direction: 'Đông Nam', star: 'Sinh Khí', meaning: 'Phúc đức vượng tiến, tài lộc dồi dào' },
      { direction: 'Đông', star: 'Thiên Y', meaning: 'Thần khí bảo hộ, gia đạo an yên' },
      { direction: 'Nam', star: 'Diên Niên', meaning: 'Bền vững trường tồn, con cháu hòa thuận' },
      { direction: 'Bắc', star: 'Phục Vị', meaning: 'Củng cố tinh thần, tĩnh tâm phát triển' },
    ],
    bad: [
      { direction: 'Tây Nam', star: 'Tuyệt Mệnh', meaning: 'Triệt tiêu sinh khí, tổn hại gia đạo' },
      { direction: 'Đông Bắc', star: 'Ngũ Quỷ', meaning: 'Gây xáo trộn năng lượng, mâu thuẫn' },
      { direction: 'Tây Bắc', star: 'Lục Sát', meaning: 'Trì trệ, trắc trở tài lộc' },
      { direction: 'Tây', star: 'Họa Hại', meaning: 'Tổn hao sinh lực, trắc trở nhỏ' },
    ],
  },
  2: {
    cung: 'Khôn',
    group: 'Tây Tứ Mệnh',
    good: [
      { direction: 'Đông Bắc', star: 'Sinh Khí', meaning: 'Phúc đức vượng tiến, tài lộc dồi dào' },
      { direction: 'Tây', star: 'Thiên Y', meaning: 'Thần khí bảo hộ, sức khỏe trường thọ' },
      { direction: 'Tây Bắc', star: 'Diên Niên', meaning: 'Hòa thuận trường tồn, an gia lập nghiệp' },
      { direction: 'Tây Nam', star: 'Phục Vị', meaning: 'Vững vàng nền tảng, gia đạo vững chắc' },
    ],
    bad: [
      { direction: 'Bắc', star: 'Tuyệt Mệnh', meaning: 'Triệt tiêu sinh khí, tổn hại gia đạo' },
      { direction: 'Đông Nam', star: 'Ngũ Quỷ', meaning: 'Gây xáo trộn năng lượng' },
      { direction: 'Nam', star: 'Lục Sát', meaning: 'Trì trệ, xung khắc' },
      { direction: 'Đông', star: 'Họa Hại', meaning: 'Tổn hao năng lượng, thị phi' },
    ],
  },
  3: {
    cung: 'Chấn',
    group: 'Đông Tứ Mệnh',
    good: [
      { direction: 'Nam', star: 'Sinh Khí', meaning: 'Vượng khí hưng thịnh, phát đạt' },
      { direction: 'Bắc', star: 'Thiên Y', meaning: 'Giải trừ bệnh tật, an lành khang thái' },
      { direction: 'Đông Nam', star: 'Diên Niên', meaning: 'Gia đình gắn kết, trường thọ' },
      { direction: 'Đông', star: 'Phục Vị', meaning: 'Vững nền gia phong, bình yên' },
    ],
    bad: [
      { direction: 'Tây', star: 'Tuyệt Mệnh', meaning: 'Triệt tiêu sinh khí, tổn hại tài vận' },
      { direction: 'Tây Bắc', star: 'Ngũ Quỷ', meaning: 'Xáo trộn khí vận, thị phi' },
      { direction: 'Đông Bắc', star: 'Lục Sát', meaning: 'Hao tổn tài lộc, trắc trở' },
      { direction: 'Tây Nam', star: 'Họa Hại', meaning: 'Bất hòa, suy giảm sinh lực' },
    ],
  },
  4: {
    cung: 'Tốn',
    group: 'Đông Tứ Mệnh',
    good: [
      { direction: 'Bắc', star: 'Sinh Khí', meaning: 'Vượng tài sinh lộc, con cháu phát hiền' },
      { direction: 'Nam', star: 'Thiên Y', meaning: 'Bảo hộ bình an, quý nhân phù trợ' },
      { direction: 'Đông', star: 'Diên Niên', meaning: 'Trường thọ, gắn kết huyết thống' },
      { direction: 'Đông Nam', star: 'Phục Vị', meaning: 'Ổn định tâm trí, an yên tự tại' },
    ],
    bad: [
      { direction: 'Đông Bắc', star: 'Tuyệt Mệnh', meaning: 'Tổn hao vượng khí, nguy hại' },
      { direction: 'Tây Nam', star: 'Ngũ Quỷ', meaning: 'Gây bất hòa gia đạo, tai tiếng' },
      { direction: 'Tây', star: 'Lục Sát', meaning: 'Trắc trở sự nghiệp, hao sinh lực' },
      { direction: 'Tây Bắc', star: 'Họa Hại', meaning: 'Thị phi phiền muộn' },
    ],
  },
  6: {
    cung: 'Càn',
    group: 'Tây Tứ Mệnh',
    good: [
      { direction: 'Tây', star: 'Sinh Khí', meaning: 'Tài lộc hưng vượng, sự nghiệp đỉnh cao' },
      { direction: 'Đông Bắc', star: 'Thiên Y', meaning: 'Trường thọ khang an, thần minh độ trì' },
      { direction: 'Tây Nam', star: 'Diên Niên', meaning: 'Hữu hảo hòa thuận, phúc đức vĩnh cửu' },
      { direction: 'Tây Bắc', star: 'Phục Vị', meaning: 'Tĩnh tại tâm an, củng cố uy quyền' },
    ],
    bad: [
      { direction: 'Nam', star: 'Tuyệt Mệnh', meaning: 'Triệt tiêu dương khí, tổn hại tài lộc' },
      { direction: 'Đông', star: 'Ngũ Quỷ', meaning: 'Xung khắc tài vận, rắc rối' },
      { direction: 'Bắc', star: 'Lục Sát', meaning: 'Trì trệ phúc khí, thị phi' },
      { direction: 'Đông Nam', star: 'Họa Hại', meaning: 'Tổn thất sinh lực, phiền muộn' },
    ],
  },
  7: {
    cung: 'Đoài',
    group: 'Tây Tứ Mệnh',
    good: [
      { direction: 'Tây Bắc', star: 'Sinh Khí', meaning: 'Phúc lộc vẹn toàn, thăng tiến vượng tài' },
      { direction: 'Tây Nam', star: 'Thiên Y', meaning: 'Bình an sức khỏe, hanh thông mọi sự' },
      { direction: 'Đông Bắc', star: 'Diên Niên', meaning: 'Bền vững tình thân, trường thọ' },
      { direction: 'Tây', star: 'Phục Vị', meaning: 'Bình yên nội tại, giữ vững thành quả' },
    ],
    bad: [
      { direction: 'Đông Nam', star: 'Tuyệt Mệnh', meaning: 'Tổn hao vượng khí, xấu nhất' },
      { direction: 'Nam', star: 'Ngũ Quỷ', meaning: 'Xáo trộn khí vận, thị phi' },
      { direction: 'Đông', star: 'Lục Sát', meaning: 'Trắc trở công danh, hao tốn' },
      { direction: 'Bắc', star: 'Họa Hại', meaning: 'Suy giảm năng lượng, rắc rối nhỏ' },
    ],
  },
  8: {
    cung: 'Cấn',
    group: 'Tây Tứ Mệnh',
    good: [
      { direction: 'Tây Nam', star: 'Sinh Khí', meaning: 'Vượng khí sinh tài, con cháu hiển đạt' },
      { direction: 'Tây Bắc', star: 'Thiên Y', meaning: 'Trường thọ an lành, bảo hộ gia quyến' },
      { direction: 'Tây', star: 'Diên Niên', meaning: 'Trường tồn vĩnh cữu, gắn kết gia đạo' },
      { direction: 'Đông Bắc', star: 'Phục Vị', meaning: 'An định vững chãi, tâm tĩnh tự tại' },
    ],
    bad: [
      { direction: 'Bắc', star: 'Tuyệt Mệnh', meaning: 'Tổn hại sinh khí, triệt tiêu phúc đức' },
      { direction: 'Đông', star: 'Lục Sát', meaning: 'Bất hòa, suy giảm hanh thông' },
      { direction: 'Đông Nam', star: 'Họa Hại', meaning: 'Trắc trở công việc, hao tổn' },
      { direction: 'Nam', star: 'Ngũ Quỷ', meaning: 'Xáo trộn phong thủy, phiền muộn' },
    ],
  },
  9: {
    cung: 'Ly',
    group: 'Đông Tứ Mệnh',
    good: [
      { direction: 'Đông', star: 'Sinh Khí', meaning: 'Phúc lộc dồi dào, sinh khí dâng cao' },
      { direction: 'Đông Nam', star: 'Thiên Y', meaning: 'Khang thái trường thọ, gặp may mắn' },
      { direction: 'Bắc', star: 'Diên Niên', meaning: 'Gia đạo êm ấm, trường tồn vinh hoa' },
      { direction: 'Nam', star: 'Phục Vị', meaning: 'Giữ vững vị thế, bình an tĩnh lặng' },
    ],
    bad: [
      { direction: 'Tây Bắc', star: 'Tuyệt Mệnh', meaning: 'Triệt tiêu khí vận, nguy hại' },
      { direction: 'Tây', star: 'Ngũ Quỷ', meaning: 'Gây thị phi bất hòa' },
      { direction: 'Tây Nam', star: 'Lục Sát', meaning: 'Hao tài tốn lực, rắc rối' },
      { direction: 'Đông Bắc', star: 'Họa Hại', meaning: 'Trắc trở nhỏ, suy giảm năng lượng' },
    ],
  },
};

// Relation descriptions
const ELEMENT_RELATIONS: Record<
  string,
  { supporting: string; weakening: string }
> = {
  Kim: {
    supporting: 'Thổ sinh Kim (Đất sinh kim loại, chọn hướng thuộc Thổ hoặc Kim)',
    weakening: 'Hỏa khắc Kim (Lửa nung chảy kim loại, tránh hướng Nam)',
  },
  Mộc: {
    supporting: 'Thủy sinh Mộc (Nước tưới cây cối, chọn hướng thuộc Thủy hoặc Mộc)',
    weakening: 'Kim khắc Mộc (Dao rìu chặt cây, tránh hướng Tây/Tây Bắc)',
  },
  Thủy: {
    supporting: 'Kim sinh Thủy (Kim loại nung chảy sinh Thủy, chọn hướng Kim hoặc Thủy)',
    weakening: 'Thổ khắc Thủy (Đất đắp đập chặn nước, tránh hướng Đông Bắc/Tây Nam)',
  },
  Hỏa: {
    supporting: 'Mộc sinh Hỏa (Gỗ bùng cháy sinh Hỏa, chọn hướng Mộc hoặc Hỏa)',
    weakening: 'Thủy khắc Hỏa (Nước dập tắt lửa, tránh hướng Bắc)',
  },
  Thổ: {
    supporting: 'Hỏa sinh Thổ (Lửa thiêu rụi thành tro đất, chọn hướng Hỏa hoặc Thổ)',
    weakening: 'Mộc khắc Thổ (Rễ cây đâm xuyên đất, tránh hướng Đông/Đông Nam)',
  },
};

@Injectable()
export class BaziRuleService {
  suggest(input: {
    birthDate: string;
    birthTime?: string;
    gender?: string;
  }): BaziSuggestion {
    const dateObj = new Date(input.birthDate);
    const year = Number.isNaN(dateObj.getTime())
      ? 1990
      : dateObj.getUTCFullYear();

    // 1. Thiên Can & Địa Chi
    const heavenlyStem = THIEN_CAN[year % 10];
    const earthlyBranch = DIA_CHI[year % 12];
    const yearPillar = `${heavenlyStem} ${earthlyBranch}`;

    // 2. Nạp Âm
    const napAm = NAP_AM_MAP[yearPillar] || {
      element: 'Thổ',
      name: 'Ốc Thượng Thổ',
      meaning: 'Đất trên mái nhà',
    };

    // 3. Giờ sinh
    let birthHourBranch: string | undefined;
    if (input.birthTime) {
      const parts = input.birthTime.split(':');
      const hour = parseInt(parts[0], 10);
      if (!Number.isNaN(hour)) {
        const branchIndex = Math.floor(((hour + 1) % 24) / 2);
        const branches = [
          'Tý',
          'Sửu',
          'Dần',
          'Mão',
          'Thìn',
          'Tị',
          'Ngọ',
          'Mùi',
          'Thân',
          'Dậu',
          'Tuất',
          'Hợi',
        ];
        birthHourBranch = branches[branchIndex];
      }
    }

    // 4. Bát Trạch & Cung Mệnh chuẩn
    const isFemale = input.gender?.toLowerCase() === 'female';
    const sumDigits = (n: number): number => {
      let sum = 0;
      let temp = Math.abs(n);
      while (temp > 0) {
        sum += temp % 10;
        temp = Math.floor(temp / 10);
      }
      return sum > 9 ? sumDigits(sum) : sum;
    };
    const sumY = sumDigits(year % 100);

    let cungNum: number;
    if (year >= 2000) {
      if (isFemale) {
        cungNum = (6 + sumY) % 9;
        if (cungNum === 0) cungNum = 9;
        if (cungNum === 5) cungNum = 8; // Nữ -> Cấn
      } else {
        cungNum = (9 - sumY + 9) % 9;
        if (cungNum === 0) cungNum = 9;
        if (cungNum === 5) cungNum = 2; // Nam -> Khôn
      }
    } else {
      // Trước 2000
      if (isFemale) {
        cungNum = (5 + sumY) % 9;
        if (cungNum === 0) cungNum = 9;
        if (cungNum === 5) cungNum = 8;
      } else {
        cungNum = (10 - sumY) % 9;
        if (cungNum === 0) cungNum = 9;
        if (cungNum === 5) cungNum = 2;
      }
    }

    const batTrach = CUNG_BAT_TRACH[cungNum] || CUNG_BAT_TRACH[8];
    const preferredDirections = batTrach.good.map((g) => g.direction);
    const alternativeDirections = batTrach.good.slice(1).map((g) => g.direction);
    const elementRel = ELEMENT_RELATIONS[napAm.element] || ELEMENT_RELATIONS.Thổ;

    // Phân tích chi tiết
    const genderText = input.gender === 'female' ? 'Nữ' : 'Nam';
    const hourText = birthHourBranch ? ` - Canh ${birthHourBranch}` : '';

    const explanation = `Gia chủ tuổi ${yearPillar} (${year}${hourText}), Mệnh Nạp Âm ${napAm.name} (${napAm.meaning}, thuộc hành ${napAm.element}). Cung mệnh ${batTrach.cung} (${batTrach.group}, giới tính ${genderText}).`;

    const detailedAnalysis = `Theo thuyết Âm Trạch Bát Trạch, gia chủ mệnh ${napAm.name} (${napAm.element}) thuộc ${batTrach.group} (Cung ${batTrach.cung}). Hướng mộ ưu tiên nhất là ${batTrach.good[0].direction} (Sao ${batTrach.good[0].star} - ${batTrach.good[0].meaning}), kết hợp hỗ trợ ngũ hành: ${elementRel.supporting}. Cần lưu ý tránh các hướng đại kỵ: ${batTrach.bad[0].direction} (${batTrach.bad[0].star}) và ${batTrach.bad[1].direction} (${batTrach.bad[1].star}).`;

    return {
      preferredDirections,
      alternativeDirections,
      explanation,
      disclaimer: BAZI_DISCLAIMER,
      heavenlyStem,
      earthlyBranch,
      yearPillar,
      element: napAm.element,
      napAmElement: napAm.element,
      napAmName: napAm.name,
      napAmMeaning: napAm.meaning,
      cungMenh: batTrach.cung,
      tuMenh: batTrach.group,
      birthHourBranch,
      goodDirections: batTrach.good,
      badDirections: batTrach.bad,
      elementRelations: elementRel,
      detailedAnalysis,
    };
  }
}
