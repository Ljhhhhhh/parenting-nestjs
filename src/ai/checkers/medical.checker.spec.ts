import { Test, TestingModule } from '@nestjs/testing';
import { MedicalChecker } from './medical.checker';
import { Logger } from '@nestjs/common';

describe('MedicalChecker', () => {
  let medicalChecker: MedicalChecker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalChecker,
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

    medicalChecker = module.get<MedicalChecker>(MedicalChecker);
  });

  it('应该被定义', () => {
    expect(medicalChecker).toBeDefined();
  });

  describe('check', () => {
    it('当回复中包含强医疗指示词时，应该检测出来', () => {
      const response = '孩子发热时，建议服用退烧药，并密切观察体温变化。';

      const result = medicalChecker.check(response);

      expect(result.containsMedicalAdvice).toBe(true);
      expect(result.medicalTerms.length).toBeGreaterThan(0);
      expect(result.medicalTerms).toContain('建议服用');
    });

    it('当回复中包含多个医疗关键词时，应该检测出来', () => {
      const response = '孩子发热、咳嗽，可能是感染了病毒，注意观察症状变化。';

      const result = medicalChecker.check(response);

      expect(result.containsMedicalAdvice).toBe(true);
      expect(result.medicalTerms.length).toBeGreaterThanOrEqual(3);
      expect(result.medicalTerms).toContain('发热');
      expect(result.medicalTerms).toContain('感染');
      expect(result.medicalTerms).toContain('症状');
    });

    it('当回复中只包含少量医疗关键词时，不应该判定为医疗建议', () => {
      const response = '孩子有点发热，可以多喝水，注意休息。';

      const result = medicalChecker.check(response);

      expect(result.containsMedicalAdvice).toBe(false);
      expect(result.medicalTerms).toContain('发热');
      expect(result.medicalTerms.length).toBeLessThan(3);
    });

    it('当回复中不包含医疗关键词时，应该返回不包含医疗建议', () => {
      const response = '孩子可以多吃蔬菜水果，保持营养均衡。';

      const result = medicalChecker.check(response);

      expect(result.containsMedicalAdvice).toBe(false);
      expect(result.medicalTerms).toEqual([]);
    });

    it('应该能够检测边缘情况的医疗建议', () => {
      const response = '这种情况通常是消化不良，多给孩子喝水，观察大便情况。';

      const result = medicalChecker.check(response);

      expect(result.containsMedicalAdvice).toBe(true);
      expect(result.medicalTerms).toContain('这种情况通常是');
    });
  });

  describe('addDisclaimer', () => {
    it('应该为回复添加医疗免责声明', () => {
      const response = '孩子发热时，注意多喝水，保持休息。';
      const expectedDisclaimer =
        '【免责声明】以上内容仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生或儿科医师。';

      const result = medicalChecker.addDisclaimer(response);

      expect(result).toContain(response);
      expect(result).toContain(expectedDisclaimer);
    });
  });
});
