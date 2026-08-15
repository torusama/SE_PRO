// src/utils/validators.ts
// Các hàm kiểm tra dữ liệu dùng chung (số điện thoại, mã bưu chính, email/gmail...)
// để mọi trang trong hệ thống áp dụng cùng một quy tắc, thay vì mỗi trang tự kiểm
// theo cách riêng.

/**
 * Kiểm tra định dạng số điện thoại Việt Nam.
 * Quy tắc: chỉ gồm chữ số (cho phép khoảng trắng/dấu gạch ngang khi nhập),
 * bắt đầu bằng số 0, tổng cộng tối thiểu 10 và tối đa 11 chữ số.
 */
export function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/[\s.-]/g, "");
  if (!/^0\d{9,10}$/.test(digits)) return false;
  return digits.length === 10 || digits.length === 11;
}

export function getPhoneNumberError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Vui lòng nhập số điện thoại.";
  const digitsOnly = trimmed.replace(/[\s.-]/g, "");
  if (!/^\d+$/.test(digitsOnly)) {
    return "Số điện thoại chỉ được chứa chữ số.";
  }
  if (!digitsOnly.startsWith("0")) {
    return "Số điện thoại phải bắt đầu bằng số 0.";
  }
  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    return "Số điện thoại phải có 10 hoặc 11 chữ số.";
  }
  return null;
}

/**
 * Kiểm tra mã bưu chính (postal code) Việt Nam: chỉ gồm chữ số, 5 hoặc 6 chữ số.
 * Trường không bắt buộc — chỉ báo lỗi khi người dùng có nhập nhưng sai định dạng.
 */
export function isValidPostalCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^\d{5,6}$/.test(trimmed);
}

export function getPostalCodeError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) {
    return "Mã bưu chính chỉ được chứa chữ số.";
  }
  if (trimmed.length < 5 || trimmed.length > 6) {
    return "Mã bưu chính phải gồm 5 hoặc 6 chữ số.";
  }
  return null;
}

/**
 * Tính tuổi (theo năm/tháng/ngày) tính đến thời điểm hiện tại dựa trên ngày sinh
 * dạng "YYYY-MM-DD". Dùng chung cho validate ngày sinh ở các form.
 */
function calculateAge(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Trả về ngày sinh trễ nhất (dạng "YYYY-MM-DD") để người dùng đủ `minAge` tuổi
 * tính đến hôm nay. Dùng để giới hạn thuộc tính `max` của input ngày sinh.
 */
export function getMaxDateOfBirthForAge(
  minAge: number,
  now: Date = new Date(),
): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - minAge);
  return d.toISOString().slice(0, 10);
}

/**
 * Kiểm tra ngày sinh hợp lệ: đúng định dạng, không ở tương lai, không quá xa
 * trong quá khứ, và người dùng phải đủ 18 tuổi trở lên tính đến ngày hiện tại.
 * Trả về thông báo lỗi tiếng Việt rõ ràng, mang tính hướng dẫn, hoặc null nếu hợp lệ.
 */
export function getDateOfBirthError(
  value: string,
  opts?: { minAge?: number },
): string | null {
  const minAge = opts?.minAge ?? 18;
  const trimmed = value.trim();
  if (!trimmed) return "Vui lòng chọn ngày sinh.";

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "Ngày sinh không hợp lệ. Vui lòng chọn lại theo định dạng ngày/tháng/năm.";
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  if (trimmed > todayISO) {
    return "Ngày sinh không được lớn hơn ngày hiện tại. Vui lòng kiểm tra lại.";
  }
  if (trimmed < "1900-01-01") {
    return "Năm sinh không hợp lệ. Vui lòng kiểm tra lại ngày sinh.";
  }

  const age = calculateAge(parsed);
  if (age < minAge) {
    return `Bạn phải đủ ${minAge} tuổi trở lên để sử dụng chức năng này. Vui lòng kiểm tra lại ngày sinh đã nhập.`;
  }

  return null;
}

export function isValidDateOfBirth(
  value: string,
  opts?: { minAge?: number },
): boolean {
  return getDateOfBirthError(value, opts) === null;
}

/** Kiểm tra định dạng email nói chung (RFC-lite, đủ dùng cho form phía client). */
export function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Nếu địa chỉ thuộc miền @gmail.com, kiểm tra thêm quy tắc riêng của Gmail:
 * phần tên trước @ chỉ gồm chữ cái, chữ số, dấu chấm; dài 6-30 ký tự;
 * không bắt đầu/kết thúc bằng dấu chấm và không có hai dấu chấm liền nhau.
 * Nếu không phải @gmail.com thì bỏ qua kiểm tra riêng này (coi như hợp lệ).
 */
export function isValidGmailIfApplicable(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.endsWith("@gmail.com")) return true;
  const localPart = trimmed.slice(0, -"@gmail.com".length);
  if (localPart.length < 6 || localPart.length > 30) return false;
  if (!/^[a-z0-9.]+$/.test(localPart)) return false;
  if (localPart.startsWith(".") || localPart.endsWith(".")) return false;
  if (localPart.includes("..")) return false;
  return true;
}

/**
 * Kiểm tra email đầy đủ: đúng định dạng email nói chung, và nếu là @gmail.com
 * thì phải đúng thêm quy tắc riêng của Gmail. Trả về thông báo lỗi tiếng Việt
 * rõ ràng để hiển thị cho khách, hoặc null nếu hợp lệ.
 */
export function getEmailError(
  value: string,
  opts?: { required?: boolean },
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return opts?.required ? "Vui lòng nhập địa chỉ email." : null;
  }
  if (!isValidEmailFormat(trimmed)) {
    return "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại (vd: ten@gmail.com).";
  }
  if (!isValidGmailIfApplicable(trimmed)) {
    return "Địa chỉ Gmail không hợp lệ. Phần trước @gmail.com phải từ 6-30 ký tự, chỉ gồm chữ, số và dấu chấm.";
  }
  return null;
}
