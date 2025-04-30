import { Module } from '@nestjs/common';
import { ChildrenService } from './children.service';
import { ChildrenController } from './children.controller';
import { PrismaModule } from 'nestjs-prisma'; // Import PrismaModule

@Module({
  imports: [PrismaModule], // Import PrismaModule so PrismaService is available
  controllers: [ChildrenController],
  providers: [ChildrenService],
})
export class ChildrenModule {}
