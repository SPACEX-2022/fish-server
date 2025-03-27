import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { GameService } from './game.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';
import { GameRecordDto, PlayerGameRecordsDto } from './dto/game.dto';
import { ApiTags, ApiBearerAuth, ApiParam, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';
import { success } from '../common/utils/response.util';
import { HeartbeatService } from '../common/services/heartbeat.service';

// 扩展Request类型以包含user属性
interface RequestWithUser extends Request {
  user: {
    sub: string;
    [key: string]: any;
  };
}

@ApiTags('游戏')
@ApiBearerAuth()
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService, private readonly heartbeatService: HeartbeatService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户的在线状态' })
  @ApiResponse({ status: 200, description: '返回用户的在线状态信息' })
  async getStatus(@Req() req: RequestWithUser) {
    const userId = req.user.sub;
    const status = await this.heartbeatService.getUserOnlineInfo(userId);
    
    return success({
      ...status,
      timestamp: Date.now(),
    }, '获取在线状态成功');
  }

  @Get('online-count')
  @ApiOperation({ summary: '获取当前在线用户数' })
  @ApiResponse({ status: 200, description: '返回当前在线用户数' })
  async getOnlineCount() {
    const count = await this.heartbeatService.getOnlineUserCount();
    
    return success({
      onlineCount: count,
      timestamp: Date.now(),
    }, '获取在线用户数成功');
  }

  @UseGuards(JwtAuthGuard)
  @Get('records')
  @ApiStandardResponse(PlayerGameRecordsDto, '获取我的游戏记录')
  async getMyGameRecords(@Req() req) {
    return this.gameService.getUserGameRecords(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('records/:userId')
  @ApiStandardResponse(PlayerGameRecordsDto, '获取指定用户的游戏记录')
  @ApiParam({ name: 'userId', description: '用户ID' })
  async getUserGameRecords(@Param('userId') userId: string): Promise<PlayerGameRecordsDto> {
    return this.gameService.getUserGameRecords(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('record/:recordId')
  @ApiStandardResponse(GameRecordDto, '获取游戏记录详情')
  @ApiParam({ name: 'recordId', description: '游戏记录ID' })
  async getGameRecord(@Param('recordId') recordId: string): Promise<GameRecordDto> {
    return this.gameService.getGameRecord(recordId);
  }
} 