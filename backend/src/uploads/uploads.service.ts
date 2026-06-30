import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadsService {
  placeholder(kind: string) {
    return { kind, provider: 'cloudinary', message: 'Upload integration is prepared for a later MVP step.' };
  }
}
