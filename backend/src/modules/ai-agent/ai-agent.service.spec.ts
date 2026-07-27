import { NotFoundException } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';

describe('AiAgentService admin activity', () => {
  it('returns paginated drafts and explicit unsupported capabilities', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '1' }),
      query: jest.fn().mockResolvedValue([{ id: 2, status: 'draft' }]),
    };
    const service = new AiAgentService(database as never);
    await expect(
      service.adminActivity({ page: 1, pageSize: 20, offset: 0 } as never),
    ).resolves.toMatchObject({
      total: 1,
      items: [{ id: 2 }],
      capabilities: {
        promptHistory: false,
        modelUsage: false,
        recommendationTelemetry: false,
      },
    });
  });

  it('returns a structured empty result', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '0' }),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new AiAgentService(database as never);
    await expect(
      service.adminActivity({ page: 1, pageSize: 20, offset: 0 } as never),
    ).resolves.toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('loads a retained AI draft detail and rejects missing records', async () => {
    const database = { queryOne: jest.fn().mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce(null) };
    const service = new AiAgentService(database as never);
    await expect(service.adminActivityOne(2)).resolves.toEqual({ id: 2 });
    await expect(service.adminActivityOne(3)).rejects.toBeInstanceOf(NotFoundException);
  });
});
