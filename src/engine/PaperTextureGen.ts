// ============================================================================
// 「静心抄经」程序化离屏纸张纹理生成器
// src/engine/PaperTextureGen.ts
// 纯 Canvas 2D 离线算法程序化合成四款中国古法纸张：
// 1. 古法宣纸 (温润米黄 + 植物纤维 + 宣纸微孔)
// 2. 磁青金经 (御制深蓝 + 矿物银屑 + 细微经纬暗纹)
// 3. 洒金红笺 (朱砂熟宣 + 多边形金箔碎片 + 金粉飞溅)
// 4. 古籍竹纸 (茶绿护眼 + 帘床竹帘横纹 + 细长竹浆丝)
// ============================================================================

import { PaperTheme, PAPER_THEMES } from '../types/sutra';

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

/**
 * 纹理画布缓存池，避免重复耗时程序化计算
 */
const textureCache = new Map<string, CanvasLike>();

/**
 * 创建离屏画布（优先使用 document.createElement 确保跨浏览器与 Safari pattern 兼容性）
 */
function createOffscreenCanvas(width: number, height: number): CanvasLike {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  throw new Error('当前环境既不支持 HTMLCanvasElement 也不支持 OffscreenCanvas');
}

/**
 * 获取 2D 绘图上下文
 */
function get2DContext(canvas: CanvasLike): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error('无法初始化 Canvas 2D 上下文');
  }
  return ctx;
}

/**
 * 伪随机数发生器（基于简单 LCG 算法，便于生成稳定、连续的无缝纹理分布）
 */
class PseudoRandom {
  private seed: number;

  constructor(seed = 123456789) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * 绘制高频纸张微孔与颗粒噪点 (Grain Noise)
 */
function renderMicroGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  density: number,
  darkColor: string,
  lightColor: string,
  rng: PseudoRandom
): void {
  const count = Math.floor(width * height * density);
  for (let i = 0; i < count; i++) {
    const x = rng.next() * width;
    const y = rng.next() * height;
    const size = rng.range(0.6, 1.6);
    ctx.fillStyle = rng.next() > 0.5 ? darkColor : lightColor;
    ctx.fillRect(x, y, size, size);
  }
}

/**
 * 绘制曲折散落的天然植物纤维丝（桑皮、檀皮、竹浆纤维）
 */
function renderPaperFibers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fiberCount: number,
  colors: string[],
  rng: PseudoRandom
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < fiberCount; i++) {
    const startX = rng.next() * width;
    const startY = rng.next() * height;
    const len = rng.range(8, 36);
    const angle = rng.range(0, Math.PI * 2);
    const curvature = rng.range(-0.5, 0.5);

    const midX = startX + Math.cos(angle) * (len * 0.5) + Math.sin(angle) * (len * curvature);
    const midY = startY + Math.sin(angle) * (len * 0.5) - Math.cos(angle) * (len * curvature);

    const endX = startX + Math.cos(angle) * len;
    const endY = startY + Math.sin(angle) * len;

    const color = colors[Math.floor(rng.next() * colors.length)];
    ctx.strokeStyle = color;
    ctx.lineWidth = rng.range(0.4, 1.2);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();

    // 细微分叉
    if (rng.next() > 0.65) {
      const branchAngle = angle + rng.range(-0.8, 0.8);
      const branchLen = rng.range(4, 12);
      ctx.lineWidth = rng.range(0.3, 0.8);
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(
        midX + Math.cos(branchAngle) * branchLen,
        midY + Math.sin(branchAngle) * branchLen
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * 绘制不规则金箔碎片（洒金工艺）
 */
function renderGoldFlakes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  largeFlakeCount: number,
  smallDustCount: number,
  rng: PseudoRandom
): void {
  ctx.save();

  // 1. 金粉飞溅微尘（微细圆点）
  const goldDustGradients = ['rgba(255, 235, 140, 0.85)', 'rgba(230, 193, 100, 0.75)', 'rgba(212, 175, 55, 0.6)'];
  for (let i = 0; i < smallDustCount; i++) {
    const x = rng.next() * width;
    const y = rng.next() * height;
    const r = rng.range(0.6, 2.2);

    ctx.fillStyle = goldDustGradients[Math.floor(rng.next() * goldDustGradients.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 多边形片状金箔（手工撕碎散落的不规则金叶）
  for (let i = 0; i < largeFlakeCount; i++) {
    const cx = rng.next() * width;
    const cy = rng.next() * height;
    const baseRadius = rng.range(2.5, 7.5);
    const sides = Math.floor(rng.range(5, 8));
    const rotation = rng.range(0, Math.PI * 2);

    const grad = ctx.createLinearGradient(
      cx - baseRadius,
      cy - baseRadius,
      cx + baseRadius,
      cy + baseRadius
    );
    grad.addColorStop(0, '#FFF5C2');
    grad.addColorStop(0.35, '#F5D076');
    grad.addColorStop(0.7, '#D4AF37');
    grad.addColorStop(1, '#9E7822');

    ctx.fillStyle = grad;
    ctx.beginPath();

    for (let s = 0; s < sides; s++) {
      const theta = rotation + (s / sides) * Math.PI * 2;
      const r = baseRadius * rng.range(0.6, 1.4);
      const px = cx + Math.cos(theta) * r;
      const py = cy + Math.sin(theta) * r;
      if (s === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();

    // 金箔高光边缘微光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 绘制竹纸的帘床横纹（竹帘抄纸留下的轻微水纹印痕）
 */
function renderBambooSieveLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stepY: number,
  rng: PseudoRandom
): void {
  ctx.save();
  ctx.lineWidth = 0.75;

  for (let y = stepY; y < height; y += stepY) {
    const jitterY = y + rng.range(-1, 1);
    ctx.strokeStyle = rng.next() > 0.4 ? 'rgba(156, 168, 148, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, jitterY);

    // 细微轻柔波浪
    for (let x = 60; x < width; x += 60) {
      const curJitter = jitterY + rng.range(-0.6, 0.6);
      ctx.lineTo(x, curJitter);
    }
    ctx.lineTo(width, jitterY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 绘制宣纸与古籍上的大尺度自然晕染云斑（模拟天然手工纸张厚薄不均的温润包浆感）
 */
function renderOrganicClouds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blotchCount: number,
  color: string,
  rng: PseudoRandom
): void {
  ctx.save();
  for (let i = 0; i < blotchCount; i++) {
    const cx = rng.next() * width;
    const cy = rng.next() * height;
    const radius = rng.range(60, 180);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================================
// 四款纸张核心生成算法
// ============================================================================

/**
 * 1. 古法宣纸生成算法
 * 温润米黄，细密植物短纤维，轻微纸面颗粒与有机包浆
 */
function generateXuanPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rng = new PseudoRandom(1001);
  const cfg = PAPER_THEMES.xuan;

  // 1. 底色平铺
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. 有机手工纸张包浆晕染
  renderOrganicClouds(ctx, width, height, 8, 'rgba(195, 175, 145, 0.12)', rng);
  renderOrganicClouds(ctx, width, height, 6, 'rgba(255, 250, 240, 0.25)', rng);

  // 3. 宣纸纤维杂质（细小桑皮与檀皮线头）
  const fiberColors = [
    'rgba(168, 146, 120, 0.22)',
    'rgba(145, 125, 102, 0.18)',
    'rgba(120, 105, 88, 0.14)',
    'rgba(255, 255, 255, 0.35)',
  ];
  renderPaperFibers(ctx, width, height, Math.floor(width * 0.18), fiberColors, rng);

  // 4. 微观粗糙度颗粒
  renderMicroGrain(
    ctx,
    width,
    height,
    0.008,
    'rgba(160, 140, 115, 0.06)',
    'rgba(255, 255, 255, 0.08)',
    rng
  );
}

/**
 * 2. 磁青金经生成算法
 * 御制深蓝、深浅暗纹晕染、微量细银星芒与云母光泽
 */
function generateCiqingPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rng = new PseudoRandom(2002);
  const cfg = PAPER_THEMES.ciqing;

  // 1. 底色平铺
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. 靛青墨晕暗纹
  renderOrganicClouds(ctx, width, height, 10, 'rgba(10, 16, 24, 0.35)', rng);
  renderOrganicClouds(ctx, width, height, 8, 'rgba(30, 48, 68, 0.22)', rng);

  // 3. 矿物微晶与银屑星斑
  renderMicroGrain(
    ctx,
    width,
    height,
    0.012,
    'rgba(5, 10, 16, 0.4)',
    'rgba(200, 220, 245, 0.16)',
    rng
  );

  // 4. 细密蓝靛深色麻纤维
  const fiberColors = [
    'rgba(8, 14, 22, 0.4)',
    'rgba(58, 78, 102, 0.25)',
    'rgba(160, 190, 225, 0.12)',
  ];
  renderPaperFibers(ctx, width, height, Math.floor(width * 0.1), fiberColors, rng);
}

/**
 * 3. 洒金红笺生成算法
 * 朱砂熟宣，大小不一面状金箔碎片 + 金粉微粒散落
 */
function generateRedGoldPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rng = new PseudoRandom(3003);
  const cfg = PAPER_THEMES['red-gold'];

  // 1. 经典朱砂红底色
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. 朱红深浅晕染
  renderOrganicClouds(ctx, width, height, 9, 'rgba(95, 20, 18, 0.35)', rng);
  renderOrganicClouds(ctx, width, height, 6, 'rgba(180, 50, 42, 0.2)', rng);

  // 3. 红宣纸暗纹红丝
  const fiberColors = [
    'rgba(70, 12, 10, 0.35)',
    'rgba(215, 80, 70, 0.18)',
    'rgba(245, 200, 120, 0.2)',
  ];
  renderPaperFibers(ctx, width, height, Math.floor(width * 0.12), fiberColors, rng);

  // 4. 洒金核心工艺：大块金箔 + 细小金星
  const largeFlakes = Math.floor(width * 0.045);
  const smallDust = Math.floor(width * 0.4);
  renderGoldFlakes(ctx, width, height, largeFlakes, smallDust, rng);
}

/**
 * 4. 古籍竹纸生成算法
 * 淡雅茶绿、帘床竹纹、天然竹纤维丝
 */
function generateBambooPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rng = new PseudoRandom(4004);
  const cfg = PAPER_THEMES.bamboo;

  // 1. 茶绿底色
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. 岁月草木晕染
  renderOrganicClouds(ctx, width, height, 7, 'rgba(195, 202, 182, 0.3)', rng);
  renderOrganicClouds(ctx, width, height, 7, 'rgba(135, 148, 126, 0.12)', rng);

  // 3. 帘床竹帘横向水纹（每 12px 一道细微帘痕）
  renderBambooSieveLines(ctx, width, height, 12, rng);

  // 4. 细长竹纤维（竹浆抄纸特征）
  const fiberColors = [
    'rgba(122, 138, 114, 0.22)',
    'rgba(156, 168, 148, 0.28)',
    'rgba(255, 255, 255, 0.2)',
  ];
  renderPaperFibers(ctx, width, height, Math.floor(width * 0.15), fiberColors, rng);

  // 5. 表面微颗粒
  renderMicroGrain(
    ctx,
    width,
    height,
    0.007,
    'rgba(120, 130, 110, 0.08)',
    'rgba(255, 255, 255, 0.1)',
    rng
  );
}

// ============================================================================
// 公共导出接口
// ============================================================================

/**
 * 程序化生成指定主题的无缝纸张纹理离屏画布（带高命中率缓存）
 *
 * @param theme 纸张主题类型 ('xuan' | 'ciqing' | 'red-gold' | 'bamboo')
 * @param width 纹理宽（默认 512px，足以铺满并高速作为平铺 pattern 渲染）
 * @param height 纹理高（默认 512px）
 * @returns 离屏画布对象 (CanvasLike)
 */
export function generatePaperTexture(
  theme: PaperTheme = 'xuan',
  width = 512,
  height = 512
): CanvasLike {
  const cacheKey = `${theme}_${width}x${height}`;
  const cached = textureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const canvas = createOffscreenCanvas(width, height);
  const ctx = get2DContext(canvas);

  switch (theme) {
    case 'xuan':
      generateXuanPaper(ctx, width, height);
      break;
    case 'ciqing':
      generateCiqingPaper(ctx, width, height);
      break;
    case 'red-gold':
      generateRedGoldPaper(ctx, width, height);
      break;
    case 'bamboo':
      generateBambooPaper(ctx, width, height);
      break;
    default:
      generateXuanPaper(ctx, width, height);
      break;
  }

  textureCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * 获取可平铺的 CanvasPattern 对象，用于超长画卷极速平铺渲染
 *
 * @param ctx 目标画布上下文
 * @param theme 纸张主题
 * @returns CanvasPattern 或 null
 */
export function getPaperPattern(
  ctx: CanvasRenderingContext2D,
  theme: PaperTheme = 'xuan'
): CanvasPattern | null {
  try {
    const textureCanvas = generatePaperTexture(theme, 512, 512);
    return ctx.createPattern(textureCanvas as CanvasImageSource, 'repeat');
  } catch (err) {
    console.warn('创建纸张平铺纹理异常:', err);
    return null;
  }
}

/**
 * 将纸张纹理直接平铺绘制到目标画布
 *
 * @param ctx 目标 2D 上下文
 * @param theme 纸张主题
 * @param width 目标区域宽度
 * @param height 目标区域高度
 */
export function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  theme: PaperTheme,
  width: number,
  height: number
): void {
  ctx.save();
  // 1. 始终优先填满纯正的纸张底色，绝对保证绝不出现黑底或透明
  const baseColor = PAPER_THEMES[theme]?.bgColor || '#F4EFE6';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  try {
    const textureCanvas = generatePaperTexture(theme, 512, 512);
    // 2. 如果绘制区域在 512x512 以内（如书写台 PAD_SIZE = 380），直接使用 drawImage
    // 这不仅渲染速度更快，且 100% 避开 Safari/WebKit 对离屏 canvas 调用 createPattern 偶尔产生黑屏的系统级缺陷
    if (width <= 512 && height <= 512) {
      ctx.drawImage(textureCanvas as CanvasImageSource, 0, 0, width, height);
    } else {
      // 3. 超长长卷使用平铺 pattern，若模式创建失败则已保留上面的纯底色
      const pattern = ctx.createPattern(textureCanvas as CanvasImageSource, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
      }
    }
  } catch (err) {
    console.warn('平铺纸张纹理异常，保留纯底色:', err);
  }
  ctx.restore();
}

/**
 * 生成纸张纹理的 Base64 DataURL，方便在 CSS 样式或图片标签中作为背景使用
 */
export function generatePaperDataUrl(
  theme: PaperTheme = 'xuan',
  width = 512,
  height = 512
): string {
  const canvas = generatePaperTexture(theme, width, height);
  if ('toDataURL' in canvas) {
    return (canvas as HTMLCanvasElement).toDataURL('image/png');
  }

  // 针对 OffscreenCanvas 场景
  if (typeof document !== 'undefined') {
    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    const tCtx = temp.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(canvas as CanvasImageSource, 0, 0);
      return temp.toDataURL('image/png');
    }
  }

  return '';
}

/**
 * 清除纹理缓存
 */
export function clearPaperTextureCache(): void {
  textureCache.clear();
}
