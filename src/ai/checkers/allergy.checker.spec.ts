import { Test, TestingModule } from '@nestjs/testing';
import { AllergyChecker } from './allergy.checker';
import { Logger } from '@nestjs/common';

describe('AllergyChecker', () => {
  let allergyChecker: AllergyChecker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllergyChecker,
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    allergyChecker = module.get<AllergyChecker>(AllergyChecker);
  });

  it('应该被定义', () => {
    expect(allergyChecker).toBeDefined();
  });

  describe('check', () => {
    it('当没有过敏信息时，应该返回没有潜在过敏', () => {
      const response = '可以给孩子尝试一些牛奶和鸡蛋。';
      const allergyInfo: string[] = [];

      const result = allergyChecker.check(response, allergyInfo);

      expect(result.hasPotentialAllergy).toBe(false);
      expect(result.allergens).toEqual([]);
    });

    it('当过敏信息为null时，应该返回没有潜在过敏', () => {
      const response = '可以给孩子尝试一些牛奶和鸡蛋。';
      const allergyInfo = null;

      const result = allergyChecker.check(response, allergyInfo);

      expect(result.hasPotentialAllergy).toBe(false);
      expect(result.allergens).toEqual([]);
    });

    it('当AI回复中包含过敏物时，应该检测出来', () => {
      const response = '可以给孩子尝试一些牛奶和鸡蛋。';
      const allergyInfo = ['牛奶', '花生'];

      const result = allergyChecker.check(response, allergyInfo);

      expect(result.hasPotentialAllergy).toBe(true);
      expect(result.allergens).toContain('牛奶');
      expect(result.allergens).not.toContain('花生');
    });

    it('当AI回复中包含过敏物的相关关键词时，应该检测出来', () => {
      const response = '可以给孩子尝试一些奶酪和酸奶。';
      const allergyInfo = ['牛奶', '花生'];

      const result = allergyChecker.check(response, allergyInfo);

      expect(result.hasPotentialAllergy).toBe(true);
      expect(result.allergens.some((a) => a.includes('牛奶'))).toBe(true);
      expect(result.allergens).not.toContain('花生');
    });

    it('当AI回复中不包含过敏物时，应该返回没有潜在过敏', () => {
      const response = '可以给孩子尝试一些米粉和蔬菜泥。';
      const allergyInfo = ['牛奶', '鸡蛋', '花生'];

      const result = allergyChecker.check(response, allergyInfo);

      expect(result.hasPotentialAllergy).toBe(false);
      expect(result.allergens).toEqual([]);
    });

    it('应该能够检测多个过敏物', () => {
      const response = '可以给孩子尝试一些奶酪、鸡蛋羹和花生酱。';
      const allergyInfo = ['牛奶', '鸡蛋', '花生'];

      const result = allergyChecker.check(response, allergyInfo);

      expect(result.hasPotentialAllergy).toBe(true);
      expect(result.allergens.length).toBeGreaterThanOrEqual(2);
      expect(result.allergens.some((a) => a.includes('牛奶'))).toBe(true);
      expect(result.allergens.some((a) => a.includes('鸡蛋'))).toBe(true);
      expect(result.allergens.some((a) => a.includes('花生'))).toBe(true);
    });

    it('应该避免误报（部分匹配）', () => {
      const response = '可以给孩子尝试一些牛肉和鸡肉。';
      const allergyInfo = ['牛奶', '鸡蛋'];

      const result = allergyChecker.check(response, allergyInfo);

      // 注意：当前实现可能会误报，因为正则表达式没有考虑词边界
      // 如果测试失败，需要改进 containsAllergen 方法
      expect(result.hasPotentialAllergy).toBe(false);
      expect(result.allergens).toEqual([]);
    });
  });
});
