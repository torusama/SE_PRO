import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { TransfersController } from './transfers.controller';

describe('TransfersController admin guards', () => {
  it('protects every route at controller level', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TransfersController)).toEqual(['admin']);
  });
});
