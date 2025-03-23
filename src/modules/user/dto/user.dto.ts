import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: '微信OpenID' })
  @IsString()
  @IsNotEmpty({ message: 'OpenID不能为空' })
  openId: string;

  @ApiProperty({ description: '用户昵称' })
  @IsString()
  @IsNotEmpty({ message: '昵称不能为空' })
  nickname: string;

  @ApiProperty({ description: '用户头像URL', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class UpdateUserDto {
  @ApiProperty({ description: '用户昵称', required: false })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({ description: '用户头像URL', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class UserDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '微信OpenID' })
  openId: string;

  @ApiProperty({ description: '用户昵称' })
  nickname: string;

  @ApiProperty({ description: '用户头像URL' })
  avatarUrl: string;

  @ApiProperty({ description: '总分数' })
  totalScore: number;

  @ApiProperty({ description: '已玩游戏数' })
  gamesPlayed: number;

  @ApiProperty({ description: '胜利次数' })
  wins: number;
}

export class UserProfileDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户昵称' })
  nickname: string;

  @ApiProperty({ description: '用户头像URL' })
  avatarUrl: string;

  @ApiProperty({ description: '总分数' })
  totalScore: number;

  @ApiProperty({ description: '已玩游戏数' })
  gamesPlayed: number;

  @ApiProperty({ description: '胜利次数' })
  wins: number;

  @ApiProperty({ description: '胜率' })
  winRate: number;
} 