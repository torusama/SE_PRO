import { IsString, Length, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Vui lòng nhập mật khẩu hiện tại.' })
  currentPassword!: string;

  @IsString({ message: 'Vui lòng nhập mật khẩu mới.' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  newPassword!: string;

  // Bắt buộc: mã OTP gửi tới email đăng nhập (xem POST /users/me/password/send-otp)
  @IsString({ message: 'Vui lòng nhập mã OTP.' })
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số.' })
  otpCode!: string;
}
