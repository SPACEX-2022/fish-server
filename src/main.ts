import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // 检查是否需要使用HTTPS
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
  let httpsOptions: { cert: Buffer; key: Buffer } | undefined = undefined;
  
  if (httpsEnabled) {
    try {
      // 证书路径，请根据实际情况调整
      const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/cert.pem');
      const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/key.pem');
      
      httpsOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      };
      logger.log('已加载SSL证书');
    } catch (error) {
      logger.error('加载SSL证书失败', error);
      process.exit(1);
    }
  }
  
  // 创建应用实例
  const app = await NestFactory.create(AppModule, { httpsOptions });
  const configService = app.get(ConfigService);

  // 设置全局前缀
  app.setGlobalPrefix('api');

  // 启用CORS
  app.enableCors();

  // 添加全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 设置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('多人钓鱼游戏服务器')
    .setDescription('多人钓鱼游戏服务器API文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 启动服务
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  
  const protocol = httpsEnabled ? 'https' : 'http';
  logger.log(`服务器已在端口 ${port} 启动 (${protocol})`);
  logger.log(`API文档地址: ${protocol}://localhost:${port}/api/docs`);
}
bootstrap();
