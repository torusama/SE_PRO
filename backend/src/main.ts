import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import * as fs from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  // Ensure local upload dirs exist (avatars, documents, etc.)
  const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(join(process.cwd(), 'uploads', 'contracts'), {
    recursive: true,
  });
  fs.mkdirSync(join(process.cwd(), 'uploads', 'transfers'), {
    recursive: true,
  });
  fs.mkdirSync(join(process.cwd(), 'uploads', 'service-completions'), {
    recursive: true,
  });

  app.setGlobalPrefix('api');
  // Static files are served OUTSIDE the /api prefix, e.g. http://localhost:3001/uploads/avatars/xxx.jpg
  app.useStaticAssets(join(process.cwd(), 'uploads', 'avatars'), {
    prefix: '/uploads/avatars',
  });
  app.enableCors({
    origin: frontendUrl.split(',').map((url) => url.trim()),
    credentials: true,
  });
  app.use(
    helmet({
      // Allow the frontend (different origin) to load avatar images from /uploads
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(Number(process.env.PORT) || 3001);
}
bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
