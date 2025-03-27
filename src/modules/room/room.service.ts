import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { Room, RoomDocument, RoomStatus, RoomType } from './schemas/room.schema';
import { CreateRoomDto, JoinRoomDto, RoomResponseDto, RoomListItemDto } from './dto/room.dto';
import { User, UserDocument } from '../user/schemas/user.schema';
import { RedisService } from '../common/services/redis.service';
import { UserService } from '../user/user.service';
import { GameService } from '../game/game.service';

@Injectable()
export class RoomService {
  private readonly maxPlayersPerRoom: number;

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private configService: ConfigService,
    private redisService: RedisService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => GameService))
    private gameService: GameService,
  ) {
    this.maxPlayersPerRoom = this.configService.get<number>('MAX_PLAYERS_PER_ROOM', 4);
  }

  /**
   * 生成随机房间号
   */
  private generateRoomCode(): string {
    // 生成六位数随机房间号
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 查找可用的房间号
   */
  private async findAvailableRoomCode(): Promise<string> {
    let roomCode: string;
    let exists = true;
    
    // 尝试生成不重复的房间号
    while (exists) {
      roomCode = this.generateRoomCode();
      const existingRoom = await this.roomModel.findOne({ roomCode }).exec();
      exists = !!existingRoom;
    }
    
    // @ts-ignore
    return roomCode;
  }

  /**
   * 创建新房间
   */
  async create(userId: string, user: User, createRoomDto: CreateRoomDto): Promise<RoomDocument> {
    // 检查用户是否已在其他房间中
    const existingRoom = await this.roomModel.findOne({
      'players.userId': userId,
      status: { $ne: RoomStatus.FINISHED },
    }).exec();
    
    if (existingRoom) {
      throw new BadRequestException('用户已在其他房间中');
    }
    
    // 生成唯一房间号
    const roomCode = await this.findAvailableRoomCode();
    
    // 创建房间
    const newRoom = new this.roomModel({
      roomCode,
      type: createRoomDto.type,
      status: RoomStatus.WAITING,
      hostId: userId,
      players: [
        {
          userId,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          score: 0,
          isReady: false,
          isHost: true,
        },
      ],
      expiresAt: new Date(Date.now() + 3600000), // 1小时后过期
    });
    
    return newRoom.save();
  }

  /**
   * 通过ID查找房间
   */
  async findById(roomId: string): Promise<RoomDocument> {
    const room = await this.roomModel.findById(roomId).exec();
    
    if (!room) {
      throw new NotFoundException('房间不存在');
    }
    
    return room;
  }

  /**
   * 通过房间号查找房间
   */
  async findByCode(roomCode: string): Promise<RoomDocument> {
    const room = await this.roomModel.findOne({ roomCode }).exec();
    
    if (!room) {
      throw new NotFoundException('房间不存在');
    }
    
    return room;
  }

  /**
   * 获取公共房间列表
   */
  async findPublicRooms(): Promise<RoomListItemDto[]> {
    const rooms = await this.roomModel.find({
      type: RoomType.PUBLIC,
      status: { $in: [RoomStatus.WAITING, RoomStatus.COUNTDOWN] },
    }).exec();
    
    return rooms.map(room => this.toRoomListItemDto(room));
  }

  /**
   * 加入房间
   */
  async joinRoom(userId: string, user: User, joinRoomDto: JoinRoomDto): Promise<RoomDocument> {
    // 检查用户是否已在其他房间中
    const existingRoom = await this.roomModel.findOne({
      'players.userId': userId,
      status: { $ne: RoomStatus.FINISHED },
    }).exec();
    
    if (existingRoom) {
      throw new BadRequestException('用户已在其他房间中');
    }
    
    // 查找房间
    const room = await this.findByCode(joinRoomDto.roomCode);
    
    // 检查房间状态
    if (room.status === RoomStatus.PLAYING || room.status === RoomStatus.FINISHED) {
      throw new BadRequestException('房间已开始游戏或已结束');
    }
    
    // 检查房间是否已满
    if (room.players.length >= this.maxPlayersPerRoom) {
      throw new BadRequestException('房间已满');
    }
    
    // 检查用户是否已在房间中
    const isInRoom = room.players.some(player => player.userId === userId);
    if (isInRoom) {
      throw new BadRequestException('用户已在房间中');
    }
    
    // 将用户添加到房间
    room.players.push({
      userId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      score: 0,
      isReady: false,
      isHost: false,
    });
    
    // 如果是公共房间且达到自动开始条件，则开始倒计时
    const publicStartCount = this.configService.get<number>('PUBLIC_MATCH_START_PLAYER_COUNT', 2);
    if (room.type === RoomType.PUBLIC && room.players.length >= publicStartCount) {
      const allReady = room.players.every(player => player.isReady);
      if (allReady) {
        room.status = RoomStatus.COUNTDOWN;
      }
    }
    
    return room.save();
  }

  /**
   * 离开房间
   */
  async leaveRoom(roomId: string, userId: string): Promise<RoomDocument | null> {
    // 查找房间
    const room = await this.findById(roomId);
    
    // 检查用户是否在房间中
    const playerIndex = room.players.findIndex(player => player.userId === userId);
    if (playerIndex === -1) {
      throw new NotFoundException('用户不在房间中');
    }
    
    const isHost = room.players[playerIndex].isHost;
    
    // 从房间中移除用户
    room.players.splice(playerIndex, 1);
    
    // 如果没有玩家了，删除房间
    if (room.players.length === 0) {
      await this.roomModel.findByIdAndDelete(roomId).exec();
      return null;
    }
    
    // 如果是房主离开且还有其他玩家，则转移房主权限
    if (isHost && room.players.length > 0) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].userId;
    }
    
    // 如果是公共房间且人数不足自动开始条件，则设置状态为等待
    const publicStartCount = this.configService.get<number>('PUBLIC_MATCH_START_PLAYER_COUNT', 2);
    if (room.type === RoomType.PUBLIC && room.players.length < publicStartCount && room.status === RoomStatus.COUNTDOWN) {
      room.status = RoomStatus.WAITING;
    }
    
    return room.save();
  }

  /**
   * 设置玩家准备状态
   */
  async setReady(roomId: string, userId: string, isReady: boolean): Promise<RoomDocument> {
    // 查找房间
    const room = await this.findById(roomId);
    
    // 检查房间状态
    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('房间状态不允许设置准备状态');
    }
    
    // 检查用户是否在房间中
    const playerIndex = room.players.findIndex(player => player.userId === userId);
    if (playerIndex === -1) {
      throw new NotFoundException('用户不在房间中');
    }
    
    // 更新准备状态
    room.players[playerIndex].isReady = isReady;
    
    return room.save();
  }

  /**
   * 开始游戏
   */
  async startGame(roomId: string, userId: string): Promise<RoomDocument> {
    // 查找房间
    const room = await this.findById(roomId);
    
    // 检查用户是否是房主
    if (room.hostId !== userId) {
      throw new ForbiddenException('只有房主可以开始游戏');
    }
    
    // 检查房间状态
    if (room.status === RoomStatus.PLAYING) {
      throw new BadRequestException('游戏已经开始');
    }
    
    // 检查玩家数量
    if (room.players.length < 1) {
      throw new BadRequestException('玩家数量不足');
    }
    
    // 公共房间检查所有玩家是否准备就绪
    if (room.type === RoomType.PUBLIC) {
      const allReady = room.players.every(player => player.isHost || player.isReady);
      if (!allReady) {
        throw new BadRequestException('有玩家未准备就绪');
      }
    }
    
    // 为所有玩家分配位置
    await this.resetPlayerPositions(room);
    
    // 更新房间状态为游戏中
    room.status = RoomStatus.PLAYING;
    room.startTime = new Date();
    
    return room.save();
  }

  /**
   * 结束游戏
   */
  async endGame(roomId: string): Promise<RoomDocument> {
    // 查找房间
    const room = await this.findById(roomId);
    
    // 检查房间状态
    if (room.status !== RoomStatus.PLAYING) {
      throw new BadRequestException('房间未在游戏中');
    }
    
    // 更新房间状态
    room.status = RoomStatus.FINISHED;
    room.endTime = new Date();
    
    return room.save();
  }

  /**
   * 准备下一局游戏
   */
  async readyForNextGame(roomId: string, userId: string): Promise<RoomDocument> {
    // 查找房间
    const room = await this.findById(roomId);
    
    // 检查房间状态
    if (room.status !== RoomStatus.FINISHED) {
      throw new BadRequestException('房间未在结束状态');
    }
    
    // 检查用户是否在房间中
    const playerIndex = room.players.findIndex(player => player.userId === userId);
    if (playerIndex === -1) {
      throw new NotFoundException('用户不在房间中');
    }
    
    // 更新准备状态
    room.players[playerIndex].isReady = true;
    
    // 重置玩家分数
    room.players[playerIndex].score = 0;
    
    // 检查是否所有玩家都准备好了
    const allReady = room.players.every(player => player.isReady);
    
    // 如果所有玩家都准备好了，则重置房间状态
    if (allReady) {
      room.status = RoomStatus.WAITING;
      room.startTime = null;
      room.endTime = null;
    }
    
    return room.save();
  }

  /**
   * 更新玩家得分
   */
  async updatePlayerScore(roomId: string, userId: string, score: number): Promise<RoomDocument | null> {
    // 查找房间
    const room = await this.findById(roomId);
    
    // 检查用户是否在房间中
    const playerIndex = room.players.findIndex(player => player.userId === userId);
    if (playerIndex === -1) {
      throw new NotFoundException('用户不在房间中');
    }
    
    // 更新得分
    room.players[playerIndex].score += score;
    
    return room.save();
  }

  /**
   * 更新房间状态
   */
  async updateRoomStatus(roomId: string, status: string): Promise<RoomDocument> {
    const room = await this.findById(roomId);
    room.status = status;
    return room.save();
  }

  /**
   * 转换为房间列表项DTO
   */
  private toRoomListItemDto(room: RoomDocument): RoomListItemDto {
    const hostPlayer = room.players.find(p => p.isHost);
    
    return {
      id: room._id.toString(),
      roomCode: room.roomCode,
      type: room.type as RoomType,
      status: room.status as RoomStatus,
      playerCount: room.players.length,
      hostName: hostPlayer?.nickname || '未知',
      createdAt: room.createdAt,
    };
  }

  /**
   * 转换为房间响应DTO
   */
  toRoomResponseDto(room: RoomDocument): RoomResponseDto {
    return {
      id: room._id.toString(),
      roomCode: room.roomCode,
      type: room.type as RoomType,
      status: room.status as RoomStatus,
      players: room.players,
      hostId: room.hostId.toString(),
      startTime: room.startTime,
      endTime: room.endTime,
      currentRound: room.currentRound,
      createdAt: room.createdAt,
    };
  }

  /**
   * 获取可匹配的房间 - 未开始且人数未满的公共房间
   * 使用 Redis 锁确保高并发情况下不会将同一房间分配给过多用户
   */
  async findMatchableRoom(userId: string): Promise<RoomDocument | null> {
    // 首先检查用户是否已在房间中
    const existingUserRoom = await this.roomModel.findOne({
      'players.userId': userId,
      status: { $ne: RoomStatus.FINISHED },
    }).exec();
    
    if (existingUserRoom) {
      throw new BadRequestException('用户已在其他房间中');
    }

    // 查找所有可匹配的公共房间（等待中且人数未满）
    const matchableRooms = await this.roomModel.find({
      type: RoomType.PUBLIC,
      status: RoomStatus.WAITING,
    }).exec();
    
    // 如果没有可匹配的房间，返回null
    if (!matchableRooms || matchableRooms.length === 0) {
      return null;
    }
    
    // 尝试为用户锁定一个房间
    for (const room of matchableRooms) {
      // 如果房间已满，跳过
      if (room.players.length >= this.maxPlayersPerRoom) {
        continue;
      }
      
      // 使用Redis尝试锁定该房间，锁定时间为5秒
      const lockKey = `room:lock:${room._id}`;
      const acquired = await this.redisService.acquireLock(lockKey, userId, 5);
      
      if (acquired) {
        try {
          // 再次检查房间状态和玩家数量（可能在获取锁的过程中被其他请求修改）
          const freshRoom = await this.roomModel.findById(room._id).exec();
          if (freshRoom && 
              freshRoom.status === RoomStatus.WAITING && 
              freshRoom.players.length < this.maxPlayersPerRoom) {
            return freshRoom;
          }
        } finally {
          // 无论成功与否，释放锁
          await this.redisService.releaseLock(lockKey, userId);
        }
      }
    }
    
    // 没有找到可用房间
    return null;
  }

  /**
   * 将房间信息转换为匹配响应DTO
   */
  toMatchRoomResponseDto(room: RoomDocument): any {
    return {
      success: true,
      message: '匹配成功',
      status: 'matched'
    };
  }

  /**
   * 分配玩家位置
   * @param room 房间
   * @param playerId 玩家ID
   */
  async assignPlayerPosition(room: RoomDocument, playerId: string): Promise<RoomDocument> {
    const playerIndex = room.players.findIndex(player => player.userId === playerId);
    
    if (playerIndex === -1) {
      throw new NotFoundException('玩家不在房间中');
    }
    
    // 获取已分配的位置
    const usedPositions = room.players
      .filter(player => player.positionId !== undefined)
      .map(player => player.positionId);
    
    // 可用位置（1-4）
    const availablePositions = [1, 2, 3, 4].filter(pos => !usedPositions.includes(pos));
    
    if (availablePositions.length === 0) {
      throw new BadRequestException('没有可用的位置');
    }
    
    // 分配第一个可用位置
    const positionId = availablePositions[0];
    
    // 设置方向和侧边
    let orientation: 'top' | 'bottom';
    let side: 'left' | 'right';
    
    switch (positionId) {
      case 1:
        orientation = 'bottom';
        side = 'left';
        break;
      case 2:
        orientation = 'bottom';
        side = 'right';
        break;
      case 3:
        orientation = 'top';
        side = 'left';
        break;
      case 4:
        orientation = 'top';
        side = 'right';
        break;
      default:
        orientation = 'bottom';
        side = 'left';
    }
    
    // 更新玩家信息
    room.players[playerIndex].positionId = positionId;
    room.players[playerIndex].orientation = orientation;
    room.players[playerIndex].side = side;
    
    return room.save();
  }

  /**
   * 重置玩家位置
   * @param room 房间
   */
  async resetPlayerPositions(room: RoomDocument): Promise<RoomDocument> {
    // 为现有玩家重新分配位置
    for (let i = 0; i < room.players.length; i++) {
      const positionId = i + 1;
      if (positionId > 4) break; // 最多支持4个玩家
      
      let orientation: 'top' | 'bottom';
      let side: 'left' | 'right';
      
      switch (positionId) {
        case 1:
          orientation = 'bottom';
          side = 'left';
          break;
        case 2:
          orientation = 'bottom';
          side = 'right';
          break;
        case 3:
          orientation = 'top';
          side = 'left';
          break;
        case 4:
          orientation = 'top';
          side = 'right';
          break;
        default:
          orientation = 'bottom';
          side = 'left';
      }
      
      room.players[i].positionId = positionId;
      room.players[i].orientation = orientation;
      room.players[i].side = side;
    }
    
    return room.save();
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userService.findById(userId);
  }

  /**
   * 获取游戏服务
   */
  getGameService(): GameService {
    return this.gameService;
  }

  /**
   * 通过条件查询房间
   */
  async findOne(filter: any): Promise<RoomDocument | null> {
    return this.roomModel.findOne(filter).exec();
  }
} 