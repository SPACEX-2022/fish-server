import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { HeartbeatService } from '../services/heartbeat.service';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { JwtPayload } from '../../auth/dto/auth.dto';
import * as WebSocket from 'ws';

// 扩展WebSocket类型以包含user属性
interface WsWithUser extends WebSocket {
  user?: JwtPayload;
  id?: string; // 客户端ID
  req?: any; // 请求对象
}

@WebSocketGateway({
  port: 8080,
  path: '/ws/heartbeat', // 使用路径而不是命名空间
})
export class HeartbeatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: WebSocket.Server;

  private readonly logger = new Logger('HeartbeatGateway');
  private readonly clients = new Map<string, WsWithUser>(); // clientId -> websocket
  private readonly userClients = new Map<string, string[]>(); // userId -> clientId[]
  private clientCounter = 0; // 客户端计数器，用于生成唯一ID

  constructor(
    private readonly heartbeatService: HeartbeatService,
  ) {}

  async handleConnection(client: WsWithUser) {
    try {
      // 分配一个唯一的客户端ID
      client.id = `client_${++this.clientCounter}`;
      
      this.logger.log(`客户端已连接: ${client.id}`);
      this.logger.debug(`连接信息: ${JSON.stringify({
        headers: client.req?.headers,
        url: client.req?.url,
      })}`);

      // 保存客户端
      this.clients.set(client.id, client);

      // 发送连接成功消息
      this.sendToClient(client, 'connection', { 
        status: 'connected',
        clientId: client.id,
        timestamp: Date.now()
      });
    } catch (error) {
      this.logger.error(`处理连接时出错: ${error.message}`);
      client.close();
    }
  }

  async handleDisconnect(client: WsWithUser) {
    try {
      if (!client.id) {
        this.logger.warn('无法识别断开连接的客户端，没有ID');
        return;
      }

      this.logger.log(`客户端已断开连接: ${client.id}`);
      
      // 从客户端映射中移除
      this.clients.delete(client.id);
      
      // 如果是已认证用户，更新用户客户端映射
      if (client.user) {
        const userId = client.user.sub;
        const userClientIds = this.userClients.get(userId) || [];
        
        // 从用户的客户端列表中移除此客户端
        const updatedClientIds = userClientIds.filter(id => id !== client.id);
        
        if (updatedClientIds.length > 0) {
          // 用户还有其他活跃连接
          this.userClients.set(userId, updatedClientIds);
        } else {
          // 用户没有其他活跃连接，移除心跳和用户映射
          this.userClients.delete(userId);
          await this.heartbeatService.removeHeartbeat(userId);
        }
      }
    } catch (error) {
      this.logger.error(`处理断开连接时出错: ${error.message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: WsWithUser) {
    try {
      if (!client.user) {
        this.logger.warn(`未授权的心跳请求: ${client.id}`);
        this.sendToClient(client, 'error', { message: '未授权的请求' });
        return;
      }

      if (!client.id) {
        this.logger.warn('客户端没有ID，无法处理心跳');
        this.sendToClient(client, 'error', { message: '无效的客户端' });
        return;
      }

      const userId = client.user.sub;
      const clientId = client.id;
      
      // 记录心跳
      await this.heartbeatService.recordHeartbeat(userId, clientId);
      
      // 更新用户客户端映射
      const userClientIds = this.userClients.get(userId) || [];
      if (!userClientIds.includes(clientId)) {
        userClientIds.push(clientId);
        this.userClients.set(userId, userClientIds);
      }
      
      // 发送心跳响应
      this.sendToClient(client, 'heartbeat', { 
        status: 'ok',
        timestamp: Date.now()
      });
      
      this.logger.debug(`用户 ${userId} 的客户端 ${clientId} 心跳已更新`);
    } catch (error) {
      this.logger.error(`处理心跳消息时出错: ${error.message}`);
      if (client.id) {
        this.sendToClient(client, 'error', { message: '处理心跳消息时出错' });
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('status')
  async handleStatus(@ConnectedSocket() client: WsWithUser) {
    try {
      if (!client.user) {
        this.logger.warn(`未授权的状态请求: ${client.id}`);
        this.sendToClient(client, 'error', { message: '未授权的请求' });
        return;
      }

      const userId = client.user.sub;
      const status = await this.heartbeatService.getUserOnlineInfo(userId);
      
      this.sendToClient(client, 'status', {
        ...status,
        timestamp: Date.now()
      });
      
      this.logger.debug(`用户 ${userId} 的状态已发送`);
    } catch (error) {
      this.logger.error(`处理状态请求时出错: ${error.message}`);
      if (client.id) {
        this.sendToClient(client, 'error', { message: '处理状态请求时出错' });
      }
    }
  }

  // 辅助方法：向客户端发送事件
  private sendToClient(client: WsWithUser, event: string, data: any): void {
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          event,
          data
        });
        client.send(message);
      } catch (error) {
        this.logger.error(`向客户端 ${client.id} 发送消息时出错: ${error.message}`);
      }
    }
  }
} 