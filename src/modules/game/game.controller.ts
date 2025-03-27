import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { GameService } from './game.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';
import { GameRecordDto, PlayerGameRecordsDto } from './dto/game.dto';
import { ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';

@ApiTags('游戏')
@ApiBearerAuth()
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

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