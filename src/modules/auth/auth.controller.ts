import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WxLoginDto, LoginResponseDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wx-login')
  @ApiStandardResponse(LoginResponseDto, '微信小游戏登录')
  @ApiResponse({ status: 400, description: '无效的登录凭证' })
  async wxLogin(@Body() wxLoginDto: WxLoginDto) {
    console.log('wxLoginDto', wxLoginDto);
    return this.authService.wxLogin(wxLoginDto);
  }
} 