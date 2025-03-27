import { RoomStatus, RoomType } from '../schemas/room.schema';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ description: '房间类型', enum: RoomType })
  @IsEnum(RoomType)
  @IsNotEmpty({ message: '房间类型不能为空' })
  type: RoomType;
}

export class JoinRoomDto {
  @ApiProperty({ description: '房间代码' })
  @IsString()
  @IsNotEmpty({ message: '房间代码不能为空' })
  roomCode: string;
}

export class RoomResponseDto {
  @ApiProperty({ description: '房间ID' })
  id: string;

  @ApiProperty({ description: '房间代码' })
  roomCode: string;

  @ApiProperty({ description: '房间类型', enum: RoomType })
  type: RoomType;

  @ApiProperty({ description: '房间状态', enum: RoomStatus })
  status: RoomStatus;

  @ApiProperty({ description: '玩家列表', type: 'array' })
  players: {
    userId: string;
    nickname: string;
    avatarUrl: string;
    score: number;
    isReady: boolean;
    isHost: boolean;
  }[];

  @ApiProperty({ description: '房主ID' })
  hostId: string;

  @ApiProperty({ description: '开始时间', type: Date, nullable: true })
  startTime: Date | null;

  @ApiProperty({ description: '结束时间', type: Date, nullable: true })
  endTime: Date | null;

  @ApiProperty({ description: '当前回合数' })
  currentRound: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

export class RoomListItemDto {
  @ApiProperty({ description: '房间ID' })
  id: string;

  @ApiProperty({ description: '房间代码' })
  roomCode: string;

  @ApiProperty({ description: '房间类型', enum: RoomType })
  type: RoomType;

  @ApiProperty({ description: '房间状态', enum: RoomStatus })
  status: RoomStatus;

  @ApiProperty({ description: '玩家数量' })
  playerCount: number;

  @ApiProperty({ description: '房主名称' })
  hostName: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

export class MatchRoomResponseDto {
  @ApiProperty({ description: '操作是否成功' })
  success: boolean;

  @ApiProperty({ description: '提示消息' })
  message: string;

  @ApiProperty({ description: '匹配状态', enum: ['matching', 'matched', 'canceled'] })
  status: string;
} 