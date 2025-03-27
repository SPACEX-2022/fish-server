import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseLoggerService } from './services/database-logger.service';
import { HeartbeatService } from './services/heartbeat.service';
import { HeartbeatController } from './controllers/heartbeat.controller';
import { JwtModule } from '@nestjs/jwt';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [HeartbeatController],
  providers: [
    RedisService, 
    DatabaseLoggerService, 
    HeartbeatService,
  ],
  exports: [RedisService, HeartbeatService, JwtModule],
})
export class CommonModule {} 