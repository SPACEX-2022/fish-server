import { Controller, Get, Put, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto, UserProfileDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ApiStandardResponse } from '../common/decorators/api-standard-response.decorator';

@ApiTags('用户')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiStandardResponse(UserProfileDto, '获取用户个人资料')
  async getProfile(@Req() req) {
    const user = await this.userService.findById(req.user.sub);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return this.userService.toProfileDto(user);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ApiStandardResponse(UserProfileDto, '更新用户个人资料')
  @ApiBody({ type: UpdateUserDto })
  async updateProfile(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const updatedUser = await this.userService.update(
      req.user.sub,
      updateUserDto,
    );
    if (!updatedUser) {
      throw new NotFoundException('用户不存在');
    }
    return this.userService.toProfileDto(updatedUser);
  }
} 