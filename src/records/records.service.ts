import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateRecordDto, UpdateRecordDto, RecordResponseDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建日常记录
   * @param createRecordDto 创建记录的数据传输对象
   * @param userId 当前用户ID
   * @returns 创建的记录
   */
  async create(
    createRecordDto: CreateRecordDto,
    userId: number,
  ): Promise<RecordResponseDto> {
    // 检查儿童是否属于当前用户
    await this.checkOwnership(createRecordDto.childId, userId);

    // 处理 details 字段，确保类型安全
    let processedDetails = null;
    try {
      // 先将对象转换为纯 JSON，然后再解析回来，移除类型信息
      processedDetails = JSON.parse(JSON.stringify(createRecordDto.details));
    } catch (error) {
      // 如果转换失败，直接使用原始对象
      processedDetails = createRecordDto.details;
    }

    // 创建记录
    const record = await this.prisma.record.create({
      data: {
        childId: createRecordDto.childId,
        recordType: createRecordDto.recordType,
        details: processedDetails,
        recordTimestamp: new Date(createRecordDto.recordTimestamp),
      },
    });

    return this.mapToResponseDto(record);
  }

  /**
   * 查询特定儿童的所有记录
   * @param childId 儿童ID
   * @param userId 当前用户ID
   * @returns 记录列表
   */
  async findAllByChild(
    childId: number,
    userId: number,
  ): Promise<RecordResponseDto[]> {
    // 检查儿童是否属于当前用户
    await this.checkOwnership(childId, userId);

    // 查询记录
    const records = await this.prisma.record.findMany({
      where: { childId },
      orderBy: { recordTimestamp: 'desc' },
    });

    return records.map(this.mapToResponseDto);
  }

  /**
   * 查询特定记录
   * @param id 记录ID
   * @param userId 当前用户ID
   * @returns 记录详情
   */
  async findOne(id: number, userId: number): Promise<RecordResponseDto> {
    const record = await this.prisma.record.findUnique({
      where: { id: BigInt(id) },
      include: { child: true },
    });

    if (!record) {
      throw new NotFoundException('记录不存在');
    }

    // 检查记录关联的儿童是否属于当前用户
    if (record.child.userId !== userId) {
      throw new ForbiddenException('无权访问此记录');
    }

    return this.mapToResponseDto(record);
  }

  /**
   * 更新记录
   * @param id 记录ID
   * @param updateRecordDto 更新记录的数据传输对象
   * @param userId 当前用户ID
   * @returns 更新后的记录
   */
  async update(
    id: number,
    updateRecordDto: UpdateRecordDto,
    userId: number,
  ): Promise<RecordResponseDto> {
    // 先获取记录，检查所有权
    const existingRecord = await this.findOne(id, userId);

    // 如果要更新childId，需要检查新的儿童是否属于当前用户
    if (
      updateRecordDto.childId &&
      updateRecordDto.childId !== existingRecord.childId
    ) {
      await this.checkOwnership(updateRecordDto.childId, userId);
    }

    // 处理 details 字段，确保类型安全
    let processedDetails = null;
    if (updateRecordDto.details) {
      try {
        // 先将对象转换为纯 JSON，然后再解析回来，移除类型信息
        processedDetails = JSON.parse(JSON.stringify(updateRecordDto.details));
      } catch (error) {
        // 如果转换失败，直接使用原始对象
        processedDetails = updateRecordDto.details;
      }
    }

    // 更新记录
    const updatedRecord = await this.prisma.record.update({
      where: { id: BigInt(id) },
      data: {
        ...(updateRecordDto.childId && { childId: updateRecordDto.childId }),
        ...(updateRecordDto.recordType && {
          recordType: updateRecordDto.recordType,
        }),
        ...(processedDetails && { details: processedDetails }),
        ...(updateRecordDto.recordTimestamp && {
          recordTimestamp: new Date(updateRecordDto.recordTimestamp),
        }),
      },
    });

    return this.mapToResponseDto(updatedRecord);
  }

  /**
   * 删除记录
   * @param id 记录ID
   * @param userId 当前用户ID
   * @returns 删除的记录
   */
  async remove(id: number, userId: number): Promise<RecordResponseDto> {
    // 先获取记录，检查所有权
    await this.findOne(id, userId);

    // 删除记录
    const deletedRecord = await this.prisma.record.delete({
      where: { id: BigInt(id) },
    });

    return this.mapToResponseDto(deletedRecord);
  }

  /**
   * 检查儿童是否属于当前用户
   * @param childId 儿童ID
   * @param userId 用户ID
   * @throws ForbiddenException 如果儿童不属于当前用户
   */
  private async checkOwnership(childId: number, userId: number): Promise<void> {
    try {
      const child = await this.prisma.child.findUniqueOrThrow({
        where: { id: childId },
      });

      if (child.userId !== userId) {
        throw new ForbiddenException('无权操作此儿童的记录');
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('儿童不存在');
        }
      }
      throw error;
    }
  }

  /**
   * 将数据库记录映射为响应DTO
   * @param record 数据库记录
   * @returns 响应DTO
   */
  private mapToResponseDto(record: any): RecordResponseDto {
    return {
      id: Number(record.id), // 将 BigInt 转换为 Number
      childId: record.childId,
      recordType: record.recordType,
      details: record.details,
      recordTimestamp: record.recordTimestamp,
      createdAt: record.createdAt,
    };
  }
}
