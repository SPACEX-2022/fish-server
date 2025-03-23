import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum GameEventType {
  FISH_CAUGHT = 'fish_caught',
  ITEM_USED = 'item_used',
  SPECIAL_EVENT = 'special_event',
}

export interface GameEvent {
  type: GameEventType;
  targetId: string;
  score?: number;
  x?: number;
  y?: number;
  itemId?: string;
}

export class GameEventDto implements GameEvent {
  @ApiProperty({ description: '事件类型', enum: GameEventType })
  @IsEnum(GameEventType)
  @IsNotEmpty()
  type: GameEventType;

  @ApiProperty({ description: '目标ID' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ description: '得分', required: false })
  @IsNumber()
  @IsOptional()
  score?: number;

  @ApiProperty({ description: 'X坐标', required: false })
  @IsNumber()
  @IsOptional()
  x?: number;

  @ApiProperty({ description: 'Y坐标', required: false })
  @IsNumber()
  @IsOptional()
  y?: number;

  @ApiProperty({ description: '道具ID', required: false })
  @IsString()
  @IsOptional()
  itemId?: string;
}

export interface GameEventWithUser extends GameEvent {
  userId: string;
  nickname: string;
}

export class GameEventWithUserDto extends GameEventDto implements GameEventWithUser {
  @ApiProperty({ description: '发送事件的用户ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;
  
  @ApiProperty({ description: '用户昵称' })
  @IsString()
  @IsNotEmpty()
  nickname: string;
}

export interface PlayerResult {
  userId: string;
  nickname: string;
  score: number;
  rank: number;
  events: GameEventWithUser[];
}

export class PlayerResultDto implements PlayerResult {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: '用户昵称' })
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @ApiProperty({ description: '得分' })
  @IsNumber()
  score: number;

  @ApiProperty({ description: '排名' })
  @IsNumber()
  rank: number;

  @ApiProperty({ description: '游戏事件', type: [GameEventWithUserDto] })
  @IsArray()
  events: GameEventWithUserDto[];
}

export class GameRecordDto {
  @ApiProperty({ description: '记录ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '房间ID' })
  @IsString()
  roomId: string;

  @ApiProperty({ description: '房间代码' })
  @IsString()
  roomCode: string;

  @ApiProperty({ description: '开始时间', nullable: true })
  startTime: Date | null;

  @ApiProperty({ description: '结束时间', nullable: true })
  endTime: Date | null;

  @ApiProperty({ description: '持续时间(毫秒)' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: '玩家结果', type: [PlayerResultDto] })
  @IsArray()
  players: PlayerResultDto[];

  @ApiProperty({ description: '胜利者', type: PlayerResultDto })
  winner: PlayerResultDto;
}

export class PlayerScoreDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '用户昵称' })
  @IsString()
  nickname: string;

  @ApiProperty({ description: '得分' })
  @IsNumber()
  score: number;
}

export class GameTimerDto {
  @ApiProperty({ description: '剩余时间(毫秒)' })
  @IsNumber()
  remaining: number;

  @ApiProperty({ description: '总时间(毫秒)' })
  @IsNumber()
  total: number;
}

export class CountdownDto {
  @ApiProperty({ description: '倒计时' })
  @IsNumber()
  count: number;
}

export class PlayerGameRecordsDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '用户昵称' })
  @IsString()
  nickname: string;

  @ApiProperty({ description: '总游戏次数' })
  @IsNumber()
  totalGames: number;

  @ApiProperty({ description: '胜利次数' })
  @IsNumber()
  wins: number;

  @ApiProperty({ description: '平均得分' })
  @IsNumber()
  avgScore: number;

  @ApiProperty({ description: '总得分' })
  @IsNumber()
  totalScore: number;

  @ApiProperty({ description: '最高得分' })
  @IsNumber()
  bestScore: number;

  @ApiProperty({ description: '最近游戏记录', type: [GameRecordDto] })
  @IsArray()
  recentGames: GameRecordDto[];
}

export class ScoreUpdateDto {
  @ApiProperty({ description: '得分' })
  @IsNumber()
  @IsNotEmpty()
  score: number;
}

export class GameResultDto {
  @ApiProperty({ description: '房间ID' })
  @IsString()
  roomId: string;

  @ApiProperty({ description: '游戏ID' })
  @IsString()
  gameId: string;

  @ApiProperty({ description: '持续时间(毫秒)' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: '玩家结果' })
  playerResults: {
    userId: string;
    nickname: string;
    score: number;
    rank: number;
  }[];

  @ApiProperty({ description: '胜利者ID' })
  @IsString()
  winnerId: string;
} 