import { IsString, Matches, MinLength } from 'class-validator';

export class UpdateIdCardDto {
  @IsString({ message: 'Vui lòng nhập mật khẩu để xác thực.' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu để xác thực.' })
  password!: string;

  // CMND cũ: 9 chữ số. CCCD hiện hành: 12 chữ số.
  @IsString({ message: 'Vui lòng nhập số CCCD/CMND.' })
  @Matches(/^\d{9}(\d{3})?$/, {
    message: 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số.',
  })
  idCardNumber!: string;
}
