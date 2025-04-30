import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route handler or controller as public,
 * bypassing the global JWT authentication guard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
