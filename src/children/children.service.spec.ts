import { Test, TestingModule } from '@nestjs/testing';
import { ChildrenService } from './children.service';
import { PrismaService } from 'nestjs-prisma'; // 从库导入
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// Mock PrismaService
const mockPrismaService = {
  child: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(), // 替换为 findUnique
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ChildrenService', () => {
  let service: ChildrenService;
  let prisma: typeof mockPrismaService; // Use typeof for type safety

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildrenService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChildrenService>(ChildrenService);
    prisma = module.get(PrismaService); // Get the mocked provider

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test cases for create --- //
  describe('create', () => {
    it('should create a new child', async () => {
      const createDto: CreateChildDto = {
        nickname: 'Test Baby',
        dateOfBirth: '2024-01-01',
        allergyInfo: ['Peanuts'],
      };
      const userId = 1;
      const expectedChild = {
        id: 1,
        ...createDto,
        dateOfBirth: new Date(createDto.dateOfBirth),
        userId,
        gender: null,
        moreInfo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        allergyInfo: ['Peanuts'], // Ensure array type matches
      };

      prisma.child.create.mockResolvedValue(expectedChild);

      const result = await service.create(createDto, userId);

      expect(prisma.child.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          dateOfBirth: new Date(createDto.dateOfBirth), // Verify conversion
          userId,
        },
      });
      expect(result).toEqual(expectedChild);
    });
  });

  // --- Test cases for findAll --- //
  describe('findAll', () => {
    it('should return an array of children for the user', async () => {
      const userId = 1;
      const expectedChildren = [
        {
          id: 1,
          nickname: 'Child 1',
          userId,
          dateOfBirth: new Date(),
          allergyInfo: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          gender: null,
          moreInfo: null,
        },
        {
          id: 2,
          nickname: 'Child 2',
          userId,
          dateOfBirth: new Date(),
          allergyInfo: ['Dust'],
          createdAt: new Date(),
          updatedAt: new Date(),
          gender: null,
          moreInfo: null,
        },
      ];

      prisma.child.findMany.mockResolvedValue(expectedChildren);

      const result = await service.findAll(userId);

      expect(prisma.child.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual(expectedChildren);
    });
  });

  // --- Test cases for findOne (testing via checkOwnership implicitly) --- //
  describe('findOne', () => {
    const childId = 1;
    const userId = 1;
    const mockChild = {
      id: childId,
      userId,
      nickname: 'Found Child',
      dateOfBirth: new Date(),
      allergyInfo: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      gender: null,
      moreInfo: null,
    };

    it('should return the child if found and owned by user', async () => {
      // Mock checkOwnership's underlying prisma call (findUnique)
      prisma.child.findUnique.mockResolvedValue(mockChild);

      const result = await service.findOne(childId, userId);

      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        // 确认调用 findUnique
        where: { id: childId },
      });
      expect(result).toEqual(mockChild);
    });

    it('should throw NotFoundException if child not found', async () => {
      // Simulate findUnique returning null
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.findOne(childId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        // 确认调用 findUnique
        where: { id: childId },
      });
    });

    it('should throw ForbiddenException if child not owned by user', async () => {
      const differentUserId = 2;
      const childOwnedByAnother = { ...mockChild, userId: differentUserId };
      prisma.child.findUnique.mockResolvedValue(childOwnedByAnother); // findUnique returns the child

      await expect(service.findOne(childId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        // 确认调用 findUnique
        where: { id: childId },
      });
    });
  });

  // --- Test cases for update --- //
  describe('update', () => {
    const childId = 1;
    const userId = 1;
    const updateDto: UpdateChildDto = {
      nickname: 'Updated Name',
      allergyInfo: ['Pollen'],
    };
    const existingChild = {
      id: childId,
      userId,
      nickname: 'Old Name',
      dateOfBirth: new Date(),
      allergyInfo: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      gender: null,
      moreInfo: null,
    };
    const updatedChild = {
      ...existingChild,
      ...updateDto,
      updatedAt: new Date(),
    };

    it('should update the child if found and owned', async () => {
      prisma.child.findUnique.mockResolvedValue(existingChild); // For checkOwnership (findUnique)
      prisma.child.update.mockResolvedValue(updatedChild);

      const result = await service.update(childId, userId, updateDto);

      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        // checkOwnership call (findUnique)
        where: { id: childId },
      }); // checkOwnership call
      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: childId },
        data: updateDto, // dateOfBirth conversion would happen if present
      });
      expect(result).toEqual(updatedChild);
    });

    it('should handle dateOfBirth conversion during update', async () => {
      const updateDtoWithDate: UpdateChildDto = { dateOfBirth: '2023-05-05' };
      const updatedChildWithDate = {
        ...existingChild,
        dateOfBirth: new Date(updateDtoWithDate.dateOfBirth),
        updatedAt: new Date(),
      };

      prisma.child.findUnique.mockResolvedValue(existingChild); // checkOwnership passes
      prisma.child.update.mockResolvedValue(updatedChildWithDate);

      await service.update(childId, userId, updateDtoWithDate);

      expect(prisma.child.update).toHaveBeenCalledWith({
        where: { id: childId },
        data: { dateOfBirth: new Date(updateDtoWithDate.dateOfBirth) }, // Check conversion
      });
    });

    it('should re-throw NotFoundException from checkOwnership', async () => {
      // Simulate findUnique returning null in checkOwnership
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.update(childId, userId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: childId },
      });
    });

    it('should re-throw ForbiddenException from checkOwnership', async () => {
      const differentUserId = 2;
      const childOwnedByAnother = { ...existingChild, userId: differentUserId };
      prisma.child.findUnique.mockResolvedValue(childOwnedByAnother); // findUnique returns child

      await expect(service.update(childId, userId, updateDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: childId },
      });
    });
  });

  // --- Test cases for remove --- //
  describe('remove', () => {
    const childId = 1;
    const userId = 1;
    const existingChild = {
      id: childId,
      userId,
      nickname: 'To Delete',
      dateOfBirth: new Date(),
      allergyInfo: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      gender: null,
      moreInfo: null,
    };

    it('should delete the child if found and owned', async () => {
      prisma.child.findUnique.mockResolvedValue(existingChild); // For checkOwnership (findUnique)
      prisma.child.delete.mockResolvedValue(existingChild); // Mock deletion success

      const result = await service.remove(childId, userId);

      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        // checkOwnership call (findUnique)
        where: { id: childId },
      }); // checkOwnership call
      expect(prisma.child.delete).toHaveBeenCalledWith({
        where: { id: childId },
      });
      expect(result).toEqual(existingChild);
    });

    it('should re-throw NotFoundException from checkOwnership', async () => {
      // Simulate findUnique returning null in checkOwnership
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.remove(childId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: childId },
      });
    });

    it('should re-throw ForbiddenException from checkOwnership', async () => {
      const differentUserId = 2;
      const childOwnedByAnother = { ...existingChild, userId: differentUserId };
      prisma.child.findUnique.mockResolvedValue(childOwnedByAnother); // findUnique returns child

      await expect(service.remove(childId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: childId },
      });
    });
  });
});
