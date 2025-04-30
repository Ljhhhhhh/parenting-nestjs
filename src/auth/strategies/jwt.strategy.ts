import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service'; // Import AuthService and JwtPayload
import { User } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // Default strategy name is 'jwt'
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extract token from 'Authorization: Bearer <token>'
      ignoreExpiration: false, // Ensure expired tokens are rejected
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'), // Use the access token secret
    });
  }

  /**
   * Validate the payload extracted from the JWT.
   * This method is called by Passport after verifying the JWT signature and expiration.
   * @param payload The decoded JWT payload
   * @returns The user object (without password) if validation is successful
   */
  async validate(payload: JwtPayload): Promise<Omit<User, 'hashedPassword'>> {
    const user = await this.authService.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户未找到或令牌无效');
    }
    // The user object returned here will be attached to the request object as request.user
    return user;
  }
}
