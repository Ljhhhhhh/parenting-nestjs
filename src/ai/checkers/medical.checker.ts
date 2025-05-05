import { Injectable, Logger } from '@nestjs/common';

/**
 * 医疗建议检查器
 *
 * 负责检测AI回复中是否包含医疗建议
 */
@Injectable()
export class MedicalChecker {
  private readonly logger = new Logger(MedicalChecker.name);

  // 医疗关键词列表
  private readonly medicalKeywords: string[] = [
    '诊断',
    '治疗',
    '用药',
    '药物',
    '处方',
    '剂量',
    '副作用',
    '症状',
    '疾病',
    '感染',
    '炎症',
    '发烧',
    '发热',
    '体温',
    '抗生素',
    '消炎药',
    '退烧药',
    '止痛药',
    '处方药',
    '非处方药',
    '就医',
    '看医生',
    '去医院',
    '门诊',
    '急诊',
    '专科',
    '过敏反应',
    '不良反应',
    '禁忌症',
    '肺炎',
    '支气管炎',
    '中耳炎',
    '咽喉炎',
    '扁桃体炎',
    '皮疹',
    '湿疹',
    '荨麻疹',
    '腹泻',
    '便秘',
    '呕吐',
    '腹痛',
    '头痛',
    '耳痛',
    '喉咙痛',
    '咳嗽',
    '流涕',
    '鼻塞',
    '打喷嚏',
    '呼吸困难',
    '惊厥',
    '抽搐',
    '脱水',
    '脱水症状',
    '病毒',
    '细菌',
    '真菌',
    '寄生虫',
    '免疫力',
    '抵抗力',
    '疫苗',
    '接种',
    '预防针',
    '疫苗接种',
    '药效',
    '药理',
    '药代动力学',
    '药物相互作用',
    '药物过敏',
    '药物不良反应',
    '药物禁忌',
  ];

  // 强医疗指示词列表
  private readonly strongMedicalIndicators: string[] = [
    '必须服用',
    '应该服用',
    '需要服用',
    '建议服用',
    '可以服用',
    '试试服用',
    '考虑服用',
    '必须使用',
    '应该使用',
    '需要使用',
    '建议使用',
    '可以使用',
    '试试使用',
    '考虑使用',
    '必须治疗',
    '应该治疗',
    '需要治疗',
    '建议治疗',
    '可以治疗',
    '试试治疗',
    '考虑治疗',
    '必须就医',
    '应该就医',
    '需要就医',
    '建议就医',
    '可以就医',
    '考虑就医',
    '医生会',
    '医生可能会',
    '医生通常会',
    '医生建议',
    '医生推荐',
    '医生处方',
    '医生诊断',
    '医生治疗',
    '这种疾病',
    '这种症状',
    '这种情况通常是',
    '这可能是',
    '这表明',
    '这预示着',
    '这意味着',
    '这是典型的',
    '这是常见的',
    '这是正常的',
    '这是异常的',
    '这需要关注',
    '这需要处理',
    '这需要干预',
    '这需要医疗干预',
    '这需要专业处理',
    '这需要专业治疗',
    '这需要专业评估',
    '这需要专业诊断',
    '这需要专业建议',
    '这需要专业帮助',
    '这需要专业指导',
    '这需要专业咨询',
    '这需要专业意见',
  ];

  /**
   * 检查AI回复中是否包含医疗建议
   * @param response AI回复内容
   * @returns 检查结果，包括是否包含医疗建议和医疗关键词
   */
  check(response: string): {
    containsMedicalAdvice: boolean;
    medicalTerms: string[];
  } {
    const detectedTerms: string[] = [];

    // 检查强医疗指示词
    for (const indicator of this.strongMedicalIndicators) {
      if (response.includes(indicator)) {
        this.logger.debug(`检测到强医疗指示词: ${indicator}`);
        detectedTerms.push(indicator);
      }
    }

    // 如果已经检测到强医疗指示词，直接返回
    if (detectedTerms.length > 0) {
      return {
        containsMedicalAdvice: true,
        medicalTerms: detectedTerms,
      };
    }

    // 检查医疗关键词
    let medicalKeywordCount = 0;
    for (const keyword of this.medicalKeywords) {
      if (response.includes(keyword)) {
        this.logger.debug(`检测到医疗关键词: ${keyword}`);
        detectedTerms.push(keyword);
        medicalKeywordCount++;
      }
    }

    // 如果医疗关键词出现次数超过阈值，判定为包含医疗建议
    // 降低阈值到2，提高检测敏感度
    return {
      containsMedicalAdvice: medicalKeywordCount >= 2,
      medicalTerms: detectedTerms,
    };
  }

  /**
   * 为包含医疗建议的回复添加免责声明
   * @param response 原始AI回复
   * @returns 添加免责声明后的回复
   */
  addDisclaimer(response: string): string {
    const disclaimer =
      '\n\n【免责声明】以上内容仅供参考，不构成医疗建议。如有健康问题，请咨询专业医生或儿科医师。';
    return response + disclaimer;
  }
}
