import { BadRequestException } from '@nestjs/common';
import { AgentToolRegistryService } from './agent-tool-registry.service';

describe('AgentToolRegistryService', () => {
  const registry = new AgentToolRegistryService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('rejects malformed JSON tool arguments', () => {
    expect(() => registry.parseArguments('{bad json')).toThrow(
      BadRequestException,
    );
  });

  it('rejects tools outside the allowlist', async () => {
    await expect(registry.execute('drop_database', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
