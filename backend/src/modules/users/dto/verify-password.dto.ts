import { IsString, MinLength } from 'class-validator';

// Dùng để xác thực lại mật khẩu đăng nhập trước khi cho xem/sửa các trường
// nhạy cảm (CCCD/Hộ chiếu) — kể cả khi người dùng đã đăng nhập (JWT hợp lệ).
export class VerifyPasswordDto {
  @IsString({ message: 'Vui lòng nhập mật khẩu để xác thực.' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu để xác thực.' })
  password!: string;
}
