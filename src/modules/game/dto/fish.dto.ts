import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum FishBehaviorType {
  NORMAL = 'normal',
  SCHOOLING = 'schooling',
  ESCAPE = 'escape',
  AGGRESSIVE = 'aggressive',
  ZIGZAG = 'zigzag',
}

export class PathPoint {
  @ApiProperty({ description: 'X坐标' })
  @IsNumber()
  x: number;

  @ApiProperty({ description: 'Y坐标' })
  @IsNumber()
  y: number;

  @ApiProperty({ description: '时间点(ms)' })
  @IsNumber()
  time: number;
}

export class BehaviorParams {
  @ApiProperty({ description: '速度乘数', required: false })
  @IsNumber()
  @IsOptional()
  speedMultiplier?: number;

  @ApiProperty({ description: '领头鱼ID', required: false })
  @IsString()
  @IsOptional()
  leaderId?: string;

  @ApiProperty({ description: '偏移量', required: false })
  @IsObject()
  @IsOptional()
  offset?: { x: number; y: number };

  @ApiProperty({ description: '跟随延迟(ms)', required: false })
  @IsNumber()
  @IsOptional()
  followDelay?: number;

  @ApiProperty({ description: '逃跑方向(角度)', required: false })
  @IsNumber()
  @IsOptional()
  direction?: number;

  @ApiProperty({ description: '行为持续时间(ms)', required: false })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({ description: '转向速率', required: false })
  @IsNumber()
  @IsOptional()
  turnRate?: number;

  @ApiProperty({ description: '目标玩家ID', required: false })
  @IsString()
  @IsOptional()
  targetPlayerId?: string;

  @ApiProperty({ description: '振幅', required: false })
  @IsNumber()
  @IsOptional()
  amplitude?: number;

  @ApiProperty({ description: '频率', required: false })
  @IsNumber()
  @IsOptional()
  frequency?: number;
}

export class FishBehavior {
  @ApiProperty({ description: '行为类型', enum: FishBehaviorType })
  @IsEnum(FishBehaviorType)
  @IsNotEmpty()
  type: FishBehaviorType;

  @ApiProperty({ description: '行为参数', type: BehaviorParams })
  @IsObject()
  @ValidateNested()
  @Type(() => BehaviorParams)
  params: BehaviorParams;
}

export class FishData {
  @ApiProperty({ description: '鱼ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: '鱼类型' })
  @IsNumber()
  @IsNotEmpty()
  type: number;

  @ApiProperty({ description: '路径点', type: [PathPoint] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PathPoint)
  path: PathPoint[];

  @ApiProperty({ description: '生命值' })
  @IsNumber()
  @IsNotEmpty()
  hp: number;

  @ApiProperty({ description: '速度' })
  @IsNumber()
  @IsNotEmpty()
  speed: number;

  @ApiProperty({ description: '行为' })
  @IsObject()
  @ValidateNested()
  @Type(() => FishBehavior)
  behavior: FishBehavior;
}

export class FishSpawnDto {
  @ApiProperty({ description: '操作类型' })
  @IsString()
  @IsNotEmpty()
  action: 'spawn';

  @ApiProperty({ description: '鱼群数据', type: [FishData] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FishData)
  fishes: FishData[];
}

export class FishUpdateBehaviorDto {
  @ApiProperty({ description: '操作类型' })
  @IsString()
  @IsNotEmpty()
  action: 'updateBehavior';

  @ApiProperty({ description: '鱼群行为更新', type: [Object] })
  @IsArray()
  fishes: {
    id: string;
    behavior: FishBehavior;
    newPath?: PathPoint[];
  }[];
} 