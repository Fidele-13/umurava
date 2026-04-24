import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log("🚀 Starting NestJS app...");
  console.log("PORT:", process.env.PORT);
  console.log("MONGO_URI:", process.env.MONGO_URI ? "SET ✅" : "MISSING ❌");

  const app = await NestFactory.create(AppModule);

  // 🔥 Read allowed origins from env
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

  console.log("🌐 Allowed Origins:", allowedOrigins);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;

  await app.listen(port);

  console.log(`✅ App is running on port ${port}`);
}

bootstrap();