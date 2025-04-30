import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException, // Add UnauthorizedException here
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenDto } from './dto/token.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator'; // Use relative path
import { User } from '@prisma/client';
import { Request } from 'express'; // Import Request type

// Define interface for request with user property added by AuthGuard
interface RequestWithUser extends Request {
  user: Omit<User, 'hashedPassword'>;
}

// Define interface for request with user and refreshToken properties added by JwtRefreshGuard
interface RequestWithUserAndToken extends Request {
  user: { sub: number; email: string; refreshToken: string };
}

@ApiTags('Auth') // Group endpoints under 'Auth' tag in Swagger
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public() // Make registration public
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({
    status: 201,
    description: '用户注册成功，返回用户信息（不含密码）',
  })
  @ApiResponse({ status: 409, description: '邮箱已被注册' })
  @ApiResponse({ status: 400, description: '输入数据验证失败' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<Omit<User, 'hashedPassword'>> {
    return this.authService.register(registerDto);
  }

  @Public() // Make login public
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({
    status: 200,
    description: '登录成功，返回 Access Token 和 Refresh Token',
    type: TokenDto,
  })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  @ApiResponse({ status: 400, description: '输入数据验证失败' })
  async login(@Body() loginDto: LoginDto): Promise<TokenDto> {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    return this.authService.login(user);
  }

  // Use the 'jwt-refresh' strategy guard for this endpoint
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Access Token' })
  @ApiBearerAuth() // Indicate that this endpoint requires a Bearer token (the refresh token)
  @ApiResponse({ status: 200, description: 'Token 刷新成功', type: TokenDto })
  @ApiResponse({ status: 401, description: 'Refresh Token 无效或已过期' })
  async refreshToken(@Req() req: RequestWithUserAndToken): Promise<TokenDto> {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken;
    // The JwtRefreshStrategy already validated the token structure and user existence
    // The service might add further checks (e.g., against a revocation list)
    return this.authService.refreshToken(userId, refreshToken);
  }

  // Use the default 'jwt' strategy guard for this endpoint
  @UseGuards(AuthGuard('jwt')) // Protect with JWT access token guard
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiBearerAuth() // Indicate that this endpoint requires a Bearer token (the access token)
  @ApiResponse({
    status: 200,
    description: '成功获取用户信息',
    type: Object /* Define a UserDto later */,
  })
  @ApiResponse({ status: 401, description: '未授权或 Token 无效' })
  getProfile(@Req() req: RequestWithUser): Omit<User, 'hashedPassword'> {
    // req.user is populated by the JwtStrategy's validate method
    return req.user;
  }
}
