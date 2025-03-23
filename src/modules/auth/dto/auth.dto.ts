import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { UserDto } from '../../user/dto/user.dto';

export class WxLoginDto {
  @ApiProperty({ description: '微信登录code' })
  @IsString()
  @IsNotEmpty({ message: '微信登录code不能为空' })
  code: string;

  @ApiProperty({ description: '用户昵称', required: false })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({ description: '用户头像URL', required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

// 连接状态DTO
export class ConnectionStatusDto {
  @ApiProperty({ description: '是否已连接' })
  isConnected: boolean;

  @ApiProperty({ description: '最后一次连接时间', type: 'number' })
  lastSeen: number;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT令牌' })
  token: string;

  @ApiProperty({ description: '用户信息' })
  user: UserDto;

  @ApiProperty({ description: '连接状态', required: false })
  connectionStatus?: ConnectionStatusDto;
}

export class JwtPayload {
  @ApiProperty({ description: '用户ID' })
  sub: string;
  
  @ApiProperty({ description: '微信OpenID' })
  openId?: string;
  
  @ApiProperty({ description: '用户昵称' })
  nickname?: string;
  
  // 允许其他任意属性
  [key: string]: any;
} 