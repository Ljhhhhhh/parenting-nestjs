import { Test, TestingModule } from '@nestjs/testing'; // 导入 NestJS 测试相关的模块
import { INestApplication } from '@nestjs/common'; // 导入 NestJS 应用实例的接口类型
import { Logger } from 'nestjs-pino'; // 导入 nestjs-pino 日志记录器
import { AppModule } from '../src/app.module'; // 导入应用程序的主模块

// 定义一个测试套件，描述 Logger 的端到端测试
describe('Logger (e2e)', () => {
  let app: INestApplication; // 声明一个变量来持有 NestJS 应用实例
  let logger: Logger; // 声明一个变量来持有 Logger 实例

  // 在所有测试运行之前执行的钩子函数
  beforeAll(async () => {
    // 创建一个测试模块，类似于主应用程序模块的配置
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // 导入主 AppModule，这样测试环境就拥有了 AppModule 中定义的所有提供者和服务，包括 Logger
    }).compile(); // 编译测试模块

    // 基于测试模块创建一个 NestJS 应用实例
    app = moduleFixture.createNestApplication();
    // 手动应用 Logger 实例，就像在 main.ts 中所做的那样
    // 这是因为在测试环境中，NestJS 不会自动应用通过 app.useLogger() 配置的日志记录器
    // 需要从应用实例中获取 Logger 的提供者实例，并将其设置为应用程序的日志记录器
    app.useLogger(app.get(Logger));
    // 初始化应用程序（例如，建立数据库连接、启动监听器等）
    await app.init();

    // 从应用程序实例中获取 Logger 的实例，以便在测试中使用
    logger = app.get(Logger);
  });

  // 在所有测试运行之后执行的钩子函数
  afterAll(async () => {
    // 关闭 NestJS 应用程序，释放资源
    await app.close();
  });

  // 定义一个具体的测试用例
  it('should get logger instance and log a message', () => {
    // 断言 logger 实例已经被成功获取并且已定义
    expect(logger).toBeDefined();
    // 尝试使用 logger 实例记录一条日志消息
    // 如果 logger 没有被正确配置，或者实例是 undefined，这里可能会抛出错误
    // 如果没有错误抛出，这个测试就隐式地通过了
    logger.log('Test log message from e2e test');
    // 这里可以添加更具体的断言，例如检查日志文件是否被创建或写入
    // 但这通常需要更复杂的设置（例如模拟文件系统等）
  });
});
