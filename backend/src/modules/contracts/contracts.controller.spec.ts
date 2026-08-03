import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import {
  ContractsController,
  isSignedEvidenceDocument,
} from './contracts.controller';

describe('ContractsController admin guards', () => {
  const controller = new ContractsController({} as never);

  it.each([
    'adminList',
    'adminOne',
    'fromReservation',
    'updateStatus',
    'addPayment',
    'updateInheritance',
    'uploadSignedEvidence',
    'signedEvidence',
    'activateOwnership',
  ] as const)('%s requires admin role', (method) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller[method])).toEqual([
      'admin',
    ]);
  });

  it.each([
    ['application/pdf', 'hop-dong.pdf'],
    ['application/msword', 'hop-dong.doc'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'hop-dong.docx',
    ],
  ])('accepts signed evidence %s with its matching extension', (mime, name) => {
    expect(isSignedEvidenceDocument(mime, name)).toBe(true);
  });

  it.each([
    ['image/jpeg', 'hop-dong.jpg'],
    ['application/pdf', 'hop-dong.doc'],
    ['application/msword', 'hop-dong.docx'],
  ])('rejects unsupported or mismatched signed evidence %s', (mime, name) => {
    expect(isSignedEvidenceDocument(mime, name)).toBe(false);
  });
});
