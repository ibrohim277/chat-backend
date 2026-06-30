import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: '*', // Keyinchalik frontend URL ni qo'ying
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Chat API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
