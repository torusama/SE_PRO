import { IsIn, IsOptional } from 'class-validator';

export class AdminFeedbackReviewQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

export class AdminKnowledgeReviewQueryDto {
  @IsOptional()
  @IsIn(['all', 'quarantined', 'active', 'rejected', 'superseded'])
  status?: 'all' | 'quarantined' | 'active' | 'rejected' | 'superseded';

  @IsOptional()
  @IsIn(['customer', 'admin', 'system'])
  sourceRole?: 'customer' | 'admin' | 'system';
}
