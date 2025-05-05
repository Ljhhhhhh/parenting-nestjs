import { Injectable, Logger } from '@nestjs/common';

/**
 * 过敏信息检查器
 *
 * 负责检测AI回复中是否包含可能引起过敏的建议
 */
@Injectable()
export class AllergyChecker {
  private readonly logger = new Logger(AllergyChecker.name);

  // 过敏物关键词映射表，用于扩展检查范围
  private readonly allergyKeywordMap: Record<string, string[]> = {
    牛奶: [
      '奶制品',
      '奶粉',
      '酸奶',
      '奶酪',
      '乳制品',
      '乳糖',
      '酪蛋白',
      '黄油',
      '奶油',
      '奶油蛋糕',
      '奶油饼干',
      '奶油冰淇淋',
      '奶油奶酪',
      '酸奶酸奶饮料',
      '酸奶冰淇淋',
      '奶油巧克力',
    ],
    鸡蛋: [
      '蛋白',
      '蛋黄',
      '蛋清',
      '鸭蛋',
      '鹦鸡蛋',
      '蛋糕',
      '蛋挂面',
      '蛋黄派',
      '蛋卷',
      '蛋汁',
      '蛋奶',
      '蛋糕粉',
      '蛋黄酱',
      '蛋黄油',
    ],
    花生: [
      '花生酱',
      '花生油',
      '坚果',
      '花生粉',
      '花生酱三明治',
      '花生酱面包',
      '花生酱饼干',
      '花生酱巧克力',
      '花生酱冰淇淋',
      '花生糖',
      '花生糖水',
    ],
    坚果: [
      '核桃',
      '杏仁',
      '腰果',
      '榴子',
      '松子',
      '开心果',
      '核桃仁',
      '杏仁粉',
      '腰果仁',
      '榴子仁',
      '松子仁',
      '开心果仁',
      '坚果粉',
      '坚果酱',
      '坚果面包',
      '坚果饼干',
      '坚果巧克力',
      '坚果冰淇淋',
      '坚果糖',
    ],
    小麦: [
      '面粉',
      '面包',
      '面条',
      '麦麦',
      '麦芽',
      '麦质',
      '麦片',
      '麦片粉',
      '麦片饼干',
      '麦片面包',
      '麦片蛋糕',
      '麦片饼干',
      '麦片巧克力',
      '麦片冰淇淋',
      '麦片糖',
      '麦片糖水',
      '麦芽粉',
      '麦芽面包',
      '麦芽饼干',
      '麦芽蛋糕',
      '麦芽饼干',
      '麦芽巧克力',
      '麦芽冰淇淋',
      '麦芽糖',
      '麦芽糖水',
      '麦麦粉',
      '麦麦面包',
      '麦麦饼干',
      '麦麦蛋糕',
      '麦麦饼干',
      '麦麦巧克力',
      '麦麦冰淇淋',
      '麦麦糖',
      '麦麦糖水',
      '面粉粉',
      '面粉面包',
      '面粉饼干',
      '面粉蛋糕',
      '面粉饼干',
      '面粉巧克力',
      '面粉冰淇淋',
      '面粉糖',
      '面粉糖水',
    ],
    大豆: [
      '豆浆',
      '豆腐',
      '豆干',
      '豆皮',
      '豆油',
      '酱油',
      '豆浆粉',
      '豆浆面包',
      '豆浆饼干',
      '豆浆蛋糕',
      '豆浆饼干',
      '豆浆巧克力',
      '豆浆冰淇淋',
      '豆浆糖',
      '豆浆糖水',
      '豆腐粉',
      '豆腐面包',
      '豆腐饼干',
      '豆腐蛋糕',
      '豆腐饼干',
      '豆腐巧克力',
      '豆腐冰淇淋',
      '豆腐糖',
      '豆腐糖水',
    ],
    海鲜: [
      '鱼',
      '虾',
      '蟹',
      '贝类',
      '鱿鱼',
      '章鱼',
      '海产品',
      '鱼粉',
      '鱼面包',
      '鱼饼干',
      '鱼蛋糕',
      '鱼饼干',
      '鱼巧克力',
      '鱼冰淇淋',
      '鱼糖',
      '鱼糖水',
      '虾粉',
      '虾面包',
      '虾饼干',
      '虾蛋糕',
      '虾饼干',
      '虾巧克力',
      '虾冰淇淋',
      '虾糖',
      '虾糖水',
      '蟹粉',
      '蟹面包',
      '蟹饼干',
      '蟹蛋糕',
      '蟹饼干',
      '蟹巧克力',
      '蟹冰淇淋',
      '蟹糖',
      '蟹糖水',
    ],
    水果: [
      '草莓',
      '猿猜桃',
      '芒果',
      '菠萝',
      '柿橙',
      '草莓粉',
      '草莓面包',
      '草莓饼干',
      '草莓蛋糕',
      '草莓饼干',
      '草莓巧克力',
      '草莓冰淇淋',
      '草莓糖',
      '草莓糖水',
      '猿猜桃粉',
      '猿猜桃面包',
      '猿猜桃饼干',
      '猿猜桃蛋糕',
      '猿猜桃饼干',
      '猿猜桃巧克力',
      '猿猜桃冰淇淋',
      '猿猜桃糖',
      '猿猜桃糖水',
    ],
    贝类: [
      '贝壳',
      '贝壳粉',
      '贝壳面包',
      '贝壳饼干',
      '贝壳蛋糕',
      '贝壳饼干',
      '贝壳巧克力',
      '贝壳冰淇淋',
      '贝壳糖',
      '贝壳糖水',
    ],
    草莓: [
      '草莓粉',
      '草莓面包',
      '草莓饼干',
      '草莓蛋糕',
      '草莓饼干',
      '草莓巧克力',
      '草莓冰淇淋',
      '草莓糖',
      '草莓糖水',
    ],
    芒果: [
      '芒果粉',
      '芒果面包',
      '芒果饼干',
      '芒果蛋糕',
      '芒果饼干',
      '芒果巧克力',
      '芒果冰淇淋',
      '芒果糖',
      '芒果糖水',
    ],
    柿子: [
      '柿子粉',
      '柿子面包',
      '柿子饼干',
      '柿子蛋糕',
      '柿子饼干',
      '柿子巧克力',
      '柿子冰淇淋',
      '柿子糖',
      '柿子糖水',
    ],
  };

  /**
   * 检查AI回复中是否包含可能引起过敏的建议
   * @param response AI回复内容
   * @param allergyInfo 儿童过敏信息
   * @returns 检查结果，包括是否包含过敏建议和相关的过敏物
   */
  check(
    response: string,
    allergyInfo: string[],
  ): { hasPotentialAllergy: boolean; allergens: string[] } {
    if (!allergyInfo || allergyInfo.length === 0) {
      return { hasPotentialAllergy: false, allergens: [] };
    }

    this.logger.debug(`检查过敏信息: ${allergyInfo.join(', ')}`);

    const detectedAllergens: string[] = [];

    // 遍历过敏信息，检查AI回复中是否包含相关建议
    for (const allergen of allergyInfo) {
      // 检查原始过敏物
      if (this.containsAllergen(response, allergen)) {
        detectedAllergens.push(allergen);
        continue;
      }

      // 检查相关关键词
      const keywords = this.allergyKeywordMap[allergen] || [];
      for (const keyword of keywords) {
        if (this.containsAllergen(response, keyword)) {
          detectedAllergens.push(`${allergen}(${keyword})`);
          break;
        }
      }
    }

    return {
      hasPotentialAllergy: detectedAllergens.length > 0,
      allergens: detectedAllergens,
    };
  }

  /**
   * 检查文本中是否包含过敏物关键词
   */
  private containsAllergen(text: string, allergen: string): boolean {
    // 使用正则表达式进行匹配，避免部分匹配（如"牛奶"匹配到"牛"）
    const regex = new RegExp(`${allergen}`, 'i');
    return regex.test(text);
  }
}
