import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlayerPosition {
  @ApiProperty({ description: '位置ID' })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({ description: '方向', enum: ['top', 'bottom'] })
  @IsString()
  @IsNotEmpty()
  orientation: 'top' | 'bottom';

  @ApiProperty({ description: '侧边', enum: ['left', 'right'] })
  @IsString()
  @IsNotEmpty()
  side: 'left' | 'right';

  @ApiProperty({ description: 'X坐标比例' })
  @IsNumber()
  @IsNotEmpty()
  defaultX: number;

  @ApiProperty({ description: 'Y坐标比例' })
  @IsNumber()
  @IsNotEmpty()
  defaultY: number;
}

export class PlayerPositionsDto {
  @ApiProperty({ description: '位置数据', type: [PlayerPosition] })
  positions: PlayerPosition[];

  constructor() {
    this.positions = [
      {
        id: 1,
        orientation: 'bottom',
        side: 'left',
        defaultX: 0.25,
        defaultY: 0.95
      },
      {
        id: 2,
        orientation: 'bottom',
        side: 'right',
        defaultX: 0.75,
        defaultY: 0.95
      },
      {
        id: 3,
        orientation: 'top',
        side: 'left',
        defaultX: 0.25,
        defaultY: 0.05
      },
      {
        id: 4,
        orientation: 'top',
        side: 'right',
        defaultX: 0.75,
        defaultY: 0.05
      }
    ];
  }
} 