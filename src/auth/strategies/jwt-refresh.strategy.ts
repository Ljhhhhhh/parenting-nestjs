import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express'; // Import Request type
import { AuthService, JwtPayload } from '../auth.service'; // Import AuthService and JwtPayload
import { User } from '@prisma/client';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh', // Unique name for this strategy
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService, // Inject AuthService if needed for validation
  ) {
    super({
      // Extract token from 'Authorization: Bearer <token>'
      // A more secure approach might extract from body or HttpOnly cookie
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // Pass the request object to the validate method
      ignoreExpiration: false,
    });
  }

  /**
   * Validate the payload and the refresh token itself.
   * @param req The Express request object
   * @param payload The decoded JWT payload
   * @returns The user object along with the refresh token
   */
  async validate(req: Request, payload: JwtPayload): Promise<any> {
    // Extract refresh token from header (as used by jwtFromRequest)
    const refreshToken = req
      ?.get('authorization')
      ?.replace('Bearer', '')
      .trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    // Here you might add logic to check if the refresh token is revoked
    // e.g., check against a database list of valid/revoked refresh tokens
    // For now, we just validate the user exists based on payload

    const user = await this.authService.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户未找到或令牌无效');
    }

    // Return user payload and the refresh token for the service/controller
    return { ...payload, refreshToken };
  }
}
