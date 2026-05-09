import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  const logger = new Logger('Bootstrap');

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Security headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP is set on the web app, not the API
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global validation: strip unknown props, fail on extras, auto-transform
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS allowlist (multiple origins, fail-closed)
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FRONTEND_URL must be set in production for CORS');
    }
    allowedOrigins.push('http://localhost:3000');
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true); // same-origin / non-browser
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`Blocked CORS origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/api/v1`);
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
