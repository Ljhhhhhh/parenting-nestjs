import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { Child } from '@prisma/client';

@Injectable()
export class ChildrenService {
  constructor(private prisma: PrismaService) {}

  async create(createChildDto: CreateChildDto, userId: number): Promise<Child> {
    // dateOfBirth is received as a string, convert it to Date object for Prisma
    const dateOfBirth = new Date(createChildDto.dateOfBirth);

    return this.prisma.child.create({
      data: {
        ...createChildDto,
        dateOfBirth, // Use the converted Date object
        userId, // Associate with the logged-in user
      },
    });
  }

  async findAll(userId: number): Promise<Child[]> {
    return this.prisma.child.findMany({
      where: {
        userId: userId, // Filter by the logged-in user's ID
      },
      // Optional: Add ordering, e.g., by dateOfBirth or nickname
      // orderBy: {
      //   dateOfBirth: 'asc',
      // },
    });
  }

  async findOne(id: number, userId: number): Promise<Child> {
    // checkOwnership handles finding the child and verifying ownership
    // It throws NotFoundException or ForbiddenException if checks fail
    return this.checkOwnership(id, userId);
  }

  async update(
    id: number,
    userId: number,
    updateChildDto: UpdateChildDto,
  ): Promise<Child> {
    // First, ensure the child exists and belongs to the user
    await this.checkOwnership(id, userId);

    // Prepare data for update, converting dateOfBirth if present
    const dataToUpdate: any = { ...updateChildDto };
    if (updateChildDto.dateOfBirth) {
      dataToUpdate.dateOfBirth = new Date(updateChildDto.dateOfBirth);
    }

    return this.prisma.child.update({
      where: { id: id }, // Specify the child to update by ID
      data: dataToUpdate,
    });
  }

  async remove(id: number, userId: number): Promise<Child> {
    // First, ensure the child exists and belongs to the user
    await this.checkOwnership(id, userId);

    // If ownership is confirmed, proceed with deletion
    return this.prisma.child.delete({
      where: { id: id },
    });
  }

  // Helper function to check ownership
  private async checkOwnership(
    childId: number,
    userId: number,
  ): Promise<Child> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });
    if (!child) {
      throw new NotFoundException(`未找到 ID 为 ${childId} 的儿童信息`);
    }
    if (child.userId !== userId) {
      throw new ForbiddenException('您无权访问此儿童信息');
    }
    return child;
  }
}
