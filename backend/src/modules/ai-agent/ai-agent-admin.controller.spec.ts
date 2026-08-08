import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiAgentAdminController } from './ai-agent-admin.controller';

describe('AiAgentAdminController knowledge review', () => {
  const knowledge = {
    listKnowledgeForReview: jest.fn().mockResolvedValue([]),
    getKnowledgeForReview: jest.fn().mockResolvedValue({ knowledgeEntryId: 73 }),
    reviewKnowledgeProposal: jest.fn().mockResolvedValue({
      knowledgeEntryId: 73,
      status: 'active',
    }),
  };
  const controller = new AiAgentAdminController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    knowledge as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('protects every endpoint with JWT, role guard, and the admin role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AiAgentAdminController)).toEqual([
      'admin',
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AiAgentAdminController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, RolesGuard]),
    );
  });

  it('binds list and detail routes to the knowledge review service', async () => {
    await controller.listKnowledge('quarantined');
    await controller.getKnowledge('73');

    expect(knowledge.listKnowledgeForReview).toHaveBeenCalledWith(
      'quarantined',
    );
    expect(knowledge.getKnowledgeForReview).toHaveBeenCalledWith(73);
  });

  it('passes authenticated admin identity and notes to approve and reject', async () => {
    await controller.approveKnowledge(
      { id: 9 },
      '73',
      { reviewNote: 'verified' },
    );
    await controller.rejectKnowledge(
      { id: 9 },
      '74',
      { reviewNote: 'incorrect' },
    );

    expect(knowledge.reviewKnowledgeProposal).toHaveBeenNthCalledWith(
      1,
      73,
      9,
      'approve',
      'verified',
    );
    expect(knowledge.reviewKnowledgeProposal).toHaveBeenNthCalledWith(
      2,
      74,
      9,
      'reject',
      'incorrect',
    );
  });
});
