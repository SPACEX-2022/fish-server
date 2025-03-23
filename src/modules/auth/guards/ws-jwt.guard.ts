import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import * as url from 'url';

/**
 * WebSocket JWT守卫
 * 用于验证WebSocket连接中的JWT令牌
 * 验证成功后会将用户信息附加到client实例上
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const token = this.extractToken(client);
      
      if (!token) {
        this.logger.warn('未提供认证令牌');
        throw new WsException('未提供认证令牌');
      }
      
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        
        // 将用户信息附加到客户端
        client.user = payload;
        return true;
      } catch (error) {
        this.logger.error(`令牌验证失败: ${error.message}`);
        throw new WsException('令牌无效或已过期');
      }
    } catch (err) {
      this.logger.error(`认证失败: ${err.message}`);
      throw new WsException(err.message || '未授权');
    }
  }
  
  private extractToken(client: any): string | undefined {
    // 1. 尝试从URL查询参数获取token
    if (client.req) {
      // 解析请求URL
      const parsedUrl = url.parse(client.req.url, true);
      if (parsedUrl.query && parsedUrl.query.token) {
        return parsedUrl.query.token as string;
      }
      
      // 2. 从headers中获取
      const headers = client.req.headers;
      if (headers.authorization) {
        const authHeader = headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          return authHeader.substring(7);
        }
        return authHeader;
      }
    }
    
    return undefined;
  }
} 