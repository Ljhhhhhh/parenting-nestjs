import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator'; // Use relative path
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Uses the 'jwt' strategy by default
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Check method decorator
      context.getClass(), // Check class decorator
    ]);

    if (isPublic) {
      return true; // Allow access to public routes
    }

    // For non-public routes, proceed with standard JWT authentication
    return super.canActivate(context);
  }

  // Optional: Customize handleRequest for more control over errors or user object
  handleRequest(err, user, info) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      // Customize the error message based on the JWT error info if available
      let message = '未授权';
      if (info instanceof Error) {
        if (info.name === 'TokenExpiredError') {
          message = '访问令牌已过期';
        } else if (info.name === 'JsonWebTokenError') {
          message = '访问令牌无效';
        }
      }
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}
