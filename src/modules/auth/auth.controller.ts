import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WxLoginDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wx-login')
  async wxLogin(@Body() wxLoginDto: WxLoginDto) {
    console.log('wxLoginDto', wxLoginDto);
    return this.authService.wxLogin(wxLoginDto);
  }
} 