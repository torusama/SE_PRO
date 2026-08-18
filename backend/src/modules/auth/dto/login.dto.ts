import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail(
    {},
    { message: 'Email không đúng định dạng. Vui lòng kiểm tra lại.' },
  )
  email: string;

  @IsString({ message: 'Vui lòng nhập mật khẩu.' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu.' })
  password: string;
}
