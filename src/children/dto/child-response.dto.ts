import { ApiProperty } from '@nestjs/swagger';

export class ChildResponseDto {
  @ApiProperty({ description: '儿童的唯一标识符', example: 1 })
  id: number;

  @ApiProperty({ description: '儿童所属用户的 ID', example: 101 })
  userId: number;

  @ApiProperty({ description: '儿童昵称', example: '宝宝' })
  nickname: string;

  @ApiProperty({ description: '出生日期 (YYYY-MM-DD)', example: '2023-01-15' })
  dateOfBirth: Date; // Or string if you prefer to format it

  @ApiProperty({ description: '性别', example: '男', required: false })
  gender?: string;

  @ApiProperty({
    description: '过敏信息列表 (字符串数组)',
    example: ['花生', '海鲜'],
    required: false, // It's not required to have allergies
    type: [String],
  })
  allergyInfo: string[];

  @ApiProperty({
    description: '其他信息',
    example: '喜欢恐龙玩具',
    required: false,
  })
  moreInfo?: string;

  @ApiProperty({ description: '记录创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '记录更新时间' })
  updatedAt: Date;
}
