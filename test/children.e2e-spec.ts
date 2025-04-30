import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard'; // Use src/ prefix

// Mock user data for the guard
const mockUser = { userId: 1, email: 'test@example.com' };

// Mock PrismaService methods
const mockPrismaService = {
  child: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // Add mocks for other models if needed by other tests
};

describe('ChildrenController (e2e)', () => {
  let app: INestApplication;
  let prisma: typeof mockPrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService) // Override PrismaService
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard) // Override the actual JwtAuthGuard globally for testing
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser; // Attach the mock user to the request
          return true; // Always allow access for testing purposes
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Apply the global ValidationPipe like in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Strip properties not in DTO
        transform: true, // Automatically transform payloads to DTO instances
        forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const createChildDto = {
    nickname: 'Test E2E Baby',
    dateOfBirth: '2024-02-01',
    allergyInfo: ['Milk'],
    gender: '女',
  };
  const expectedChild = {
    id: 1,
    ...createChildDto,
    dateOfBirth: new Date(createChildDto.dateOfBirth), // Use Date object internally
    userId: mockUser.userId,
    moreInfo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    allergyInfo: ['Milk'], // Ensure array format
  };
  // Simulate what the controller might return (dates as ISO strings)
  const expectedChildResponse = JSON.parse(JSON.stringify(expectedChild));

  // Test POST /children
  describe('POST /children', () => {
    it('should create a child and return 201', async () => {
      prisma.child.create.mockResolvedValue(expectedChild);

      return request(app.getHttpServer())
        .post('/children')
        .send(createChildDto)
        .expect(201)
        .expect((res) => {
          // Basic structure check - refine based on actual DTO
          expect(res.body.id).toBeDefined();
          expect(res.body.nickname).toEqual(createChildDto.nickname);
          expect(res.body.allergyInfo).toEqual(createChildDto.allergyInfo);
          expect(res.body.userId).toEqual(mockUser.userId);
          // Dates need careful comparison due to potential timezone/serialization differences
          expect(
            new Date(res.body.dateOfBirth).toISOString().split('T')[0],
          ).toEqual(createChildDto.dateOfBirth);
        });
    });

    it('should return 400 for invalid data (missing nickname)', async () => {
      const { nickname, ...invalidDto } = createChildDto;
      return request(app.getHttpServer())
        .post('/children')
        .send(invalidDto)
        .expect(400); // Bad Request due to validation pipe
    });

    it('should return 400 for invalid data (allergyInfo not array)', async () => {
      const invalidDto = { ...createChildDto, allergyInfo: 'Peanuts' }; // allergyInfo should be string[]
      return request(app.getHttpServer())
        .post('/children')
        .send(invalidDto)
        .expect(400); // Bad Request due to validation pipe
    });
  });

  // Test GET /children
  describe('GET /children', () => {
    it('should return an array of children for the user and return 200', async () => {
      const children = [
        expectedChild,
        { ...expectedChild, id: 2, nickname: 'Child 2' },
      ];
      prisma.child.findMany.mockResolvedValue(children);
      // Simulate response serialization
      const expectedResponseBody = JSON.parse(JSON.stringify(children));

      return request(app.getHttpServer())
        .get('/children')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body.length).toBe(2);
          expect(res.body[0].id).toEqual(expectedResponseBody[0].id);
          expect(res.body[1].nickname).toEqual(
            expectedResponseBody[1].nickname,
          );
          expect(res.body[0].userId).toEqual(mockUser.userId);
        });
    });
  });

  // Test GET /children/:id
  describe('GET /children/:id', () => {
    const childId = 1;

    it('should return a specific child if owned and return 200', async () => {
      prisma.child.findUniqueOrThrow.mockResolvedValue(expectedChild); // findOne calls checkOwnership -> findUniqueOrThrow
      const expectedResponseBody = JSON.parse(JSON.stringify(expectedChild));

      return request(app.getHttpServer())
        .get(`/children/${childId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toEqual(childId);
          expect(res.body.nickname).toEqual(expectedResponseBody.nickname);
          expect(res.body.userId).toEqual(mockUser.userId);
        });
    });

    it('should return 404 if child not found', async () => {
      const prismaError = new Error('Record not found'); // Simulate error
      (prismaError as any).code = 'P2025'; // Prisma error code for not found
      prisma.child.findUniqueOrThrow.mockRejectedValue(prismaError);

      return request(app.getHttpServer())
        .get(`/children/${childId}`)
        .expect(404); // Not Found
    });

    it('should return 403 if child not owned by user', async () => {
      const otherUserChild = { ...expectedChild, userId: mockUser.userId + 1 };
      prisma.child.findUniqueOrThrow.mockResolvedValue(otherUserChild);

      return request(app.getHttpServer())
        .get(`/children/${childId}`)
        .expect(403); // Forbidden
    });

    it('should return 400 for invalid ID format', async () => {
      return request(app.getHttpServer())
        .get(`/children/abc`) // Invalid ID
        .expect(400); // Bad Request due to ParseIntPipe
    });
  });

  // Test PATCH /children/:id
  describe('PATCH /children/:id', () => {
    const childId = 1;
    const updateDto = {
      nickname: 'Updated E2E Name',
      allergyInfo: ['Pollen', 'Dust'],
    };
    const existingChildOwned = { ...expectedChild, id: childId }; // Assume owned
    const updatedDbChild = {
      ...existingChildOwned,
      ...updateDto,
      updatedAt: new Date(),
    };
    const expectedResponseBody = JSON.parse(JSON.stringify(updatedDbChild));

    it('should update the child if owned and return 200', async () => {
      prisma.child.findUniqueOrThrow.mockResolvedValue(existingChildOwned); // For checkOwnership
      prisma.child.update.mockResolvedValue(updatedDbChild);

      return request(app.getHttpServer())
        .patch(`/children/${childId}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toEqual(childId);
          expect(res.body.nickname).toEqual(updateDto.nickname);
          expect(res.body.allergyInfo).toEqual(updateDto.allergyInfo);
          expect(res.body.userId).toEqual(mockUser.userId);
        });
    });

    it('should return 400 for invalid update data (nickname type)', async () => {
      const invalidUpdateDto = { nickname: 123 }; // Invalid type
      return request(app.getHttpServer())
        .patch(`/children/${childId}`)
        .send(invalidUpdateDto)
        .expect(400);
    });

    it('should return 400 for invalid update data (allergyInfo element type)', async () => {
      const invalidUpdateDto = { allergyInfo: ['Good', 123] }; // Invalid element type in array
      return request(app.getHttpServer())
        .patch(`/children/${childId}`)
        .send(invalidUpdateDto)
        .expect(400);
    });

    it('should return 404 if child to update not found', async () => {
      const prismaError = new Error('Record not found');
      (prismaError as any).code = 'P2025';
      prisma.child.findUniqueOrThrow.mockRejectedValue(prismaError); // checkOwnership fails

      return request(app.getHttpServer())
        .patch(`/children/${childId}`)
        .send(updateDto)
        .expect(404);
    });

    it('should return 403 if trying to update unowned child', async () => {
      const otherUserChild = {
        ...existingChildOwned,
        userId: mockUser.userId + 1,
      };
      prisma.child.findUniqueOrThrow.mockResolvedValue(otherUserChild); // checkOwnership fails

      return request(app.getHttpServer())
        .patch(`/children/${childId}`)
        .send(updateDto)
        .expect(403);
    });
  });

  // Test DELETE /children/:id
  describe('DELETE /children/:id', () => {
    const childId = 1;
    const existingChildOwned = { ...expectedChild, id: childId };
    const expectedResponseBody = JSON.parse(JSON.stringify(existingChildOwned));

    it('should delete the child if owned and return 200', async () => {
      prisma.child.findUniqueOrThrow.mockResolvedValue(existingChildOwned); // For checkOwnership
      prisma.child.delete.mockResolvedValue(existingChildOwned); // Mock deletion success

      return request(app.getHttpServer())
        .delete(`/children/${childId}`)
        .expect(200)
        .expect((res) => {
          // Check if the returned deleted object is correct
          expect(res.body.id).toEqual(childId);
          expect(res.body.userId).toEqual(mockUser.userId);
        });
    });

    it('should return 404 if child to delete not found', async () => {
      const prismaError = new Error('Record not found');
      (prismaError as any).code = 'P2025';
      prisma.child.findUniqueOrThrow.mockRejectedValue(prismaError); // checkOwnership fails

      return request(app.getHttpServer())
        .delete(`/children/${childId}`)
        .expect(404);
    });

    it('should return 403 if trying to delete unowned child', async () => {
      const otherUserChild = {
        ...existingChildOwned,
        userId: mockUser.userId + 1,
      };
      prisma.child.findUniqueOrThrow.mockResolvedValue(otherUserChild); // checkOwnership fails

      return request(app.getHttpServer())
        .delete(`/children/${childId}`)
        .expect(403);
    });
  });
});
