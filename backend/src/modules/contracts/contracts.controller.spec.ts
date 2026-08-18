import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import {
  ContractsController,
  decodeMultipartFilename,
  hasSignedEvidenceSignature,
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
    'markPdfGenerated',
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
    ['application/octet-stream', 'hop-dong.pdf'],
    ['application/octet-stream', 'hop-dong.doc'],
    ['application/octet-stream', 'hop-dong.docx'],
  ])('accepts signed evidence %s with its matching extension', (mime, name) => {
    expect(isSignedEvidenceDocument(mime, name)).toBe(true);
  });

  it.each([
    ['image/jpeg', 'hop-dong.jpg'],
    ['image/jpeg', 'hop-dong.jpeg'],
    ['image/png', 'hop-dong.png'],
    ['image/webp', 'hop-dong.webp'],
    ['image/jpeg', 'hop-dong.png'],
    ['application/pdf', 'hop-dong.doc'],
    ['application/msword', 'hop-dong.docx'],
    ['application/octet-stream', 'hop-dong.jpg'],
  ])('rejects unsupported or mismatched signed evidence %s', (mime, name) => {
    expect(isSignedEvidenceDocument(mime, name)).toBe(false);
  });

  it.each([
    [Buffer.from('%PDF-1.7\n'), 'hop-dong.pdf'],
    [
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      'hop-dong.doc',
    ],
    [
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('word/document.xml [Content_Types].xml'),
      ]),
      'hop-dong.docx',
    ],
  ])('accepts real signed evidence content for %s', (content, name) => {
    expect(hasSignedEvidenceSignature(content, name)).toBe(true);
  });

  it.each([
    [Buffer.from('not a pdf'), 'hop-dong.pdf'],
    [Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'hop-dong.docx'],
    [Buffer.from('%PDF-1.7\n'), 'hop-dong.doc'],
  ])('rejects forged signed evidence content for %s', (content, name) => {
    expect(hasSignedEvidenceSignature(content, name)).toBe(false);
  });

  it('restores a UTF-8 multipart filename decoded as Latin-1', () => {
    const original = 'Bài 5.pdf';
    const latin1Decoded = Buffer.from(original, 'utf8').toString('latin1');

    expect(decodeMultipartFilename(latin1Decoded)).toBe(original);
  });

  it.each(['hop-dong.pdf', 'Bài 5.pdf', '合同.pdf'])(
    'keeps an already valid filename unchanged: %s',
    (filename) => {
      expect(decodeMultipartFilename(filename)).toBe(filename);
    },
  );
});
