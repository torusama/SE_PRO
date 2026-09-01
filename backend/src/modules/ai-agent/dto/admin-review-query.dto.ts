import { IsIn, IsOptional } from 'class-validator';

export class AdminFeedbackReviewQueryDto {
  @IsOptional()
  @IsIn(['pending', 'validating', 'approved', 'rejected', 'applied'])
  status?: 'pending' | 'validating' | 'approved' | 'rejected' | 'applied';
}

export class AdminKnowledgeReviewQueryDto {
  @IsOptional()
  @IsIn(['all', 'quarantined', 'active', 'rejected', 'superseded'])
  status?: 'all' | 'quarantined' | 'active' | 'rejected' | 'superseded';

  @IsOptional()
  @IsIn(['customer', 'admin', 'system'])
  sourceRole?: 'customer' | 'admin' | 'system';
}
