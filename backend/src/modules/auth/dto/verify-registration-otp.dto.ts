import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  @Matches(/^\d{6}$/, { message: 'Mã OTP chỉ gồm chữ số' })
  otpCode!: string;
}
