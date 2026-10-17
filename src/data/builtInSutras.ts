// ============================================================================
// 「静心抄经」内置离线经典经文数据与文本处理工具
// src/data/builtInSutras.ts
// ============================================================================

import { SutraDocument } from '../types/sutra';

/**
 * 过滤文本中的所有中英文标点符号、空格与换行，提取纯汉字字符数组
 * 支持 Unicode 基本汉字、扩展 A 区与兼容汉字
 *
 * @param rawText 原始经文字符串
 * @returns 纯汉字单字数组
 */
export function filterToChineseChars(rawText: string): string[] {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }
  // 匹配汉字（CJK Unified Ideographs, Extension A, Compatibility Ideographs）
  const matches = rawText.match(/[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/g);
  return matches ?? [];
}

/**
 * 经典回向文与默认印章常量
 */
export const DEFAULT_DEDICATION_TEXT = '愿以此功德，普及于一切，我等与众生，皆共成佛道。';
export const DEFAULT_SEAL_TEXT = '静心';

/**
 * 传统回向文预设模板
 */
export const DEDICATION_TEMPLATES = [
  '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
  '愿消三障诸烦恼，愿得智慧真明了，普愿罪障悉消除，世世常行菩萨道。',
  '文殊师利勇猛智，普贤慧行亦复然，我今回向诸善根，随彼一切常修学。',
  '心如工画师，能画诸世间，五蕴悉从生，无法而不造。',
  '诸行无常，是生灭法，生灭灭已，寂灭为乐。',
];

/**
 * 《般若波罗蜜多心经》原始文本（唐·玄奘法师 译，纯正 260 字）
 */
const HEART_SUTRA_RAW = `
观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。
舍利子，色不异空，空不异色，色即是空，空即是色，受想行识亦复如是。
舍利子，是诸法空相，不生不灭，不垢不净，不增不减。
是故空中无色，无受想行识，无眼耳鼻舌身意，无色声香味触法，无眼界乃至无意识界，无无明亦无无明尽，乃至无老死亦无老死尽，无苦集灭道，无智亦无得。
以无所得故，菩提萨埵，依般若波罗蜜多故，心无挂碍；无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。
三世诸佛，依般若波罗蜜多故，得阿耨多罗三藐三菩提。
故知般若波罗蜜多，是大神咒，是大明咒，是无上咒，是无等等咒，能除一切苦，真实不虚。
故说般若波罗蜜多咒，即说咒曰：揭谛揭谛，波罗揭谛，波罗僧揭谛，菩提萨婆诃。
`.trim();

/**
 * 《大学·开篇》原始文本（儒家四书之首）
 */
const DA_XUE_RAW = `
大学之道，在明明德，在亲民，在止于至善。
知止而后有定，定而后能静，静而后能安，安而后能虑，虑而后能得。
物有本末，事有终始，知所先后，则近道矣。
古之欲明明德于天下者，先治其国；欲治其国者，先齐其家；欲齐其家者，先修其身；欲修其身者，先正其心；欲正其心者，先诚其意；欲诚其意者，先致其知，致知在格物。
物格而后知至，知至而后意诚，意诚而后心正，心正而后身修，身修而后家齐，家齐而后国治，国治而后天下平。
自天子以至于庶人，壹是皆以修身为本。
`.trim();

/**
 * 《太上老君说常清静经》原始文本（道家修心根本经）
 */
const QING_JING_RAW = `
老君曰：大道无形，生育天地；大道无情，运行日月；大道无名，长养万物；吾不知其名，强名曰道。
夫道者：有清有浊，有动有静；天清地浊，天动地静。男清女浊，男动女静。降本流末，而生万物。
清者浊之源，动者静之基。人能常清静，天地悉皆归。
夫人神好清，而心扰之；人心好静，而欲牵之。常能遣其欲，而心自静，澄其心而神自清。自然六欲不生，三毒消灭。所以不能者，为心未澄，欲未遣也。
能遣之者，内观其心，心无其心；外观其形，形无其形；远观其物，物无其物。三者既悟，唯见于空；观空亦空，空无所空；所空既无，无无亦无；无无既无，湛然常寂；寂无所寂，欲岂能生？欲既不生，即是真静。
真常应物，真常得性；常应常静，常清静矣。如此清静，渐入真道；既入真道，名为得道，虽名得道，实无所得；为化众生，名为得道；能悟之者，可传圣道。
`.trim();

/**
 * 《佛说吉祥经》原始文本（南传经典，元代安世高、近代李荣熙译）
 */
const JI_XIANG_RAW = `
如是我闻，一时佛住舍卫国祇树给孤独园。时已夜深，有一天神，殊胜光明，遍照祇树给孤独园，来至佛所，恭敬礼拜，站立一旁，以偈向佛请问曰：
多天神与人，渴望得利益，思虑求庇护，请示最吉祥。
世尊如是答言：
勿近愚痴者，应与智者交，尊敬有德者，是为最吉祥。
居住适宜处，往昔有德行，置身于正道，是为最吉祥。
多闻工艺精，严持诸禁戒，言谈悦人心，是为最吉祥。
奉养父母亲，爱护妻与子，从业要无害，是为最吉祥。
布施好品德，帮助诸亲眷，行为无瑕疵，是为最吉祥。
邪行须禁止，克己不饮酒，美德坚不移，是为最吉祥。
恭敬与谦逊，知足且感恩，适时闻教法，是为最吉祥。
忍耐与顺从，得见众沙门，适时论信仰，是为最吉祥。
自治净生活，领悟八正道，实证涅槃法，是为最吉祥。
依世法不动，无忧离尘垢，心境得安稳，是为最吉祥。
以此行诸事，在处无不胜，到处皆得福，是为最吉祥。
`.trim();

/**
 * 内置经典列表
 */
export const BUILT_IN_SUTRAS: SutraDocument[] = [
  {
    id: 'heart-sutra',
    title: '般若波罗蜜多心经',
    authorOrTranslator: '唐·玄奘法师 译',
    category: '佛经',
    content: filterToChineseChars(HEART_SUTRA_RAW),
    rawText: HEART_SUTRA_RAW,
    isCustom: false,
  },
  {
    id: 'qing-jing-sutra',
    title: '太上老君说常清静经',
    authorOrTranslator: '唐·葛玄 笔录',
    category: '道藏',
    content: filterToChineseChars(QING_JING_RAW),
    rawText: QING_JING_RAW,
    isCustom: false,
  },
  {
    id: 'da-xue-intro',
    title: '大学·开篇',
    authorOrTranslator: '春秋·曾子 述',
    category: '儒家经典',
    content: filterToChineseChars(DA_XUE_RAW),
    rawText: DA_XUE_RAW,
    isCustom: false,
  },
  {
    id: 'ji-xiang-sutra',
    title: '佛说吉祥经',
    authorOrTranslator: '南传三藏 · 李荣熙 译',
    category: '佛经',
    content: filterToChineseChars(JI_XIANG_RAW),
    rawText: JI_XIANG_RAW,
    isCustom: false,
  },
];

/**
 * 根据 ID 查找内置或预设经文
 */
export function getSutraById(id: string): SutraDocument | undefined {
  return BUILT_IN_SUTRAS.find((item) => item.id === id);
}

/**
 * 创建用户自定义经文对象
 *
 * @param title 标题
 * @param authorOrTranslator 来源/作者
 * @param rawText 原始输入的正文
 * @returns 完整的 SutraDocument
 */
export function createCustomSutra(
  title: string,
  authorOrTranslator: string,
  rawText: string
): SutraDocument {
  const content = filterToChineseChars(rawText);
  if (content.length === 0) {
    throw new Error('经文正文中未包含有效汉字，请检查输入内容');
  }

  const cleanTitle = title.trim() || '自选妙法经卷';
  const cleanAuthor = authorOrTranslator.trim() || '自选节录';
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    title: cleanTitle,
    authorOrTranslator: cleanAuthor,
    category: '自定义',
    content,
    rawText,
    isCustom: true,
    createdAt: Date.now(),
  };
}

/**
 * 将经文字符按乌丝栏列数切分（默认每列 8 个字格）
 * 用于古籍竖排从右往左排版计算
 *
 * @param chars 单字数组
 * @param charsPerColumn 每列字数（默认 8）
 * @returns 二维字符矩阵 [列索引][行索引]
 */
export function splitCharsIntoColumns(
  chars: string[],
  charsPerColumn = 8
): string[][] {
  const columns: string[][] = [];
  for (let i = 0; i < chars.length; i += charsPerColumn) {
    columns.push(chars.slice(i, i + charsPerColumn));
  }
  return columns;
}
