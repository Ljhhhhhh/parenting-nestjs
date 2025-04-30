import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from 'nestjs-prisma'; // Import PrismaModule
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    PrismaModule, // Make PrismaService available
    PassportModule.register({ defaultStrategy: 'jwt' }), // Register Passport with default JWT strategy
    ConfigModule, // Ensure ConfigService is available
    JwtModule.registerAsync({
      imports: [ConfigModule], // Import ConfigModule here as well
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        // Note: We don't set a single secret here because access and refresh tokens use different secrets.
        // Secrets are provided directly in the strategies and when signing tokens in the service.
        // We could set defaults like signOptions here if needed, but it's often clearer
        // to manage expirations within the service's signAsync calls.
        // secret: configService.get<string>('JWT_ACCESS_SECRET'), // Example if using one secret
        // signOptions: { expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION_TIME') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy, // Provide JwtStrategy so PassportModule can use it
    JwtRefreshStrategy, // Provide JwtRefreshStrategy
  ],
  exports: [AuthService], // Export AuthService if other modules need to inject it (optional for now)
})
export class AuthModule {}
