import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { Room, RoomSchema } from './schemas/room.schema';
import { UserModule } from '../user/user.module';
import { PlayerPositionsDto } from './dto/player-position.dto';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }]),
    forwardRef(() => UserModule),
  ],
  controllers: [RoomController],
  providers: [
    RoomService,
    {
      provide: 'PLAYER_POSITIONS',
      useClass: PlayerPositionsDto
    }
  ],
  exports: [RoomService],
})
export class RoomModule {} 