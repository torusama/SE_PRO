import { IsString, Length, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  // Bắt buộc: mã OTP gửi tới email đăng nhập (xem POST /users/me/password/send-otp)
  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  otpCode!: string;
}
