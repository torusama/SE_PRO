import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ManageKnowledgeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @IsString()
  @IsIn(['faq', 'business_rule', 'information_correction'])
  knowledgeType!: 'faq' | 'business_rule' | 'information_correction';

  @IsString()
  @MinLength(10)
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
