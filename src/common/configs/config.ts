import type { Config } from './config.interface';

const config: Config = {
  nest: {
    port: 3000,
  },
  cors: {
    enabled: true,
  },
  swagger: {
    enabled: true,
    title: 'Nestjs FTW',
    description: 'The nestjs API description',
    version: '2.0',
    path: 'api',
  },
  graphql: {
    playgroundEnabled: true,
    debug: true,
    schemaDestination: './src/schema.graphql',
    sortSchema: true,
  },
  security: {
    expiresIn: '7d',
    refreshIn: '30d',
    bcryptSaltOrRound: 10,
    // --- JWT Secrets from environment variables ---
    // IMPORTANT: Set these environment variables with strong, random secrets!
    // Use .env file for local development (ensure it's in .gitignore)
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  },
};

export default (): Config => config;
