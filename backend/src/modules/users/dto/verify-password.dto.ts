import { IsString, MinLength } from 'class-validator';

// Dùng để xác thực lại mật khẩu đăng nhập trước khi cho xem/sửa các trường
// nhạy cảm (CCCD/Hộ chiếu) — kể cả khi người dùng đã đăng nhập (JWT hợp lệ).
export class VerifyPasswordDto {
  @IsString()
  @MinLength(1)
  password!: string;
}
