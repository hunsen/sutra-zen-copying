// ============================================================================
// 「静心抄经」核心 TypeScript 类型定义
// src/types/sutra.ts
// ============================================================================

/**
 * 单个采样点（归一化坐标 0.0 ~ 1.0，确保缩放至任意尺寸不失真）
 */
export interface StrokePoint {
  /** 归一化 X 坐标 [0, 1] */
  x: number;
  /** 归一化 Y 坐标 [0, 1] */
  y: number;
  /** 归一化笔触半径 [0.005, 0.08] */
  r: number;
  /** 墨色浓度 [0.3, 1.0]，用于表现飞白与干枯 */
  alpha: number;
  /** 相对本笔画起点的毫秒偏移量（用于支持笔迹倍速回放） */
  t: number;
}

/**
 * 单根矢量笔画
 */
export interface BrushStroke {
  points: StrokePoint[];
}

/**
 * 单个汉字的书写记录
 */
export interface WrittenCharRecord {
  /** 在整篇经文中的序号 (0 ~ N-1) */
  charIndex: number;
  /** 对应汉字，如 "观" */
  character: string;
  /** 矢量笔画数组（可随时无损重绘或回放） */
  strokes: BrushStroke[];
  /** 完成时间戳（毫秒） */
  updatedAt: number;
}

/**
 * 经文分类
 */
export type SutraCategory = '佛经' | '道藏' | '儒家经典' | '古诗词' | '自定义';

/**
 * 经文元数据与纯净字流
 */
export interface SutraDocument {
  /** 唯一标识，如 "heart-sutra" */
  id: string;
  /** 经文标题，如 "般若波罗蜜多心经" */
  title: string;
  /** 作者或译者，如 "唐·玄奘法师 译" */
  authorOrTranslator: string;
  /** 经典分类 */
  category: SutraCategory;
  /** 纯汉字数组（已过滤所有标点符号与空白字符） */
  content: string[];
  /** 原始文本（保留标点，用于阅读预览与排版对齐） */
  rawText?: string;
  /** 是否为用户本地离线自定义经文 */
  isCustom?: boolean;
  /** 创建时间戳（用于自定义经文排序） */
  createdAt?: number;
}

/** 纸张古笺主题类型 */
export type PaperTheme = 'xuan' | 'ciqing' | 'red-gold' | 'bamboo';

/** 墨色类型：松烟浓墨、泥金墨色、朱砂印泥/红墨 */
export type InkType = 'black' | 'gold' | 'cinnabar';

/**
 * 纸张主题配置
 */
export interface PaperThemeConfig {
  /** 主题 ID */
  id: PaperTheme;
  /** 显示名称 */
  name: string;
  /** 背景底色 (Hex) */
  bgColor: string;
  /** 丝栏/网格颜色 (Hex) */
  gridColor: string;
  /** 推荐墨色 (Hex) */
  recommendedInkColor: string;
  /** 视觉氛围描述 */
  description: string;
}

/**
 * 抄经会话与进度存储（IndexedDB 主表实体）
 */
export interface CopyingSession {
  /** 会话唯一 ID（UUID 或时间戳字符串） */
  sessionId: string;
  /** 关联经文 ID */
  sutraId: string;
  /** 纸张主题 */
  paperTheme: PaperTheme;
  /** 墨色类型 */
  inkType: InkType;
  /** 已书写的汉字记录，key 为 charIndex */
  writtenChars: Record<number, WrittenCharRecord>;
  /** 当前书写到的字索引 (0 ~ content.length - 1) */
  currentIndex: number;
  /** 卷尾回向文（如："愿以此功德，普及于一切..."） */
  dedicationText: string;
  /** 篆刻闲章/姓名章文字（2~4字，如 "静心"、"吉祥"） */
  sealText: string;
  /** 开始时间戳 */
  startedAt: number;
  /** 完成时间戳（未完成时为 undefined） */
  completedAt?: number;
  /** 累计静心抄写时长（秒） */
  totalDurationSec: number;
  /** 最后活动时间戳（用于恢复最近进度） */
  lastActiveAt?: number;
}

/**
 * 抄经历史摘要（用于功德簿列表与快速恢复）
 */
export interface SessionSummary {
  sessionId: string;
  sutraId: string;
  sutraTitle: string;
  paperTheme: PaperTheme;
  inkType: InkType;
  completedChars: number;
  totalChars: number;
  startedAt: number;
  completedAt?: number;
  lastActiveAt: number;
  totalDurationSec: number;
  isFinished: boolean;
}

/**
 * 原始指针事件采样点（用于 FingerBrushEngine 内部计算）
 */
export interface RawPointerSample {
  /** 画布像素坐标 X */
  x: number;
  /** 画布像素坐标 Y */
  y: number;
  /** 高精度时间戳 performance.now() */
  t: number;
}

/**
 * 笔刷物理引擎配置参数
 */
export interface BrushConfig {
  /** 最大笔触半径（像素），放大格中默认 14px */
  rMax: number;
  /** 最小出锋半径（像素），默认 2.2px */
  rMin: number;
  /** 速度平滑 EMA 系数 (0 ~ 1)，默认 0.35 */
  alpha: number;
  /** 速度衰减指数因子 β，默认 0.65 */
  beta: number;
  /** 起笔顿笔膨胀系数，默认 1.15 */
  dwellInflation: number;
  /** 起笔顿笔采样的前 N 个点，默认 4 */
  dwellPointCount: number;
  /** 起笔顿笔判定的最小累计位移（px），默认 8 */
  dwellMinDisplacement: number;
  /** 收笔出锋加速度阈值（px/ms），默认 0.4 */
  flickVelocityThreshold: number;
  /** 收笔出锋虚拟插值点数量，默认 6 */
  flickTailPoints: number;
  /** 收笔出锋步长系数 λ，默认 2.5 */
  flickLambda: number;
  /** 半径变化率约束系数，默认 0.15 */
  radiusChangeRate: number;
  /** 飞白干枯速度阈值（px/ms），默认 1.8 */
  dryBrushVelocity: number;
}

/**
 * 篆刻印章配置
 */
export interface SealConfig {
  /** 印章文字（2~4字） */
  text: string;
  /** 印章风格：朱文（阳刻白底红字） | 白文（阴刻红底白字） */
  style: 'zhu' | 'bai';
  /** 印章形状：方印 | 圆印 */
  shape: 'square' | 'round';
  /** 边框斑驳残损度 (0 ~ 1) */
  roughness: number;
}

/**
 * 音频引擎配置
 */
export interface AudioSettings {
  /** 主音量 (0.0 ~ 1.0) */
  masterVolume: number;
  /** 是否静音 */
  muted: boolean;
  /** 铜磬音效是否启用 */
  bowlEnabled: boolean;
  /** 木鱼音效是否启用 */
  woodenFishEnabled: boolean;
  /** 宣纸运笔摩擦白噪音是否启用 */
  frictionEnabled: boolean;
}

/**
 * 四款纸张主题配置常量表
 */
export const PAPER_THEMES: Record<PaperTheme, PaperThemeConfig> = {
  xuan: {
    id: 'xuan',
    name: '古法宣纸',
    bgColor: '#F4EFE6',
    gridColor: '#C8B69E',
    recommendedInkColor: '#1C1B19',
    description: '温润米黄，带细微竹浆纤维纹理，日间久看不累',
  },
  ciqing: {
    id: 'ciqing',
    name: '磁青金经',
    bgColor: '#16212E',
    gridColor: '#3A4E66',
    recommendedInkColor: '#E6C17A',
    description: '仿明代御制磁青纸泥金写经，深邃静谧，适合夜间',
  },
  'red-gold': {
    id: 'red-gold',
    name: '洒金红笺',
    bgColor: '#8E2924',
    gridColor: '#B85D57',
    recommendedInkColor: '#F5D076',
    description: '传统朱红宣纸随机散布程序化金箔斑点，适合抄写吉祥经文',
  },
  bamboo: {
    id: 'bamboo',
    name: '古籍竹纸',
    bgColor: '#E5E8DC',
    gridColor: '#9CA894',
    recommendedInkColor: '#232620',
    description: '淡雅茶绿古籍色调，最大限度降低 LCD 屏幕蓝光刺激',
  },
};

/**
 * 墨色 Hex 映射
 */
export const INK_COLORS: Record<InkType, string> = {
  black: '#1C1B19',
  gold: '#E6C17A',
  cinnabar: '#B22222',
};

/**
 * 默认笔刷动力学参数
 */
export const DEFAULT_BRUSH_CONFIG: BrushConfig = {
  rMax: 14,
  rMin: 2.2,
  alpha: 0.35,
  beta: 0.65,
  dwellInflation: 1.15,
  dwellPointCount: 4,
  dwellMinDisplacement: 8,
  flickVelocityThreshold: 0.4,
  flickTailPoints: 6,
  flickLambda: 2.5,
  radiusChangeRate: 0.15,
  dryBrushVelocity: 1.8,
};

/**
 * 默认音频配置
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  muted: false,
  bowlEnabled: true,
  woodenFishEnabled: true,
  frictionEnabled: true,
};
