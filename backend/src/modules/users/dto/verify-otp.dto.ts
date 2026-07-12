import { IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  code!: string;
}
