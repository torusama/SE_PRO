import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FeedbackService } from './feedback.service';
import { KnowledgeService } from './knowledge.service';

function createService() {
  const client = { query: jest.fn() };
  const database = {
    queryOne: jest.fn(),
    query: jest.fn(),
    transaction: jest.fn(async (callback: (value: typeof client) => unknown) =>
      callback(client),
    ),
  };
  const knowledge = {
    applyApprovedCorrection: jest.fn().mockResolvedValue({
      feedbackId: 7,
      status: 'applied',
      knowledgeEntryId: 73,
    }),
  };
  return {
    client,
    database,
    knowledge,
    service: new FeedbackService(
      database as unknown as DatabaseService,
      knowledge as unknown as KnowledgeService,
    ),
  };
}

describe('FeedbackService learning review', () => {
  it('stores feedback only against a conversation owned by the same user', async () => {
    const { database, service } = createService();
    database.queryOne
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 20 })
      .mockResolvedValueOnce({
        feedbackId: 7,
        status: 'pending',
        createdAt: new Date('2026-08-08T10:00:00Z'),
      });

    await expect(
      service.create(
        {
          sessionId: 'SES-owned',
          messageId: 20,
          feedbackType: 'correction',
          correctedContent: 'Correct answer',
        },
        5,
      ),
    ).resolves.toMatchObject({ feedbackId: 7, status: 'pending' });

    expect(database.queryOne).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('user_id = $2'),
      ['SES-owned', 5],
    );
    expect(database.queryOne).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('message_id = $1 AND conversation_id = $2'),
      [20, 10],
    );
  });

  it('rejects a foreign conversation or message before inserting feedback', async () => {
    const missingConversation = createService();
    missingConversation.database.queryOne.mockResolvedValueOnce(null);
    await expect(
      missingConversation.service.create(
        { sessionId: 'SES-foreign', feedbackType: 'negative' },
        5,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(missingConversation.database.queryOne).toHaveBeenCalledTimes(1);

    const foreignMessage = createService();
    foreignMessage.database.queryOne
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce(null);
    await expect(
      foreignMessage.service.create(
        {
          sessionId: 'SES-owned',
          messageId: 999,
          feedbackType: 'negative',
        },
        5,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(foreignMessage.database.queryOne).toHaveBeenCalledTimes(2);
  });

  it('applies an approved correction to verified knowledge only when requested', async () => {
    const { client, knowledge, service } = createService();
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            feedback_type: 'correction',
            validation_status: 'pending',
            corrected_content: 'Verified correction',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ feedbackId: 7, status: 'approved' }],
      });

    await expect(
      service.review(7, 9, 'approve', {
        reviewNote: 'Evidence checked',
        applyCorrection: true,
      }),
    ).resolves.toMatchObject({ status: 'applied', knowledgeEntryId: 73 });
    expect(knowledge.applyApprovedCorrection).toHaveBeenCalledWith(7, 9);
  });

  it('records rejection without applying a correction', async () => {
    const { client, knowledge, service } = createService();
    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            feedback_type: 'negative',
            validation_status: 'validating',
            corrected_content: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ feedbackId: 7, status: 'rejected' }],
      });

    await expect(
      service.review(7, 9, 'reject', { reviewNote: 'Unsupported claim' }),
    ).resolves.toMatchObject({
      feedbackId: 7,
      status: 'rejected',
      hasCorrection: false,
    });
    expect(knowledge.applyApprovedCorrection).not.toHaveBeenCalled();
  });

  it('blocks missing or already-reviewed feedback before any update', async () => {
    const missing = createService();
    missing.client.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      missing.service.review(404, 9, 'approve', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.client.query).toHaveBeenCalledTimes(1);

    const reviewed = createService();
    reviewed.client.query.mockResolvedValueOnce({
      rows: [
        {
          feedback_type: 'correction',
          validation_status: 'approved',
          corrected_content: 'Already processed',
        },
      ],
    });
    await expect(
      reviewed.service.review(7, 9, 'reject', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reviewed.client.query).toHaveBeenCalledTimes(1);
  });
});
