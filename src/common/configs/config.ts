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
  siliconFlow: {
    // --- 硅基流动 API 密钥和端点从环境变量中获取 ---
    // 重要提示：请在环境变量中设置这些值
    // 在本地开发时使用 .env 文件（确保将其添加到 .gitignore 中）
    apiKey: process.env.SILICON_FLOW_API_KEY,
    apiEndpoint:
      process.env.SILICON_FLOW_API_ENDPOINT || 'https://api.siliconflow.com/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 60000, // 30秒
  },
};

export default (): Config => config;
