import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AiAgentController } from './ai-agent.controller';

describe('AiAgentController conversation roles', () => {
  it.each(['conversationList', 'conversation', 'deleteConversation'] as const)(
    'allows both customers and admins to use %s',
    (method) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, AiAgentController.prototype[method]),
      ).toEqual(['customer', 'admin']);
    },
  );
});
