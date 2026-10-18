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

import { toTraditional, toSimplified } from './s2tData';
export { toTraditional, toSimplified };

/**
 * 經典回向文與默認印章常量（繁體）
 */
export const DEFAULT_DEDICATION_TEXT = '願以此功德，普及於一切，我等與眾生，皆共成佛道。';
export const DEFAULT_SEAL_TEXT = '靜心';

/**
 * 傳統回向文預設模板（正體繁體）
 */
export const DEDICATION_TEMPLATES = [
  '願以此功德，普及於一切，我等與眾生，皆共成佛道。',
  '願消三障諸煩惱，願得智慧真明了，普願罪障悉消除，世世常行菩薩道。',
  '文殊師利勇猛智，普賢慧行亦復然，我今回向諸善根，隨彼一切常修學。',
  '心如工畫師，能畫諸世間，五蘊悉從生，無法而不造。',
  '諸行無常，是生滅法，生滅滅已，寂滅為樂。',
];

/**
 * 《般若波羅蜜多心經》原始文本（唐·玄奘法師 譯，正體 260 字）
 */
const HEART_SUTRA_RAW = `
觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。
舍利子，色不異空，空不異色，色即是空，空即是色，受想行識亦復如是。
舍利子，是諸法空相，不生不滅，不垢不淨，不增不減。
是故空中無色，無受想行識，無眼耳鼻舌身意，無色聲香味觸法，無眼界乃至無意識界，無無明亦無無明盡，乃至無老死亦無老死盡，無苦集滅道，無智亦無得。
以無所得故，菩提薩埵，依般若波羅蜜多故，心無罣礙；無罣礙故，無有恐怖，遠離顛倒夢想，究竟涅槃。
三世諸佛，依般若波羅蜜多故，得阿耨多羅三藐三菩提。
故知般若波羅蜜多，是大神咒，是大明咒，是無上咒，是無等等咒，能除一切苦，真實不虛。
故說般若波羅蜜多咒，即說咒曰：揭諦揭諦，波羅揭諦，波羅僧揭諦，菩提薩婆訶。
`.trim();

/**
 * 《大學·開篇》原始文本（儒家四書之首）
 */
const DA_XUE_RAW = `
大學之道，在明明德，在親民，在止於至善。
知止而后有定，定而后能靜，靜而后能安，安而后能慮，慮而后能得。
物有本末，事有終始，知所先後，則近道矣。
古之欲明明德於天下者，先治其國；欲治其國者，先齊其家；欲齊其家者，先修其身；欲修其身者，先正其心；欲正其心者，先誠其意；欲誠其意者，先致其知，致知在格物。
物格而后知至，知至而后意誠，意誠而后心正，心正而后身修，身修而后家齊，家齊而后國治，國治而后天下平。
自天子以至於庶人，壹是皆以修身為本。
`.trim();

/**
 * 《太上老君說常清靜經》原始文本（道家修心根本經）
 */
const QING_JING_RAW = `
老君曰：大道無形，生育天地；大道無情，運行日月；大道無名，長養萬物；吾不知其名，強名曰道。
夫道者：有清有濁，有動有靜；天清地濁，天動地靜。男清女濁，男動女靜。降本流末，而生萬物。
清者濁之源，動者靜之基。人能常清靜，天地悉皆歸。
夫人神好清，而心擾之；人心好靜，而欲牽之。常能遣其欲，而心自靜，澄其心而神自清。自然六欲不生，三毒消滅。所以不能者，為心未澄，欲未遣也。
能遣之者，內觀其心，心無其心；外觀其形，形無其形；遠觀其物，物無其物。三者既悟，唯見於空；觀空亦空，空無所空；所空既無，無無亦無；無無既無，湛然常寂；寂無所寂，欲豈能生？欲既不生，即是真靜。
真常應物，真常得性；常應常靜，常清靜矣。如此清靜，漸入真道；既入真道，名為得道，雖名得道，實無所得；為化眾生，名為得道；能悟之者，可傳聖道。
`.trim();

/**
 * 《佛說吉祥經》原始文本（南傳經典，元代安世高、近代李榮熙譯）
 */
const JI_XIANG_RAW = `
如是我聞，一時佛住舍衛國祇樹給孤獨園。時已夜深，有一天神，殊勝光明，遍照祇樹給孤獨園，來至佛所，恭敬禮拜，站立一旁，以偈向佛請問曰：
多天神與人，渴望得利益，思慮求庇護，請示最吉祥。
世尊如是答言：
勿近愚癡者，應與智者交，尊敬有德者，是為最吉祥。
居住適宜處，往昔有德行，置身於正道，是為最吉祥。
多聞工藝精，嚴持諸禁戒，言談悅人心，是為最吉祥。
奉養父母親，愛護妻與子，從業要無害，是為最吉祥。
布施好品德，幫助諸親眷，行為無瑕疵，是為最吉祥。
邪行須禁止，克己不飲酒，美德堅不移，是為最吉祥。
恭敬與謙遜，知足且感恩，適時聞教法，是為最吉祥。
忍耐與順從，得見眾沙門，適時論信仰，是為最吉祥。
自治淨生活，領悟八正道，實證涅槃法，是為最吉祥。
依世法不動，無憂離塵垢，心境得安穩，是為最吉祥。
以此行諸事，在處無不勝，到處皆得福，是為最吉祥。
`.trim();

/**
 * 內置經典列表（正體繁體）
 */
export const BUILT_IN_SUTRAS: SutraDocument[] = [
  {
    id: 'heart-sutra',
    title: '般若波羅蜜多心經',
    authorOrTranslator: '唐·玄奘法師 譯',
    category: '佛經',
    content: filterToChineseChars(HEART_SUTRA_RAW),
    rawText: HEART_SUTRA_RAW,
    isCustom: false,
  },
  {
    id: 'qing-jing-sutra',
    title: '太上老君說常清靜經',
    authorOrTranslator: '唐·葛玄 筆錄',
    category: '道藏',
    content: filterToChineseChars(QING_JING_RAW),
    rawText: QING_JING_RAW,
    isCustom: false,
  },
  {
    id: 'da-xue-intro',
    title: '大學·開篇',
    authorOrTranslator: '春秋·曾子 述',
    category: '儒家經典',
    content: filterToChineseChars(DA_XUE_RAW),
    rawText: DA_XUE_RAW,
    isCustom: false,
  },
  {
    id: 'ji-xiang-sutra',
    title: '佛說吉祥經',
    authorOrTranslator: '南傳三藏 · 李榮熙 譯',
    category: '佛經',
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
  const tradRaw = toTraditional(rawText);
  const content = filterToChineseChars(tradRaw);
  if (content.length === 0) {
    throw new Error('經文正文中未包含有效漢字，請檢查輸入內容');
  }

  const cleanTitle = toTraditional(title.trim() || '自選妙法經卷');
  const cleanAuthor = toTraditional(authorOrTranslator.trim() || '自選節錄');
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    title: cleanTitle,
    authorOrTranslator: cleanAuthor,
    category: '自定義',
    content,
    rawText: tradRaw,
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
