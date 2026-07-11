import { IsString, Matches, MinLength } from 'class-validator';

export class UpdateIdCardDto {
  @IsString()
  @MinLength(1)
  password!: string;

  // CMND cũ: 9 chữ số. CCCD hiện hành: 12 chữ số.
  @IsString()
  @Matches(/^\d{9}(\d{3})?$/, {
    message: 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số',
  })
  idCardNumber!: string;
}
