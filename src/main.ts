import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TransformInterceptor } from './modules/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './modules/common/filters/http-exception.filter';
import { WsAdapter } from './modules/common/adapters/ws.adapter';
import { fixArraySchemas } from './modules/common/plugins/swagger-array.plugin';
import { HttpsOptions } from '@nestjs/common/interfaces/external/https-options.interface';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // 显示系统信息
  const nodeVersion = process.version;
  const platform = `${os.platform()} ${os.release()}`;
  const memory = `${Math.round(os.totalmem() / 1024 / 1024)} MB`;
  
  logger.log('====================================');
  logger.log('多人捕鱼游戏服务器正在启动...');
  logger.log(`运行环境: Node.js ${nodeVersion}`);
  logger.log(`系统平台: ${platform}`);
  logger.log(`系统内存: ${memory}`);
  logger.log(`进程ID: ${process.pid}`);
  logger.log('====================================');
  
  // 检查是否需要使用HTTPS
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
  let httpsOptions: HttpsOptions | undefined = undefined;
  
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
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
      stopAtFirstError: true,
    }),
  );

  // 添加全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());
  
  // 添加全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 应用WebSocket适配器，使用原生WebSocket协议
  app.useWebSocketAdapter(new WsAdapter(app));

  // 设置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('多人捕鱼游戏服务器')
    .setDescription('多人捕鱼游戏服务器API文档')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: '输入JWT token',
      in: 'header',
    })
    .addTag('认证', '用户认证与登录相关接口')
    .addTag('用户', '用户信息相关接口')
    .addTag('房间', '游戏房间相关接口')
    .addTag('游戏', '游戏相关接口')
    .build();
  
  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    extraModels: [
      // 添加所有需要在Swagger中显示的DTOs
      require('./modules/user/dto/user.dto').UserProfileDto,
      require('./modules/user/dto/user.dto').UserDto,
      require('./modules/auth/dto/auth.dto').LoginResponseDto,
      require('./modules/room/dto/room.dto').RoomResponseDto,
      require('./modules/game/dto/game.dto').GameRecordDto,
      require('./modules/game/dto/game.dto').PlayerGameRecordsDto,
    ],
  });
  
  // 修复数组显示问题
  const fixedDocument = fixArraySchemas(document);
  
  SwaggerModule.setup('api/docs', app, fixedDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
    },
  });

  // 启动服务
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  // 打印环境变量 
  logger.log('====================================');
  logger.log('环境变量:');
  logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  logger.log(`PORT: ${process.env.PORT}`);
  logger.log(`MONGODB_URI: ${process.env.MONGODB_URI}`);
  logger.log(`WX_APPID: ${process.env.WX_APPID}`);
  logger.log(`WX_SECRET: ${process.env.WX_SECRET}`);
  logger.log('====================================');

  
  const protocol = httpsEnabled ? 'https' : 'http';
  logger.log('====================================');
  logger.log(`服务器已在端口 ${port} 启动 (${protocol})`);
  logger.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`API文档地址: ${protocol}://localhost:${port}/api/docs`);
  logger.log('====================================');
}
bootstrap();
