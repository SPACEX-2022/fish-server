import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum BulletCollisionBehavior {
  CANCEL = 'cancel',
  CONTINUE = 'continue',
  REFLECT = 'reflect',
  EXPLODE = 'explode',
}

export class BulletPosition {
  @ApiProperty({ description: 'X坐标' })
  @IsNumber()
  x: number;

  @ApiProperty({ description: 'Y坐标' })
  @IsNumber()
  y: number;
}

export class BulletType {
  @ApiProperty({ description: '子弹类型ID' })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({ description: '子弹名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '威力' })
  @IsNumber()
  @IsNotEmpty()
  power: number;

  @ApiProperty({ description: '半径' })
  @IsNumber()
  @IsNotEmpty()
  radius: number;

  @ApiProperty({ description: '速度' })
  @IsNumber()
  @IsNotEmpty()
  speed: number;

  @ApiProperty({ description: '碰撞行为', enum: BulletCollisionBehavior })
  @IsEnum(BulletCollisionBehavior)
  @IsNotEmpty()
  collisionBehavior: BulletCollisionBehavior;

  @ApiProperty({ description: '爆炸半径', required: false })
  @IsNumber()
  @IsOptional()
  explosionRadius?: number;
}

export class ShootBulletDto {
  @ApiProperty({ description: '操作类型' })
  @IsString()
  @IsNotEmpty()
  action: 'shoot';

  @ApiProperty({ description: '子弹ID' })
  @IsString()
  @IsNotEmpty()
  bulletId: string;

  @ApiProperty({ description: '射击角度' })
  @IsNumber()
  @IsNotEmpty()
  angle: number;

  @ApiProperty({ description: '威力' })
  @IsNumber()
  @IsNotEmpty()
  power: number;

  @ApiProperty({ description: '武器类型' })
  @IsNumber()
  @IsNotEmpty()
  weaponType: number;

  @ApiProperty({ description: '发射位置' })
  @IsObject()
  @ValidateNested()
  @Type(() => BulletPosition)
  position: BulletPosition;

  @ApiProperty({ description: '客户端时间戳' })
  @IsNumber()
  @IsNotEmpty()
  clientTime: number;
}

export class BulletCollisionDto {
  @ApiProperty({ description: '事件类型' })
  @IsString()
  @IsNotEmpty()
  event: 'bulletCollision';

  @ApiProperty({ description: '子弹碰撞列表' })
  @IsArray()
  bullets: {
    bulletId1: string;
    bulletId2: string;
    playerId1: string;
    playerId2: string;
    position: BulletPosition;
    effect: BulletCollisionBehavior;
  }[];
}

export class FishCollisionDto {
  @ApiProperty({ description: '事件类型' })
  @IsString()
  @IsNotEmpty()
  event: 'collision';

  @ApiProperty({ description: '碰撞结果列表' })
  @IsArray()
  collisions: {
    bulletId: string;
    playerId: string;
    fishId: string;
    position: BulletPosition;
    damage: number;
    killed: boolean;
    score: number;
  }[];
} 