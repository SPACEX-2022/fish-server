import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { RoomService } from '../room.service';
import { RoomType, RoomStatus } from '../schemas/room.schema';
import { Server } from 'socket.io';
import { Types } from 'mongoose';

interface MatchingPlayer {
  userId: string;
  nickname: string;
  avatarUrl: string;
  queuedAt: Date;
}

@Injectable()
export class MatchQueueService {
  private readonly matchingPlayersKey = 'matchingPlayers';
  private readonly maxPlayersPerRoom: number;
  private readonly matchCheckIntervalMs: number = 1000; // 每秒检查一次匹配
  private matchCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private roomService: RoomService,
  ) {
    this.maxPlayersPerRoom = this.configService.get<number>('MAX_PLAYERS_PER_ROOM', 4);
  }

  // 启动匹配队列检查器
  startMatchChecker(io: Server) {
    if (this.matchCheckInterval) {
      clearInterval(this.matchCheckInterval);
    }

    this.matchCheckInterval = setInterval(() => {
      this.checkAndMatchPlayers(io);
    }, this.matchCheckIntervalMs);
  }

  // 停止匹配队列检查器
  stopMatchChecker() {
    if (this.matchCheckInterval) {
      clearInterval(this.matchCheckInterval);
      this.matchCheckInterval = null;
    }
  }

  // 将玩家添加到匹配队列
  async addPlayerToQueue(user: User | UserDocument): Promise<void> {
    const userId = (user as any)._id?.toString();
    
    const player: MatchingPlayer = {
      userId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      queuedAt: new Date(),
    };

    // 检查玩家是否已在队列中
    const existingPlayers = await this.getPlayersInQueue();
    if (existingPlayers.some(p => p.userId === player.userId)) {
      return; // 玩家已在队列中，不需要再添加
    }

    // 添加到Redis列表
    await this.redisService.lpush(this.matchingPlayersKey, JSON.stringify(player));
  }

  // 从匹配队列中移除玩家
  async removePlayerFromQueue(userId: string): Promise<void> {
    const players = await this.getPlayersInQueue();
    const remainingPlayers = players.filter(p => p.userId !== userId);

    // 清空队列并重新添加剩余的玩家
    await this.redisService.del(this.matchingPlayersKey);
    for (const player of remainingPlayers) {
      await this.redisService.lpush(this.matchingPlayersKey, JSON.stringify(player));
    }
  }

  // 获取队列中的所有玩家
  async getPlayersInQueue(): Promise<MatchingPlayer[]> {
    const players = await this.redisService.lrange(this.matchingPlayersKey, 0, -1);
    return players.map(p => JSON.parse(p));
  }

  // 检查并匹配玩家
  async checkAndMatchPlayers(io: Server): Promise<void> {
    try {
      const players = await this.getPlayersInQueue();
      
      // 如果队列中的玩家数量达到开始游戏的要求
      if (players.length >= this.maxPlayersPerRoom) {
        // 取出前N名玩家（这里是最大房间人数）
        const playersToMatch = players.slice(0, this.maxPlayersPerRoom);
        
        // 从队列中移除这些玩家
        for (const player of playersToMatch) {
          await this.removePlayerFromQueue(player.userId);
        }
        
        // 为这些玩家创建一个房间
        await this.createRoomForPlayers(playersToMatch, io);
      }
    } catch (error) {
      console.error('检查匹配玩家出错:', error);
    }
  }

  // 为匹配的玩家创建房间
  private async createRoomForPlayers(players: MatchingPlayer[], io: Server): Promise<void> {
    try {
      if (players.length === 0) return;

      // 第一个玩家作为房主
      const hostId = players[0].userId;
      
      // 获取房主用户信息
      const hostUser = await this.roomService.getUserById(hostId);
      if (!hostUser) {
        throw new Error(`Host user not found: ${hostId}`);
      }

      // 创建新房间
      const createRoomDto = { type: RoomType.PUBLIC };
      const room = await this.roomService.create(hostId, hostUser, createRoomDto);
      
      // 将其他玩家添加到房间
      for (let i = 1; i < players.length; i++) {
        const player = players[i];
        const user = await this.roomService.getUserById(player.userId);
        if (user) {
          const joinRoomDto = { roomCode: room.roomCode };
          await this.roomService.joinRoom(player.userId, user, joinRoomDto);
        }
      }
      
      // 重新获取更新后的房间信息
      const updatedRoom = await this.roomService.findById(room._id.toString());
      
      // 通过WebSocket通知所有玩家匹配成功，等待玩家确认准备
      for (const player of players) {
        // 获取玩家的socket ID
        const socketId = await this.redisService.get(`user:${player.userId}:socket`);
        if (socketId) {
          // 发送匹配成功通知，告知需要手动确认准备
          io.to(socketId).emit('match:success', {
            roomId: room._id.toString(),
            roomCode: room.roomCode,
            readyTimeout: 10, // 10秒准备倒计时
            players: updatedRoom.players.map(p => ({
              userId: p.userId,
              nickname: p.nickname,
              avatarUrl: p.avatarUrl,
            })),
          });
        }
      }
      
      // 所有玩家加入房间，状态设为等待准备
      updatedRoom.status = RoomStatus.WAITING;
      await updatedRoom.save();
      
      // 设置准备超时倒计时
      const readyTimeoutKey = `room:${room._id}:ready_timeout`;
      await this.redisService.set(readyTimeoutKey, 'true');

      // 通知房间所有玩家
      io.to(room._id.toString()).emit('room:updated', this.roomService.toRoomResponseDto(updatedRoom));
      
      // 启动准备倒计时监控
      this.monitorReadyTimeout(room._id.toString(), players, io);
    } catch (error) {
      console.error('为匹配的玩家创建房间出错:', error);
    }
  }

  // 监控准备超时
  private async monitorReadyTimeout(roomId: string, players: MatchingPlayer[], io: Server): Promise<void> {
    // 开始计时
    let countdown = 10;
    const countdownIntervalId = setInterval(async () => {
      // 发送倒计时通知
      io.to(roomId).emit('ready:countdown', { countdown });
      
      countdown--;
      
      if (countdown < 0) {
        clearInterval(countdownIntervalId);
        
        try {
          // 检查房间状态
          const room = await this.roomService.findById(roomId);
          if (!room) {
            return; // 房间可能已被删除
          }
          
          // 找出未准备的玩家
          const notReadyPlayers = room.players.filter(p => !p.isReady);
          
          if (notReadyPlayers.length > 0) {
            // 有玩家未准备，取消匹配
            const notReadyIds = notReadyPlayers.map(p => p.userId);
            
            // 通知所有玩家匹配取消
            io.to(roomId).emit('match:canceled', {
              reason: 'ready_timeout',
              message: '部分玩家未准备，匹配已取消',
              notReadyPlayers: notReadyIds
            });
            
            // 将准备的玩家重新加入匹配队列
            const readyPlayers = room.players.filter(p => p.isReady);
            for (const player of readyPlayers) {
              const user = await this.roomService.getUserById(player.userId);
              if (user) {
                await this.addPlayerToQueue(user as unknown as User);
              }
            }
            
            // 删除房间
            await this.roomService.deleteRoom(roomId);
          } else {
            // 所有玩家都已准备，可以开始游戏
            await this.startRoomGame(roomId, io);
          }
        } catch (error) {
          console.error('处理准备超时出错:', error);
        }
      }
    }, 1000);
    
    // 将倒计时ID存入Redis，以便可以在所有玩家准备好时取消
    await this.redisService.set(`room:${roomId}:ready_countdown`, countdownIntervalId.toString());
  }

  // 当所有玩家准备好后启动游戏
  public async startRoomGame(roomId: string, io: Server): Promise<void> {
    try {
      const room = await this.roomService.findById(roomId);
      if (!room) {
        return;
      }
      
      // 如果所有玩家都已准备好，开始游戏倒计时
      const allReady = room.players.every(p => p.isReady);
      if (allReady) {
        // 取消准备超时倒计时
        const countdownId = await this.redisService.get(`room:${roomId}:ready_countdown`);
        if (countdownId) {
          clearInterval(parseInt(countdownId));
          await this.redisService.del(`room:${roomId}:ready_countdown`);
        }
        
        // 设置房间状态为倒计时
        room.status = RoomStatus.COUNTDOWN;
        await room.save();
        
        // 通知房间所有玩家游戏即将开始
        io.to(roomId).emit('room:updated', this.roomService.toRoomResponseDto(room));
        
        // 启动游戏倒计时
        this.roomService.getGameService().startCountdown(roomId, io);
      }
    } catch (error) {
      console.error('启动房间游戏出错:', error);
    }
  }
} 