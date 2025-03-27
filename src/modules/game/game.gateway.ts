import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GameService } from './game.service';
import { RoomService } from '../room/room.service';
import { UserService } from '../user/user.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { GameEventDto, ScoreUpdateDto } from './dto/game.dto';
import { JwtPayload } from '../auth/dto/auth.dto';
import { RedisService } from '../common/services/redis.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { FishSpawnDto, FishUpdateBehaviorDto } from './dto/fish.dto';
import { ShootBulletDto, BulletCollisionDto, FishCollisionDto } from './dto/bullet.dto';
import { MatchQueueService } from '../room/services/match-queue.service';
import { HeartbeatService } from '../common/services/heartbeat.service';

interface SocketWithUser extends Socket {
  user?: {
    sub: string;  // JwtService现在使用sub作为用户ID
    openId?: string;
    nickname?: string;
    [key: string]: any;
  };
}

@WebSocketGateway({
  port: 8080,
  path: '/ws',
  cors: {
    origin: '*',
  },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  // 存储用户与房间的映射关系
  private userRoomMap = new Map<string, string>();

  private userSocketMap = new Map<string, string>();

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private gameService: GameService,
    private roomService: RoomService,
    private userService: UserService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private configService: ConfigService,
    private matchQueueService: MatchQueueService,
    private heartbeatService: HeartbeatService,
  ) {}

  afterInit(server: Server) {
    console.log('WebSocket 服务器已初始化');
    
    // 启动匹配队列检查器
    this.matchQueueService.startMatchChecker(server);
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`客户端已连接: ${client.id}`);
      
      // 解析JWT令牌
      const token = this.extractToken(client);
      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token, {
            secret: this.configService.get<string>('JWT_SECRET'),
          });
          (client as SocketWithUser).user = payload;
          
          // 记录当前socket所属用户
          const userId = payload.sub;
          this.userSocketMap.set(userId, client.id);
          
          // 向客户端发送连接成功消息
          client.emit('message', {
            type: 'connection',
            data: {
              status: 'connected',
              clientId: client.id,
              timestamp: Date.now()
            }
          });
          
          this.logger.log(`用户 ${userId} 已连接`);
        } catch (error) {
          this.logger.error(`令牌验证失败: ${error.message}`);
        }
      } else {
        // 匿名连接，仍然发送连接成功消息
        client.emit('message', {
          type: 'connection',
          data: {
            status: 'connected',
            clientId: client.id,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      this.logger.error(`处理连接失败: ${error.message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (socketWithUser.user) {
        const userId = socketWithUser.user.sub;
        
        // 清除Redis中的连接记录
        await this.redisService.del(`user:${userId}:socket`);
        
        // 清除心跳记录
        await this.heartbeatService.removeHeartbeat(userId);
        
        // 从匹配队列中移除用户
        await this.matchQueueService.removePlayerFromQueue(userId);
        
        // 如果用户在房间中，则让其离开房间
        const roomId = this.userRoomMap.get(userId);
        if (roomId) {
          // 尝试从房间中移除用户
          try {
            await this.roomService.leaveRoom(roomId, userId);
            this.userRoomMap.delete(userId);
            
            // 通知房间其他人
            this.server.to(roomId).emit('room:user_left', { userId });
            
            // 获取更新后的房间信息并广播
            const room = await this.roomService.findById(roomId);
            if (room) {
              this.server.to(roomId).emit('room:updated', this.roomService.toRoomResponseDto(room));
            }
          } catch (error) {
            console.error(`用户离开房间失败: ${error}`);
          }
        }
        
        console.log(`用户 ${socketWithUser.user.nickname} (${userId}) 已断开连接`);
      }
    } catch (error) {
      console.error(`处理断开连接失败: ${error}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const { roomId } = data;
      
      // 将用户加入到房间的Socket房间
      client.join(roomId);
      
      // 记录用户与房间的关系
      this.userRoomMap.set(userId, roomId);
      
      // 获取房间信息
      const room = await this.roomService.findById(roomId);
      
      // 通知房间其他人
      client.to(roomId).emit('room:user_joined', {
        userId,
        nickname: socketWithUser.user.nickname,
      });
      
      // 如果房间处于倒计时状态，则开始倒计时
      if (room.status === 'countdown') {
        this.gameService.startCountdown(roomId, this.server);
      }
      
      return { success: true, room: this.roomService.toRoomResponseDto(room) };
    } catch (error) {
      console.error(`加入房间失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 从房间中移除用户
      const updatedRoom = await this.roomService.leaveRoom(roomId, userId);
      
      // 从Socket房间中移除
      client.leave(roomId);
      
      // 清除用户房间映射
      this.userRoomMap.delete(userId);
      
      // 通知房间其他人
      this.server.to(roomId).emit('room:user_left', { userId });
      
      // 如果房间还存在，则广播更新后的房间信息
      if (updatedRoom) {
        this.server.to(roomId).emit('room:updated', this.roomService.toRoomResponseDto(updatedRoom));
      }
      
      return { success: true };
    } catch (error) {
      console.error(`离开房间失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:ready')
  async handleSetReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isReady: boolean },
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 设置准备状态
      const updatedRoom = await this.roomService.setReady(roomId, userId, data.isReady);
      
      // 广播更新后的房间信息
      this.server.to(roomId).emit('room:updated', this.roomService.toRoomResponseDto(updatedRoom));
      
      return { success: true };
    } catch (error) {
      console.error(`设置准备状态失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:start')
  async handleStartGame(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 开始游戏
      const updatedRoom = await this.roomService.startGame(roomId, userId);
      
      // 广播游戏开始
      this.server.to(roomId).emit('game:start');
      
      // 启动游戏计时器
      this.gameService.startGameTimer(roomId, this.server);
      
      return { success: true };
    } catch (error) {
      console.error(`开始游戏失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:event')
  async handleGameEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GameEventDto,
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const userId = socketWithUser.user.sub;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 处理游戏事件
      await this.gameService.handleGameEvent(roomId, {
        ...data,
        userId,
        nickname: socketWithUser.user.nickname || '未知玩家',
      }, this.server);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`处理游戏事件失败: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:score')
  async handleScoreUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ScoreUpdateDto,
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 更新得分
      await this.gameService.updatePlayerScore(roomId, userId, data.score, this.server);
      
      return { success: true };
    } catch (error) {
      console.error(`更新得分失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:end')
  async handleEndGame(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 手动结束游戏
      await this.gameService.manualEndGame(roomId, userId, this.server);
      
      return { success: true };
    } catch (error) {
      console.error(`结束游戏失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:next')
  async handleReadyForNextGame(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 准备下一局
      const updatedRoom = await this.roomService.readyForNextGame(roomId, userId);
      
      // 广播更新后的房间信息
      this.server.to(roomId).emit('room:updated', this.roomService.toRoomResponseDto(updatedRoom));
      
      return { success: true };
    } catch (error) {
      console.error(`准备下一局失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:player_init')
  async handlePlayerInit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { position: { x: number, y: number }, weaponType: number }
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { sub: userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 获取房间信息和玩家在房间中的位置
      const room = await this.roomService.findById(roomId);
      const playerIndex = room.players.findIndex(player => player.userId === userId);
      
      if (playerIndex === -1) {
        return { success: false, message: '玩家不在房间中' };
      }
      
      const { positionId, orientation, side, nickname, avatarUrl } = room.players[playerIndex];
      
      // 设置玩家武器类型
      room.players[playerIndex].weaponType = data.weaponType;
      await room.save();
      
      // 广播玩家初始化信息
      const playerInitData = {
        type: 'player',
        roomId,
        playerId: userId,
        data: {
          action: 'init',
          position: data.position,
          orientation,
          side,
          positionId,
          nickname,
          avatarUrl,
          weaponType: data.weaponType,
          score: room.players[playerIndex].score
        }
      };
      
      // 通知房间所有玩家
      this.server.to(roomId).emit('game:player_init', playerInitData);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`玩家初始化失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:shoot')
  async handleShoot(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ShootBulletDto
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { sub: userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 增加玩家ID和时间戳到射击数据
      const shootData = {
        type: 'action',
        roomId,
        playerId: userId,
        data: {
          ...data,
          clientTime: data.clientTime || Date.now()
        },
        timestamp: Date.now()
      };
      
      // 广播射击事件
      this.server.to(roomId).emit('game:shoot', shootData);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`处理射击事件失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:fish_spawn')
  async handleFishSpawn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: FishSpawnDto
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { sub: userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 检查用户是否是房主（只有房主可以生成鱼群）
      const room = await this.roomService.findById(roomId);
      if (room.hostId !== userId) {
        return { success: false, message: '只有房主可以生成鱼群' };
      }
      
      const fishData = {
        type: 'fish',
        roomId,
        data,
        timestamp: Date.now()
      };
      
      // 广播鱼群生成事件
      this.server.to(roomId).emit('game:fish_spawn', fishData);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`处理鱼群生成失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:fish_behavior')
  async handleFishBehavior(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: FishUpdateBehaviorDto
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { sub: userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 检查用户是否是房主（只有房主可以更新鱼群行为）
      const room = await this.roomService.findById(roomId);
      if (room.hostId !== userId) {
        return { success: false, message: '只有房主可以更新鱼群行为' };
      }
      
      const behaviorData = {
        type: 'fish',
        roomId,
        data,
        timestamp: Date.now()
      };
      
      // 广播鱼群行为更新事件
      this.server.to(roomId).emit('game:fish_behavior', behaviorData);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`处理鱼群行为更新失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:bullet_collision')
  async handleBulletCollision(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: BulletCollisionDto
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { sub: userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 检查用户是否是房主（只有房主可以确认子弹碰撞）
      const room = await this.roomService.findById(roomId);
      if (room.hostId !== userId) {
        return { success: false, message: '只有房主可以确认子弹碰撞' };
      }
      
      const collisionData = {
        type: 'game',
        roomId,
        data,
        timestamp: Date.now()
      };
      
      // 广播子弹碰撞事件
      this.server.to(roomId).emit('game:bullet_collision', collisionData);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`处理子弹碰撞失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:fish_collision')
  async handleFishCollision(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: FishCollisionDto
  ) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { sub: userId } = socketWithUser.user;
      const roomId = this.userRoomMap.get(userId);
      
      if (!roomId) {
        return { success: false, message: '用户不在任何房间中' };
      }
      
      // 检查用户是否是房主（只有房主可以确认碰撞）
      const room = await this.roomService.findById(roomId);
      if (room.hostId !== userId) {
        return { success: false, message: '只有房主可以确认碰撞结果' };
      }
      
      // 更新相关玩家的得分
      for (const collision of data.collisions) {
        if (collision.killed) {
          await this.gameService.updatePlayerScore(roomId, collision.playerId, collision.score, this.server);
        }
      }
      
      const collisionData = {
        type: 'game',
        roomId,
        data,
        timestamp: Date.now()
      };
      
      // 广播碰撞事件
      this.server.to(roomId).emit('game:fish_collision', collisionData);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`处理鱼碰撞失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('match:cancel')
  async handleCancelMatch(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权' };
      }
      
      const { userId } = socketWithUser.user;
      
      // 从匹配队列中移除用户
      await this.matchQueueService.removePlayerFromQueue(userId);
      
      return { success: true, message: '已取消匹配' };
    } catch (error) {
      console.error(`取消匹配失败: ${error}`);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权', type: 'heartbeat' };
      }

      const userId = socketWithUser.user.sub;
      const clientId = client.id;
      
      // 记录心跳
      await this.heartbeatService.recordHeartbeat(userId, clientId);
      
      // 发送心跳响应
      return { 
        success: true, 
        event: 'heartbeat',
        data: { 
          status: 'ok',
          timestamp: Date.now()
        }
      };
    } catch (error) {
      this.logger.error(`处理心跳消息时出错: ${error.message}`);
      return { 
        success: false, 
        event: 'heartbeat',
        message: '处理心跳消息时出错' 
      };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('status')
  async handleStatus(@ConnectedSocket() client: Socket) {
    try {
      const socketWithUser = client as SocketWithUser;
      if (!socketWithUser.user) {
        return { success: false, message: '未授权', type: 'status' };
      }

      const userId = socketWithUser.user.sub;
      const status = await this.heartbeatService.getUserOnlineInfo(userId);
      
      return {
        success: true,
        event: 'status',
        data: {
          ...status,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      this.logger.error(`处理状态请求时出错: ${error.message}`);
      return { 
        success: false, 
        event: 'status',
        message: '处理状态请求时出错' 
      };
    }
  }

  private extractToken(client: Socket): string | undefined {
    const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
    return token;
  }
} 