import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildResponseDto } from './dto/child-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
// We rely on the global JwtAuthGuard, so no need for @UseGuards(JwtAuthGuard) here unless overriding

@ApiTags('Children')
@ApiBearerAuth() // Indicate that endpoints generally require Bearer token (handled globally)
@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '添加新的儿童信息' })
  @ApiResponse({
    status: 201,
    description: '儿童信息添加成功',
    type: ChildResponseDto,
  })
  @ApiResponse({ status: 400, description: '输入数据验证失败' })
  @ApiResponse({ status: 401, description: '未授权' }) // From global guard
  async create(
    @Body() createChildDto: CreateChildDto,
    @Req() req,
  ): Promise<ChildResponseDto> {
    // The user object is attached to the request by JwtAuthGuard after successful validation
    const userId = req.user.userId; // Assuming JwtStrategy returns { userId: number, email: string, ... }
    if (!userId) {
      // This should technically not happen if the guard is working correctly
      throw new UnauthorizedException('无法获取用户信息');
    }
    // Service returns Prisma model, which is structurally compatible for now
    return this.childrenService.create(createChildDto, userId);
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户的所有儿童列表' })
  @ApiResponse({
    status: 200,
    description: '成功获取儿童列表',
    type: [ChildResponseDto],
  })
  @ApiResponse({ status: 401, description: '未授权' })
  async findAll(@Req() req): Promise<ChildResponseDto[]> {
    const userId = req.user.userId;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.childrenService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取指定 ID 的儿童信息' })
  @ApiParam({ name: 'id', description: '儿童的唯一标识符', type: Number })
  @ApiResponse({
    status: 200,
    description: '成功获取儿童信息',
    type: ChildResponseDto /* Child DTO */,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权访问该儿童信息' })
  @ApiResponse({ status: 404, description: '未找到指定 ID 的儿童信息' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ): Promise<ChildResponseDto> {
    const userId = req.user.userId;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.childrenService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新指定 ID 的儿童信息' })
  @ApiParam({ name: 'id', description: '儿童的唯一标识符', type: Number })
  @ApiResponse({
    status: 200,
    description: '儿童信息更新成功',
    type: ChildResponseDto /* Child DTO */,
  })
  @ApiResponse({ status: 400, description: '输入数据验证失败' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权修改该儿童信息' })
  @ApiResponse({ status: 404, description: '未找到指定 ID 的儿童信息' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateChildDto: UpdateChildDto,
    @Req() req,
  ): Promise<ChildResponseDto> {
    const userId = req.user.userId;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.childrenService.update(id, userId, updateChildDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK) // Or HttpStatus.NO_CONTENT if not returning the object
  @ApiOperation({ summary: '删除指定 ID 的儿童信息' })
  @ApiParam({ name: 'id', description: '儿童的唯一标识符', type: Number })
  @ApiResponse({
    status: 200,
    description: '儿童信息删除成功',
    type: ChildResponseDto /* Child DTO */,
  })
  // @ApiResponse({ status: 204, description: '儿童信息删除成功' }) // Alternative for NO_CONTENT
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权删除该儿童信息' })
  @ApiResponse({ status: 404, description: '未找到指定 ID 的儿童信息' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ): Promise<ChildResponseDto> {
    const userId = req.user.userId;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    // Service method returns the deleted child object
    return this.childrenService.remove(id, userId);
  }
}
