import { Test, TestingModule } from '@nestjs/testing';
import { AutonomousLearningService } from './autonomous-learning.service';
import { DatabaseService } from '../../database/database.service';

describe('AutonomousLearningService', () => {
  let service: AutonomousLearningService;
  let db: any;

  beforeEach(async () => {
    db = {
      query: jest.fn(),
      queryOne: jest.fn(),
      transaction: jest.fn(async (cb) => cb(db)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutonomousLearningService,
        {
          provide: DatabaseService,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AutonomousLearningService>(AutonomousLearningService);
  });

  describe('processProposal', () => {
    it('should ignore recommendation_feedback and map to ai_learning_signals', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await service.processProposal(
        {
          knowledgeType: 'recommendation_feedback',
          content: 'Option 2 is too expensive',
          category: 'feedback',
          title: 'Feedback',
          requestedScope: 'user',
          reason: 'Test',
        },
        {
          conversationId: 10,
          messageId: 20,
          userId: 1,
          role: 'customer',
          sessionId: 'ses-1',
        },
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_learning_signals'),
        expect.any(Array),
      );
    });

    it('should return login_required if user_preference is proposed by unauthenticated user', async () => {
      const result = await service.processProposal(
        {
          knowledgeType: 'user_preference',
          content: 'likes trees',
          category: 'preference',
          title: 'trees',
          requestedScope: 'user',
          reason: 'Test',
        },
        {
          conversationId: 10,
          messageId: 20,
          userId: null,
          role: null,
          sessionId: 'ses-1',
        },
      );

      expect(result.status).toBe('login_required');
    });

    it('should insert user_preference into ai_knowledge_entries and supersede old ones', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Update
      db.query.mockResolvedValueOnce({ rows: [{ knowledge_entry_id: 100 }] }); // Insert

      const result = await service.processProposal(
        {
          knowledgeType: 'user_preference',
          content: 'likes trees',
          category: 'preference',
          title: 'trees',
          requestedScope: 'user',
          reason: 'Test',
        },
        {
          conversationId: 10,
          messageId: 20,
          userId: 5,
          role: 'customer',
          sessionId: 'ses-1',
        },
      );

      expect(result.status).toBe('saved_user_memory');
    });

    it('should insert global_rule as pending if proposed by customer', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ knowledge_entry_id: 200 }] });

      const result = await service.processProposal(
        {
          knowledgeType: 'business_rule',
          content: 'New cemetery policy',
          category: 'rule',
          title: 'policy',
          requestedScope: 'global',
          reason: 'Test',
        },
        {
          conversationId: 10,
          messageId: 20,
          userId: 5,
          role: 'customer',
          sessionId: 'ses-1',
        },
      );

      expect(result.status).toBe('stored_for_validation');
    });

    it('should insert global_rule as active if proposed by admin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ knowledge_entry_id: 200 }] });

      const result = await service.processProposal(
        {
          knowledgeType: 'business_rule',
          content: 'New cemetery policy',
          category: 'rule',
          title: 'policy',
          requestedScope: 'global',
          reason: 'Test',
        },
        {
          conversationId: 10,
          messageId: 20,
          userId: 5,
          role: 'admin',
          sessionId: 'ses-1',
        },
      );

      expect(result.status).toBe('verified_and_activated');
    });
  });
});
