import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password!: string;

  @IsString()
  registrationToken!: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại không hợp lệ.' })
  phone?: string;
}
