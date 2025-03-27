import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { RoomService } from '../room.service';
import { RoomType } from '../schemas/room.schema';
import { Server } from 'socket.io';

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
  async addPlayerToQueue(user: UserDocument): Promise<void> {
    const player: MatchingPlayer = {
      userId: user._id.toString(),
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
      
      // 通过WebSocket通知所有玩家匹配成功
      for (const player of players) {
        // 获取玩家的socket ID
        const socketId = await this.redisService.get(`user:${player.userId}:socket`);
        if (socketId) {
          // 发送匹配成功通知
          io.to(socketId).emit('match:success', {
            roomId: room._id.toString(),
            roomCode: room.roomCode,
            countdown: 5, // 5秒后开始游戏
            players: updatedRoom.players.map(p => ({
              userId: p.userId,
              nickname: p.nickname,
              avatarUrl: p.avatarUrl,
            })),
          });
        }
      }
      
      // 开始游戏倒计时
      updatedRoom.status = 'countdown';
      await updatedRoom.save();

      // 通知房间所有玩家
      io.to(room._id.toString()).emit('room:updated', this.roomService.toRoomResponseDto(updatedRoom));
      
      // 开始倒计时
      setTimeout(() => {
        // 启动游戏倒计时
        this.roomService.getGameService().startCountdown(room._id.toString(), io);
      }, 100);
    } catch (error) {
      console.error('为匹配的玩家创建房间出错:', error);
    }
  }
} 