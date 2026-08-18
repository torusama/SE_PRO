// src/lib/lunarCalendar.ts
// Chuyển đổi Âm lịch (Việt Nam, múi giờ +7) ⇄ Dương lịch bằng công thức thiên
// văn (Julian day number + góc mặt trời + điểm sóc). Đây là thuật toán thiên
// văn phổ biến, không phụ thuộc bảng tra cứu, dùng chung cho các lịch Việt/
// Trung/Hàn vì chung một kinh tuyến múi giờ Đông Dương (UTC+7 cho VN).
//
// Dùng cho FR-08: khi khách hàng chọn "Âm lịch" cho ngày giỗ, ta cần tính ra
// ngày dương lịch tương ứng của năm hiện tại/năm sau để hiển thị đếm ngược và
// (tuỳ backend) để lưu nextDate.

const TZ_OFFSET = 7 // giờ Việt Nam UTC+7

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd =
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  if (jd < 2299161) {
    jd =
      dd +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      32083
  }
  return jd
}

function jdToDate(jd: number): [number, number, number] {
  let a: number, b: number, c: number
  if (jd > 2299160) {
    a = jd + 32044
    b = Math.floor((4 * a + 3) / 146097)
    c = a - Math.floor((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  const day = e - Math.floor((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * Math.floor(m / 10)
  const year = b * 100 + d - 4800 + Math.floor(m / 10)
  return [day, month, year]
}

function newMoon(k: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = Math.PI / 180
  let Jd1 =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * T2 -
    0.000000155 * T3
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 += 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  let deltat: number
  if (T < -11) {
    deltat =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  const JdNew = Jd1 + C1 - deltat
  return JdNew
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525
  const T2 = T * T
  const dr = Math.PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL =
    (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L * dr
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2))
  return Math.floor((L / Math.PI) * 6)
}

function getNewMoonDay(k: number, timeZone: number): number {
  return Math.floor(newMoon(k) + 0.5 + timeZone / 24)
}

function getSunLongitude(dayNumber: number, timeZone: number): number {
  return sunLongitude(dayNumber - 0.5 - timeZone / 24)
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = Math.floor(off / 29.530588853)
  let nm = getNewMoonDay(k, timeZone)
  const sunLong = getSunLongitude(nm, timeZone)
  if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone)
  return nm
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let i = 1
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  let last: number
  do {
    last = arc
    i++
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  } while (arc !== last && i < 14)
  return i - 1
}

/** Chuyển 1 ngày dương lịch sang âm lịch VN: trả về [ngày, tháng, năm, nhuận?] */
export function solarToLunar(dd: number, mm: number, yy: number): [number, number, number, boolean] {
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = getNewMoonDay(k + 1, TZ_OFFSET)
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, TZ_OFFSET)
  let a11 = getLunarMonth11(yy, TZ_OFFSET)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = yy
    a11 = getLunarMonth11(yy - 1, TZ_OFFSET)
  } else {
    lunarYear = yy + 1
    b11 = getLunarMonth11(yy + 1, TZ_OFFSET)
  }
  const lunarDay = dayNumber - monthStart + 1
  const diff = Math.floor((monthStart - a11) / 29)
  let lunarLeap = false
  let lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, TZ_OFFSET)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) lunarLeap = true
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1
  return [lunarDay, lunarMonth, lunarYear, lunarLeap]
}

/** Chuyển 1 ngày âm lịch VN sang dương lịch: trả về Date (00:00 giờ VN) */
export function lunarToSolar(lunarDay: number, lunarMonth: number, lunarYear: number, lunarLeap = false): Date {
  let a11: number
  let b11: number
  if (lunarMonth >= 11) {
    a11 = getLunarMonth11(lunarYear, TZ_OFFSET)
    b11 = getLunarMonth11(lunarYear + 1, TZ_OFFSET)
  } else {
    a11 = getLunarMonth11(lunarYear - 1, TZ_OFFSET)
    b11 = getLunarMonth11(lunarYear, TZ_OFFSET)
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = lunarMonth - 11
  if (off < 0) off += 12
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, TZ_OFFSET)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (lunarLeap && lunarMonth !== leapMonth + 11 - (leapMonth < 11 ? -12 : 0)) {
      // tháng nhuận không khớp, bỏ qua cờ nhuận
    }
    if (off >= leapOff) off += 1
  }
  const monthStart = getNewMoonDay(k + off, TZ_OFFSET)
  const jd = monthStart + lunarDay - 1
  const [d, m, y] = jdToDate(jd)
  return new Date(y, m - 1, d)
}

/**
 * Tìm ngày dương lịch sắp tới (>= today, giờ VN) ứng với 1 ngày/tháng ÂM LỊCH
 * lặp lại hàng năm — dùng để hiển thị "ngày tới" cho nhắc lịch âm lịch (ví dụ
 * ngày giỗ tính theo âm lịch). Nếu ngày âm của năm nay đã qua, tự động lấy
 * ngày tương ứng của năm sau.
 */
export function nextLunarOccurrence(lunarDay: number, lunarMonth: number, from: Date = new Date()): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  // Ước lượng năm âm lịch hiện tại dựa trên ngày dương hôm nay
  const [, , currentLunarYear] = solarToLunar(today.getDate(), today.getMonth() + 1, today.getFullYear())
  let candidate = lunarToSolar(lunarDay, lunarMonth, currentLunarYear)
  if (candidate < today) {
    candidate = lunarToSolar(lunarDay, lunarMonth, currentLunarYear + 1)
  }
  return candidate
}

/** Định dạng "DD/MM (Âm lịch)" để hiển thị cho người dùng */
export function formatLunar(lunarDay: number, lunarMonth: number): string {
  return `${String(lunarDay).padStart(2, '0')}/${String(lunarMonth).padStart(2, '0')} (Âm lịch)`
}
