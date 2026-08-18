import { IsEmail } from 'class-validator';

export class SendRegistrationOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}
