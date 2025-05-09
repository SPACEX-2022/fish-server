import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { RoomService } from './room.service';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoomDto, JoinRoomDto, RoomResponseDto, MatchRoomResponseDto } from './dto/room.dto';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiParam, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';
import { RoomType, RoomStatus } from './schemas/room.schema';
import { PlayerPositionsDto } from './dto/player-position.dto';
import { MatchQueueService } from './services/match-queue.service';

@ApiTags('房间')
@ApiBearerAuth()
@Controller('rooms')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly matchQueueService: MatchQueueService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('public')
  @ApiStandardResponse(RoomResponseDto, '获取公共房间列表')
  async getPublicRooms() {
    return this.roomService.findPublicRooms();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiStandardResponse(RoomResponseDto, '根据ID获取房间详情')
  @ApiParam({ name: 'id', description: '房间ID' })
  async getRoomById(@Param('id') id: string) {
    const room = await this.roomService.findById(id);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Get('code/:code')
  @ApiStandardResponse(RoomResponseDto, '根据房间代码获取房间详情')
  @ApiParam({ name: 'code', description: '房间代码' })
  async getRoomByCode(@Param('code') code: string) {
    const room = await this.roomService.findByCode(code);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiStandardResponse(RoomResponseDto, '创建房间')
  async createRoom(@Request() req, @Body() createRoomDto: CreateRoomDto) {
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    const room = await this.roomService.create(req.user.sub, user, createRoomDto);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  @ApiStandardResponse(RoomResponseDto, '加入房间')
  async joinRoom(@Request() req, @Body() joinRoomDto: JoinRoomDto) {
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    
    const room = await this.roomService.joinRoom(req.user.sub, user, joinRoomDto);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  @ApiStandardResponse(RoomResponseDto, '离开房间')
  @ApiParam({ name: 'id', description: '房间ID' })
  async leaveRoom(@Param('id') id: string, @Request() req) {
    const room = await this.roomService.leaveRoom(id, req.user.sub);
    if (!room) {
      return { success: true, message: '房间已解散' };
    }
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/ready')
  @ApiStandardResponse(RoomResponseDto, '设置准备状态')
  @ApiParam({ name: 'id', description: '房间ID' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        isReady: {
          type: 'boolean',
          description: '是否准备好',
          example: true
        }
      }
    }
  })
  async setReady(
    @Param('id') id: string,
    @Request() req,
    @Body('isReady') isReady: boolean,
  ) {
    const room = await this.roomService.setReady(id, req.user.sub, isReady);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  @ApiStandardResponse(RoomResponseDto, '开始游戏')
  @ApiParam({ name: 'id', description: '房间ID' })
  async startGame(@Param('id') id: string, @Request() req) {
    const room = await this.roomService.startGame(id, req.user.sub);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/ready-next')
  @ApiStandardResponse(RoomResponseDto, '准备下一轮游戏')
  @ApiParam({ name: 'id', description: '房间ID' })
  async readyForNextGame(@Param('id') id: string, @Request() req) {
    const room = await this.roomService.readyForNextGame(id, req.user.sub);
    return this.roomService.toRoomResponseDto(room);
  }

  @UseGuards(JwtAuthGuard)
  @Post('match')
  @ApiStandardResponse(MatchRoomResponseDto, '在线匹配')
  async matchRoom(@Request() req) {
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查用户是否已在其他房间中
    const existingRoom = await this.roomService.findOne({
      'players.userId': req.user.sub,
      status: { $ne: RoomStatus.FINISHED },
    });
    
    if (existingRoom) {
      throw new BadRequestException('用户已在其他房间中');
    }

    // 将用户添加到匹配队列
    await this.matchQueueService.addPlayerToQueue(user);

    // 返回匹配请求已接收的响应
    return {
      success: true,
      message: '匹配请求已接收，等待匹配中...',
      status: 'matching'
    };
  }

  @Get('player-positions')
  @ApiOperation({ summary: '获取玩家位置布局' })
  @ApiResponse({ 
    status: 200, 
    description: '返回玩家位置布局',
    type: PlayerPositionsDto 
  })
  getPlayerPositions(
    @Inject('PLAYER_POSITIONS') playerPositions: PlayerPositionsDto
  ): PlayerPositionsDto {
    return playerPositions;
  }
} 