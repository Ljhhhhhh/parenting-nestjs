import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { TokenDto } from './dto/token.dto';

// Define the structure of the JWT payload
export interface JwtPayload {
  sub: number; // User ID
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // --- User Registration ---
  async register(
    registerDto: RegisterDto,
  ): Promise<Omit<User, 'hashedPassword'>> {
    const { email, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('该邮箱已被注册');
    }

    // Hash password
    const saltRounds = this.configService.get<number>(
      'security.bcryptSaltOrRound',
      10,
    );
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
      // Create user
      const user = await this.prisma.user.create({
        data: {
          email,
          hashedPassword,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashedPassword: _, ...result } = user; // Exclude password from result
      return result;
    } catch (error) {
      // Handle potential Prisma errors (e.g., unique constraint violation raced)
      if (error.code === 'P2002') {
        // Prisma unique constraint violation code
        throw new ConflictException('该邮箱已被注册');
      }
      throw new InternalServerErrorException('用户注册失败');
    }
  }

  // --- User Login --- (validateUser + login)
  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'hashedPassword'> | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(pass, user.hashedPassword))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashedPassword, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: Omit<User, 'hashedPassword'>): Promise<TokenDto> {
    const payload: JwtPayload = { email: user.email, sub: user.id };
    return this.generateTokens(payload);
  }

  // --- Token Generation ---
  private async generateTokens(payload: JwtPayload): Promise<TokenDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRATION_TIME',
          '7d',
        ), // Default 15 minutes
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION_TIME',
          '30d',
        ), // Default 7 days
      }),
    ]);

    // TODO: Consider storing refresh token hash in DB for better security/revocation

    return { accessToken, refreshToken };
  }

  // --- Token Refresh --- (Needs corresponding strategy and controller endpoint)
  async refreshToken(userId: number, rt: string): Promise<TokenDto> {
    // TODO: Implement refresh token validation (check if stored/valid)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // Validate the incoming refresh token itself (this requires the refresh strategy to have run first)
    // For now, assume the guard validated it. Generate new tokens.
    const payload: JwtPayload = { email: user.email, sub: user.id };
    return this.generateTokens(payload);
  }

  // --- Find User by ID (for JWT Strategy) ---
  async findUserById(
    userId: number,
  ): Promise<Omit<User, 'hashedPassword'> | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword, ...result } = user;
    return result;
  }
}
