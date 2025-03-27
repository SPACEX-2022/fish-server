import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UserDto, UserProfileDto } from './dto/user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      this.logger.log(`创建新用户: ${JSON.stringify(createUserDto)}`);
      const newUser = new this.userModel(createUserDto);
      const savedUser = await newUser.save();
      this.logger.log(`用户创建成功: ${savedUser._id}`);
      return savedUser;
    } catch (error) {
      this.logger.error(`创建用户失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByOpenId(openId: string): Promise<User | null> {
    return this.userModel.findOne({ openId }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
  }

  async updateLoginTime(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { lastLoginAt: new Date() })
      .exec();
  }

  async updateGameStats(
    id: string, 
    score: number, 
    isWinner: boolean
  ): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(
      id,
      {
        $inc: {
          totalScore: score,
          gamesPlayed: 1,
          wins: isWinner ? 1 : 0,
        },
      },
      { new: true }
    ).exec();
  }
  
  /**
   * 将用户文档转换为UserDto
   */
  toUserDto(user: User | UserDocument): UserDto {
    const userId = user instanceof Document 
      ? user._id.toString() 
      : (user as any)._id.toString();
      
    return {
      id: userId,
      openId: user.openId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      totalScore: user.totalScore,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
    };
  }
  
  /**
   * 将用户文档转换为ProfileDto
   */
  toProfileDto(user: User | UserDocument): UserProfileDto {
    const winRate = user.gamesPlayed > 0 
      ? Math.round((user.wins / user.gamesPlayed) * 100)
      : 0;
    
    const userId = user instanceof Document 
      ? user._id.toString() 
      : (user as any)._id.toString();
      
    return {
      id: userId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      totalScore: user.totalScore,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      winRate
    };
  }
} 