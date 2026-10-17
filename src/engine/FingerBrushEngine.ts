// ============================================================================
// 「静心抄经」无压感手指毛笔动力学引擎
// src/engine/FingerBrushEngine.ts
// 严格按照文档 3.1 & 3.2 数学模型实现：
// 1. 瞬时速度计算与 EMA 平滑速度 V_i
// 2. 指数衰减笔触半径 R(V_i) + 起笔顿笔膨胀补偿 + 半径渐进约束
// 3. 收笔出锋合成器 synthesizeFlickTail() (沿切线生成 6 个二次递减尖锋点)
// 4. 二次贝塞尔中点密集圆盘插值绘制 renderStrokeToCanvas() (支持任意尺寸无损重绘与飞白)
// ============================================================================

import {
  StrokePoint,
  BrushStroke,
  BrushConfig,
  DEFAULT_BRUSH_CONFIG,
  INK_COLORS,
  InkType,
} from '../types/sutra';

/**
 * 欧氏距离计算
 */
export function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

const rgbCache = new Map<string, [number, number, number]>();

function getRgbComponents(color: string): [number, number, number] {
  const cached = rgbCache.get(color);
  if (cached) return cached;

  let r = 0, g = 0, b = 0;
  if (color.startsWith('#')) {
    let cleanHex = color.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  } else {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    }
  }

  const result: [number, number, number] = [r, g, b];
  rgbCache.set(color, result);
  return result;
}

/**
 * 颜色解析为 RGBA 格式
 */
export function parseColorToRgba(hexOrRgba: string, alpha = 1): string {
  const [r, g, b] = getRgbComponents(hexOrRgba);
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

/**
 * 在两个采样点之间以密集圆盘印章进行平滑线性插值（用于实时运笔过程中的无断裂平滑绘制）
 */
export function renderSegmentInterpolation(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  r1: number,
  a1: number,
  x2: number,
  y2: number,
  r2: number,
  a2: number,
  inkColor: string,
  stepSize = 1.5
): void {
  const dist = distanceBetween(x1, y1, x2, y2);
  const steps = Math.max(1, Math.ceil(dist / stepSize));

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const ix = x1 + (x2 - x1) * t;
    const iy = y1 + (y2 - y1) * t;
    const ir = r1 + (r2 - r1) * t;
    const ia = a1 + (a2 - a1) * t;
    renderInkStamp(ctx, ix, iy, ir, ia, inkColor);
  }
}

/**
 * 手指毛笔动力学跟踪与计算器
 * 在 pointerdown -> pointermove -> pointerup 周期中持续维护运动状态
 */
export class FingerBrushTracker {
  private config: BrushConfig;
  private canvasWidth: number;
  private canvasHeight: number;

  // 笔画采样点历史
  private rawPoints: { x: number; y: number; t: number }[] = [];
  private calculatedPoints: StrokePoint[] = [];

  // 动力学状态
  private smoothVelocity = 0;
  private lastRadius = 0;
  private strokeStartTime = 0;
  private cumulativeDisplacement = 0;

  constructor(
    canvasWidth = 380,
    canvasHeight = 380,
    config: Partial<BrushConfig> = {}
  ) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.config = { ...DEFAULT_BRUSH_CONFIG, ...config };
    this.lastRadius = (this.config.rMax + this.config.rMin) / 2;
  }

  /**
   * 重置画布尺寸
   */
  public resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /**
   * 更新笔刷参数配置
   */
  public updateConfig(config: Partial<BrushConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 1. 起笔落纸 (pointerdown)
   */
  public startStroke(x: number, y: number, t = performance.now()): StrokePoint {
    this.rawPoints = [{ x, y, t }];
    this.strokeStartTime = t;
    this.smoothVelocity = 0;
    this.cumulativeDisplacement = 0;

    // 起笔初识半径设定为基础最大半径的 85%（圆润饱满）
    const initialRadius = this.config.rMax * 0.85;
    this.lastRadius = initialRadius;

    const initialPoint: StrokePoint = {
      x: x / this.canvasWidth,
      y: y / this.canvasHeight,
      r: initialRadius / Math.min(this.canvasWidth, this.canvasHeight),
      alpha: 1.0,
      t: 0,
    };

    this.calculatedPoints = [initialPoint];
    return initialPoint;
  }

  /**
   * 2. 运笔移动计算 (pointermove)
   * 严格执行：欧氏距离 -> 瞬时速度 -> EMA平滑速度 -> 笔触半径计算 -> 顿笔补偿 -> 半径渐进约束
   */
  public addPoint(x: number, y: number, t = performance.now()): StrokePoint {
    const prevRaw = this.rawPoints[this.rawPoints.length - 1];
    if (!prevRaw) {
      return this.startStroke(x, y, t);
    }

    // A. 欧氏距离 d_i 与时间差 Δt_i
    const dist = distanceBetween(prevRaw.x, prevRaw.y, x, y);
    const dt = Math.max(t - prevRaw.t, 1); // 保证至少 1ms 避免被零除
    this.cumulativeDisplacement += dist;

    // B. 瞬时速度 v_i (px/ms)
    const instantVelocity = dist / dt;

    // C. 指数移动平均 (EMA) 计算平滑速度 V_i
    // V_i = α * v_i + (1 - α) * V_{i-1} (α = 0.35)
    this.smoothVelocity =
      this.config.alpha * instantVelocity +
      (1 - this.config.alpha) * this.smoothVelocity;

    // D. 核心笔锋公式：动态笔触半径
    // R_target(V_i) = R_min + (R_max - R_min) * e^(-β * V_i)
    let targetRadius =
      this.config.rMin +
      (this.config.rMax - this.config.rMin) *
        Math.exp(-this.config.beta * this.smoothVelocity);

    // E. 起笔顿笔/藏锋膨胀补偿：
    // 当处于笔画前 N 个点且累计位移小于阈值时，叠加膨胀因子 1.15
    const pointIndex = this.rawPoints.length;
    if (
      pointIndex <= this.config.dwellPointCount &&
      this.cumulativeDisplacement < this.config.dwellMinDisplacement
    ) {
      targetRadius *= this.config.dwellInflation;
    }

    // F. 半径渐进约束：限制相邻两次绘制的半径变化率 |R_i - R_{i-1}| <= 0.15 * d_i
    const maxRadiusChange = this.config.radiusChangeRate * dist;
    if (Math.abs(targetRadius - this.lastRadius) > maxRadiusChange) {
      if (targetRadius > this.lastRadius) {
        targetRadius = this.lastRadius + maxRadiusChange;
      } else {
        targetRadius = this.lastRadius - maxRadiusChange;
      }
    }

    // 边界限制
    targetRadius = Math.max(
      this.config.rMin * 0.7,
      Math.min(targetRadius, this.config.rMax * 1.35)
    );
    this.lastRadius = targetRadius;

    // G. 飞白墨色浓度计算：当速度高于阈值时墨色变淡
    let alpha = 1.0;
    if (this.smoothVelocity > this.config.dryBrushVelocity) {
      // 速度越快，墨色越枯（保留 0.45 ~ 0.85 随机微调）
      const dryFactor = Math.min(
        1.0,
        (this.smoothVelocity - this.config.dryBrushVelocity) / 2.0
      );
      alpha = Math.max(0.4, 1.0 - dryFactor * 0.45 + (Math.random() * 0.1 - 0.05));
    }

    // H. 归一化保存
    const minDim = Math.min(this.canvasWidth, this.canvasHeight);
    const strokePoint: StrokePoint = {
      x: x / this.canvasWidth,
      y: y / this.canvasHeight,
      r: targetRadius / minDim,
      alpha: Math.min(1.0, Math.max(0.3, alpha)),
      t: Math.round(t - this.strokeStartTime),
    };

    this.rawPoints.push({ x, y, t });
    this.calculatedPoints.push(strokePoint);
    return strokePoint;
  }

  /**
   * 3. 收笔出锋合成器 (synthesizeFlickTail)
   * 当 pointerup 且最末速度较快时，自动沿切线方向生成 6 个半径递减至 0 的虚拟插值点
   */
  public endStroke(t = performance.now()): StrokePoint[] {
    const totalCount = this.calculatedPoints.length;
    if (totalCount < 2) {
      return [...this.calculatedPoints];
    }

    const minDim = Math.min(this.canvasWidth, this.canvasHeight);
    const lastRaw = this.rawPoints[this.rawPoints.length - 1];
    const prevRaw = this.rawPoints[Math.max(0, this.rawPoints.length - 3)];

    // 判断末端平滑速度是否达到出锋阈值 (0.4 px/ms)
    if (this.smoothVelocity >= this.config.flickVelocityThreshold && lastRaw && prevRaw) {
      const dx = lastRaw.x - prevRaw.x;
      const dy = lastRaw.y - prevRaw.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0.5) {
        // 切线方向单位向量 u = (cosθ, sinθ)
        const ux = dx / len;
        const uy = dy / len;

        const N = this.config.flickTailPoints; // 6 个虚拟点
        const lambda = this.config.flickLambda; // 2.5 步长系数
        const lastCalc = this.calculatedPoints[totalCount - 1];
        const lastRealRadius = this.lastRadius;

        for (let k = 1; k <= N; k++) {
          // P_tail,k = P_last + k * λ * V_end * u
          const offsetDist = k * lambda * this.smoothVelocity;
          const tailPxX = lastRaw.x + ux * offsetDist;
          const tailPxY = lastRaw.y + uy * offsetDist;

          // R_tail,k = R_last * (1 - k/N)^2
          const decay = Math.pow(1 - k / N, 2);
          const tailRadius = Math.max(0.6, lastRealRadius * decay);

          // 墨色递减出锋
          const tailAlpha = Math.max(0.2, lastCalc.alpha * (1 - k / (N + 1)));

          const tailPoint: StrokePoint = {
            x: tailPxX / this.canvasWidth,
            y: tailPxY / this.canvasHeight,
            r: tailRadius / minDim,
            alpha: tailAlpha,
            t: Math.round(t - this.strokeStartTime + k * 6),
          };

          this.calculatedPoints.push(tailPoint);
        }
      }
    }

    return [...this.calculatedPoints];
  }

  /**
   * 获取当前运笔平滑速度
   */
  public getSmoothVelocity(): number {
    return this.smoothVelocity;
  }

  /**
   * 获取当前笔画所有已计算点
   */
  public getPoints(): StrokePoint[] {
    return [...this.calculatedPoints];
  }
}

// ============================================================================
// 连续印章与二次贝塞尔插值渲染引擎
// ============================================================================

/**
 * 绘制单个水墨圆盘印章（带径向柔化渐变，模拟毛笔吸附墨水渗入纸张边缘的质感）
 */
export function renderInkStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  inkColorRgb: string
): void {
  if (radius <= 0.1 || alpha <= 0.01) {
    return;
  }

  ctx.save();
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  // 中心 95% 不透明度，外缘 10% 处平滑衰减至 0
  grad.addColorStop(0, parseColorToRgba(inkColorRgb, alpha * 0.95));
  grad.addColorStop(0.85, parseColorToRgba(inkColorRgb, alpha * 0.7));
  grad.addColorStop(1.0, parseColorToRgba(inkColorRgb, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 沿两中点 M1 与 M2 间进行二次贝塞尔密集弧长插值绘制
 *
 * @param ctx 目标画布上下文
 * @param m1 起点（中点 1）
 * @param pCtrl 控制点
 * @param m2 终点（中点 2）
 * @param r1 起点半径
 * @param r2 终点半径
 * @param a1 起点透明度
 * @param a2 终点透明度
 * @param inkColor 墨色
 * @param stepSize 密集插值步长（px，默认 1.5px）
 */
function renderBezierSegment(
  ctx: CanvasRenderingContext2D,
  m1: { x: number; y: number },
  pCtrl: { x: number; y: number },
  m2: { x: number; y: number },
  r1: number,
  r2: number,
  a1: number,
  a2: number,
  inkColor: string,
  stepSize = 1.5
): void {
  // 近似计算弧长
  const d1 = distanceBetween(m1.x, m1.y, pCtrl.x, pCtrl.y);
  const d2 = distanceBetween(pCtrl.x, pCtrl.y, m2.x, m2.y);
  const chord = distanceBetween(m1.x, m1.y, m2.x, m2.y);
  const approxLength = (d1 + d2 + chord) / 2;

  const steps = Math.max(1, Math.ceil(approxLength / stepSize));

  for (let j = 0; j <= steps; j++) {
    const tau = j / steps;
    const inv = 1 - tau;

    // 二次贝塞尔曲线公式：B(τ) = (1 - τ)^2 * M1 + 2 * (1 - τ) * τ * P_ctrl + τ^2 * M2
    const bx = inv * inv * m1.x + 2 * inv * tau * pCtrl.x + tau * tau * m2.x;
    const by = inv * inv * m1.y + 2 * inv * tau * pCtrl.y + tau * tau * m2.y;

    const r = inv * r1 + tau * r2;
    const alpha = inv * a1 + tau * a2;

    renderInkStamp(ctx, bx, by, r, alpha, inkColor);
  }
}

/**
 * 将整根归一化笔画无损缩放重绘到指定尺寸的 Canvas 上
 *
 * @param ctx 目标画布 2D 上下文
 * @param stroke 归一化矢量笔画对象
 * @param targetWidth 绘制目标区域像素宽
 * @param targetHeight 绘制目标区域像素高
 * @param inkColor 墨色 Hex 或 RGB（如松烟墨 '#1C1B19'）
 * @param stepSize 插值步长（像素，默认 1.5px）
 */
export function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: BrushStroke,
  targetWidth: number,
  targetHeight: number,
  inkColor = '#1C1B19',
  stepSize = 1.5
): void {
  const points = stroke.points;
  if (!points || points.length === 0) {
    return;
  }

  const minDim = Math.min(targetWidth, targetHeight);

  // 反归一化为目标像素坐标
  const denormPoints = points.map((p) => ({
    x: p.x * targetWidth,
    y: p.y * targetHeight,
    r: Math.max(0.6, p.r * minDim),
    alpha: p.alpha,
  }));

  // 情况 1：单点轻触（顿笔墨滴）
  if (denormPoints.length === 1) {
    const p = denormPoints[0];
    renderInkStamp(ctx, p.x, p.y, p.r, p.alpha, inkColor);
    return;
  }

  // 情况 2：两点极短线段（线性插值密集印章）
  if (denormPoints.length === 2) {
    const p0 = denormPoints[0];
    const p1 = denormPoints[1];
    const dist = distanceBetween(p0.x, p0.y, p1.x, p1.y);
    const steps = Math.max(1, Math.ceil(dist / stepSize));

    for (let i = 0; i <= steps; i++) {
      const tau = i / steps;
      const x = p0.x + (p1.x - p0.x) * tau;
      const y = p0.y + (p1.y - p0.y) * tau;
      const r = p0.r + (p1.r - p0.r) * tau;
      const alpha = p0.alpha + (p1.alpha - p0.alpha) * tau;
      renderInkStamp(ctx, x, y, r, alpha, inkColor);
    }
    return;
  }

  // 情况 3：三个及以上点，使用二次贝塞尔中点连续平滑插值
  // 先绘制起点到第一个中点
  const p0 = denormPoints[0];
  const p1 = denormPoints[1];
  const firstMid = {
    x: (p0.x + p1.x) / 2,
    y: (p0.y + p1.y) / 2,
    r: (p0.r + p1.r) / 2,
    alpha: (p0.alpha + p1.alpha) / 2,
  };

  const initDist = distanceBetween(p0.x, p0.y, firstMid.x, firstMid.y);
  const initSteps = Math.max(1, Math.ceil(initDist / stepSize));
  for (let j = 0; j <= initSteps; j++) {
    const t = j / initSteps;
    renderInkStamp(
      ctx,
      p0.x + (firstMid.x - p0.x) * t,
      p0.y + (firstMid.y - p0.y) * t,
      p0.r + (firstMid.r - p0.r) * t,
      p0.alpha + (firstMid.alpha - p0.alpha) * t,
      inkColor
    );
  }

  // 循环中点贝塞尔过渡
  for (let i = 1; i < denormPoints.length - 1; i++) {
    const ptPrev = denormPoints[i - 1];
    const ptCurr = denormPoints[i];
    const ptNext = denormPoints[i + 1];

    const m1 = {
      x: (ptPrev.x + ptCurr.x) / 2,
      y: (ptPrev.y + ptCurr.y) / 2,
      r: (ptPrev.r + ptCurr.r) / 2,
      alpha: (ptPrev.alpha + ptCurr.alpha) / 2,
    };

    const m2 = {
      x: (ptCurr.x + ptNext.x) / 2,
      y: (ptCurr.y + ptNext.y) / 2,
      r: (ptCurr.r + ptNext.r) / 2,
      alpha: (ptCurr.alpha + ptNext.alpha) / 2,
    };

    renderBezierSegment(
      ctx,
      m1,
      ptCurr,
      m2,
      m1.r,
      m2.r,
      m1.alpha,
      m2.alpha,
      inkColor,
      stepSize
    );
  }

  // 最后中点到终点
  const lastIdx = denormPoints.length - 1;
  const pPenultimate = denormPoints[lastIdx - 1];
  const pLast = denormPoints[lastIdx];
  const lastMid = {
    x: (pPenultimate.x + pLast.x) / 2,
    y: (pPenultimate.y + pLast.y) / 2,
    r: (pPenultimate.r + pLast.r) / 2,
    alpha: (pPenultimate.alpha + pLast.alpha) / 2,
  };

  const endDist = distanceBetween(lastMid.x, lastMid.y, pLast.x, pLast.y);
  const endSteps = Math.max(1, Math.ceil(endDist / stepSize));
  for (let j = 0; j <= endSteps; j++) {
    const t = j / endSteps;
    renderInkStamp(
      ctx,
      lastMid.x + (pLast.x - lastMid.x) * t,
      lastMid.y + (pLast.y - lastMid.y) * t,
      lastMid.r + (pLast.r - lastMid.r) * t,
      lastMid.alpha + (pLast.alpha - lastMid.alpha) * t,
      inkColor
    );
  }
}

/**
 * 批量渲染多根笔画（用于字格或整幅长卷批量无损重绘）
 */
export function renderMultipleStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: BrushStroke[],
  targetWidth: number,
  targetHeight: number,
  inkColorOrType: string | InkType = 'black',
  stepSize = 1.5
): void {
  const inkColor =
    INK_COLORS[inkColorOrType as InkType] || (inkColorOrType as string) || '#1C1B19';

  strokes.forEach((stroke) => {
    renderStrokeToCanvas(ctx, stroke, targetWidth, targetHeight, inkColor, stepSize);
  });
}
