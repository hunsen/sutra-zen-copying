// ============================================================================
// 「静心抄经」高清装裱长卷导出与笔迹倍速回放引擎
// src/engine/ScrollExporter.ts
// 1. 在离屏 Canvas 中拼接纸张纹理、经题签条、乌丝栏、全部手写矢量笔迹、回向文与朱砂篆刻印章
// 2. 超清 2x/3x 印刷级装裱长卷 PNG 一键导出与下载
// 3. 笔迹倍速回放调度器 (TimeLapseReplayer)：基于时间戳 t 以 5x/10x/20x 动态动态重戏剧再现书写过程
// ============================================================================

import {
  SutraDocument,
  WrittenCharRecord,
  PaperTheme,
  InkType,
  SealConfig,
  BrushStroke,
  INK_COLORS,
  PAPER_THEMES,
} from '../types/sutra';
import { renderMultipleStrokes } from './FingerBrushEngine';
import { drawPaperBackground } from './PaperTextureGen';

export interface ScrollExportOptions {
  sutra: SutraDocument;
  writtenChars: Record<number, WrittenCharRecord>;
  paperTheme?: PaperTheme;
  inkType?: InkType;
  dedicationText?: string;
  sealConfig?: SealConfig;
  charsPerColumn?: number;
  scale?: number; // 缩放倍率，默认 2.0 (高清 Retina / 印刷级输出)
}

const BASE_CELL_SIZE = 80;
const BASE_CELL_PADDING = 5;
const BASE_HEADER_WIDTH = 140;
const BASE_TAIL_WIDTH = 160;
const BASE_MARGIN_RIGHT = 60;
const BASE_MARGIN_LEFT = 80;
const BASE_MARGIN_TOP = 50;
const BASE_MARGIN_BOTTOM = 50;

/**
 * 绘制传统朱文（阳刻白底红字）或白文（阴刻红底白字）篆刻方印
 */
export function drawSealOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  config: SealConfig
): void {
  ctx.save();

  const isBaiWen = config.style === 'bai'; // 白文：红底白字；朱文：白/纸底红字
  const sealRed = '#A61C1C';
  const sealDarkRed = '#7D1010';

  if (isBaiWen) {
    // 白文：朱砂红底
    ctx.fillStyle = sealRed;
    ctx.fillRect(x, y, size, size);

    // 斑驳残边 (模拟金石刀刻残损感)
    ctx.strokeStyle = sealDarkRed;
    ctx.lineWidth = 2.0;
    ctx.strokeRect(x, y, size, size);

    ctx.fillStyle = '#FFF8F0'; // 宣纸色字体
  } else {
    // 朱文：纸底红框红字
    ctx.strokeStyle = sealRed;
    ctx.lineWidth = 3.0;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);

    ctx.fillStyle = sealRed;
  }

  // 印章文字排版（支持 2~4 字）
  const textChars = config.text.trim().slice(0, 4).split('');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (textChars.length === 2) {
    ctx.font = `normal bold ${Math.floor(size * 0.42)}px "Kaiti SC", "STKaiti", "KaiTi", serif`;
    ctx.fillText(textChars[0], x + size / 2, y + size * 0.3);
    ctx.fillText(textChars[1], x + size / 2, y + size * 0.72);
  } else if (textChars.length >= 3) {
    // 四字田字格传统回文或自右向左排列
    ctx.font = `normal bold ${Math.floor(size * 0.36)}px "Kaiti SC", "STKaiti", "KaiTi", serif`;
    const colRight = x + size * 0.72;
    const colLeft = x + size * 0.28;
    const rowTop = y + size * 0.3;
    const rowBottom = y + size * 0.72;

    ctx.fillText(textChars[0], colRight, rowTop);
    ctx.fillText(textChars[1], colRight, rowBottom);
    ctx.fillText(textChars[2], colLeft, rowTop);
    ctx.fillText(textChars[3] || '印', colLeft, rowBottom);
  }

  ctx.restore();
}

/**
 * 在离屏 Canvas 中完整生成整卷经文高清长图画布
 */
export function renderFullScrollToCanvas(
  options: ScrollExportOptions
): HTMLCanvasElement {
  const {
    sutra,
    writtenChars,
    paperTheme = 'xuan',
    inkType = 'black',
    dedicationText = '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
    sealConfig = { text: '静心', style: 'bai', shape: 'square', roughness: 0.2 },
    charsPerColumn = 8,
    scale = 2.0,
  } = options;

  const totalChars = sutra.content.length;
  const numColumns = Math.max(1, Math.ceil(totalChars / charsPerColumn));

  const scrollWidth =
    BASE_MARGIN_RIGHT +
    BASE_HEADER_WIDTH +
    numColumns * BASE_CELL_SIZE +
    BASE_TAIL_WIDTH +
    BASE_MARGIN_LEFT;
  const scrollHeight =
    BASE_MARGIN_TOP + charsPerColumn * BASE_CELL_SIZE + BASE_MARGIN_BOTTOM;

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(scrollWidth * scale);
  canvas.height = Math.floor(scrollHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 2D 导出上下文');
  }

  ctx.scale(scale, scale);

  const themeConfig = PAPER_THEMES[paperTheme] || PAPER_THEMES.xuan;
  const inkHex = INK_COLORS[inkType] || '#1C1B19';
  const gridColor = themeConfig.gridColor || '#C8B69E';

  // 1. 全幅铺设宣纸纹理底色
  drawPaperBackground(ctx, paperTheme, scrollWidth, scrollHeight);

  // 2. 卷轴装裱上下绫边线条
  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 2.0;

  // 上天头
  ctx.beginPath();
  ctx.moveTo(BASE_MARGIN_LEFT, BASE_MARGIN_TOP);
  ctx.lineTo(scrollWidth - BASE_MARGIN_RIGHT, BASE_MARGIN_TOP);
  ctx.stroke();

  // 下地头
  ctx.beginPath();
  ctx.moveTo(BASE_MARGIN_LEFT, scrollHeight - BASE_MARGIN_BOTTOM);
  ctx.lineTo(scrollWidth - BASE_MARGIN_RIGHT, scrollHeight - BASE_MARGIN_BOTTOM);
  ctx.stroke();
  ctx.restore();

  // 3. 卷首题签（最右侧）
  const headerX = scrollWidth - BASE_MARGIN_RIGHT - BASE_HEADER_WIDTH;
  const headerY = BASE_MARGIN_TOP + 12;
  const headerH = charsPerColumn * BASE_CELL_SIZE - 24;

  ctx.save();
  // 经名双边框
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(headerX + 16, headerY, BASE_HEADER_WIDTH - 32, headerH);
  ctx.lineWidth = 1.0;
  ctx.strokeRect(headerX + 21, headerY + 5, BASE_HEADER_WIDTH - 42, headerH - 10);

  // 经题
  ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'normal bold 24px "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif';

  // 经题在右列，译者在左列（符合传统右起阅读顺序）
  const titleChars = sutra.title.split('');
  const titleStep = Math.min(34, (headerH - 100) / (titleChars.length || 1));
  const titleStartX = headerX + BASE_HEADER_WIDTH / 2 + 14;
  const titleStartY = headerY + 48;
  titleChars.forEach((c, idx) => {
    ctx.fillText(c, titleStartX, titleStartY + idx * titleStep);
  });

  // 译者题注（居左）
  ctx.font = 'normal normal 14px "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif';
  ctx.globalAlpha = 0.8;
  const authorChars = sutra.authorOrTranslator.split('');
  const authorStartX = headerX + BASE_HEADER_WIDTH / 2 - 18;
  const authorStartY = headerY + 70;
  authorChars.forEach((c, idx) => {
    ctx.fillText(c, authorStartX, authorStartY + idx * 20);
  });
  ctx.restore();

  // 4. 正文列（从右至左逐列绘制乌丝栏与手写笔迹）
  const columnsStartX = scrollWidth - BASE_MARGIN_RIGHT - BASE_HEADER_WIDTH;

  for (let c = 0; c < numColumns; c++) {
    const colX = columnsStartX - (c + 1) * BASE_CELL_SIZE;

    // 绘制纵列分割线
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(colX, BASE_MARGIN_TOP);
    ctx.lineTo(colX, BASE_MARGIN_TOP + charsPerColumn * BASE_CELL_SIZE);
    ctx.stroke();
    ctx.restore();

    for (let r = 0; r < charsPerColumn; r++) {
      const charIdx = c * charsPerColumn + r;
      if (charIdx >= totalChars) break;

      const cellX = colX;
      const cellY = BASE_MARGIN_TOP + r * BASE_CELL_SIZE;
      const record = writtenChars[charIdx];

      // 格底微细横线
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([2, 4]);
      ctx.strokeRect(
        cellX + BASE_CELL_PADDING,
        cellY + BASE_CELL_PADDING,
        BASE_CELL_SIZE - BASE_CELL_PADDING * 2,
        BASE_CELL_SIZE - BASE_CELL_PADDING * 2
      );
      ctx.restore();

      // 笔墨渲染
      if (record && record.strokes && record.strokes.length > 0) {
        ctx.save();
        ctx.translate(cellX + BASE_CELL_PADDING, cellY + BASE_CELL_PADDING);
        const innerSize = BASE_CELL_SIZE - BASE_CELL_PADDING * 2;
        renderMultipleStrokes(ctx, record.strokes, innerSize, innerSize, inkHex);
        ctx.restore();
      } else {
        // 未完成字：微弱楷体留白底印
        ctx.save();
        ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
        ctx.globalAlpha = 0.16;
        ctx.font = 'normal normal 40px "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          sutra.content[charIdx],
          cellX + BASE_CELL_SIZE / 2,
          cellY + BASE_CELL_SIZE / 2 + 2
        );
        ctx.restore();
      }
    }
  }

  // 5. 卷尾回向文与朱砂印章（最左侧）
  const tailStartX = columnsStartX - numColumns * BASE_CELL_SIZE - BASE_TAIL_WIDTH;
  const tailY = BASE_MARGIN_TOP + 12;
  const tailH = charsPerColumn * BASE_CELL_SIZE - 24;

  ctx.save();
  ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
  ctx.font = 'normal normal 14px "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const dChars = dedicationText.split('');
  const halfD = Math.ceil(dChars.length / 2);
  const col1 = dChars.slice(0, halfD);
  const col2 = dChars.slice(halfD);

  const col1X = tailStartX + BASE_TAIL_WIDTH - 40;
  const col2X = col1X - 24;
  const stepD = 20;

  col1.forEach((ch, i) => ctx.fillText(ch, col1X, tailY + 24 + i * stepD));
  col2.forEach((ch, i) => ctx.fillText(ch, col2X, tailY + 24 + i * stepD));

  // 绘制朱砂篆刻印章
  const sealSize = 48;
  const sealX = tailStartX + 24;
  const sealY = tailY + tailH - sealSize - 20;
  drawSealOnCanvas(ctx, sealX, sealY, sealSize, sealConfig);

  ctx.restore();

  return canvas;
}

/**
 * 触发长卷 PNG 图片下载
 */
export function downloadScrollImage(
  options: ScrollExportOptions,
  fileName?: string
): void {
  const canvas = renderFullScrollToCanvas(options);
  const defaultName = `${options.sutra.title}_装裱长卷_${new Date().toISOString().slice(0, 10)}.png`;

  if (typeof canvas.toBlob === 'function') {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName || defaultName;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/png');
  } else {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = fileName || defaultName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ============================================================================
// 笔迹倍速回放调度器 (TimeLapseReplayer)
// ============================================================================

export interface ReplayFrameState {
  charIndex: number;
  character: string;
  strokesSoFar: BrushStroke[];
  currentStrokePartial?: BrushStroke;
  progress: number; // 0.0 ~ 1.0
  isFinished: boolean;
}

/**
 * 笔迹时间流事件单元
 */
interface FlatReplayItem {
  charIndex: number;
  character: string;
  strokeIndex: number;
  pointIndex: number;
  globalTimeMs: number;
  point: { x: number; y: number; r: number; alpha: number; t: number };
}

/**
 * 笔迹倍速回放引擎
 */
export class TimeLapseReplayer {
  private items: FlatReplayItem[] = [];
  private totalDurationMs = 0;
  private currentTimeMs = 0;
  private speed = 10; // 默认 10x 倍速
  private isPlaying = false;
  private animFrameId: number | null = null;
  private lastTimestamp = 0;
  private onUpdateCallback?: (state: ReplayFrameState) => void;

  constructor(
    content: string[],
    writtenChars: Record<number, WrittenCharRecord>,
    speed = 10
  ) {
    this.speed = speed;
    this.flattenStrokes(content, writtenChars);
  }

  /**
   * 将所有字的离散笔画按时间戳展平为全局连续时间流
   */
  private flattenStrokes(
    content: string[],
    writtenChars: Record<number, WrittenCharRecord>
  ): void {
    let accumulatedTime = 0;
    this.items = [];

    // 按字符顺序重构书写流水
    for (let c = 0; c < content.length; c++) {
      const record = writtenChars[c];
      if (!record || !record.strokes || record.strokes.length === 0) {
        continue;
      }

      record.strokes.forEach((stroke, sIdx) => {
        stroke.points.forEach((p, pIdx) => {
          this.items.push({
            charIndex: c,
            character: record.character,
            strokeIndex: sIdx,
            pointIndex: pIdx,
            globalTimeMs: accumulatedTime + p.t,
            point: { ...p },
          });
        });

        // 笔画间自然运笔停顿 120ms
        const lastP = stroke.points[stroke.points.length - 1];
        accumulatedTime += (lastP?.t || 200) + 120;
      });

      // 字与字之间思考停顿 280ms
      accumulatedTime += 280;
    }

    this.totalDurationMs = Math.max(1000, accumulatedTime);
  }

  /**
   * 启动或恢复倍速回放
   */
  public play(onUpdate: (state: ReplayFrameState) => void): void {
    this.onUpdateCallback = onUpdate;
    this.isPlaying = true;
    this.lastTimestamp = performance.now();

    const loop = (now: number) => {
      if (!this.isPlaying) return;

      const delta = now - this.lastTimestamp;
      this.lastTimestamp = now;

      // 叠加倍速推进
      this.currentTimeMs += delta * this.speed;

      if (this.currentTimeMs >= this.totalDurationMs) {
        this.currentTimeMs = this.totalDurationMs;
        this.emitState(true);
        this.pause();
        return;
      }

      this.emitState(false);
      this.animFrameId = window.requestAnimationFrame(loop);
    };

    this.animFrameId = window.requestAnimationFrame(loop);
  }

  /**
   * 暂停回放
   */
  public pause(): void {
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      window.cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * 重置回放至起点
   */
  public restart(): void {
    this.currentTimeMs = 0;
    this.emitState(false);
  }

  /**
   * 进度拖拽跳转 (0.0 ~ 1.0)
   */
  public seek(progress: number): void {
    this.currentTimeMs = Math.max(
      0,
      Math.min(1.0, progress) * this.totalDurationMs
    );
    this.emitState(this.currentTimeMs >= this.totalDurationMs);
  }

  /**
   * 设置回放倍速 (如 5x, 10x, 20x)
   */
  public setSpeed(speed: number): void {
    this.speed = Math.max(1, speed);
  }

  public getSpeed(): number {
    return this.speed;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 组装当前时刻的笔迹渲染快照
   */
  private emitState(isFinished: boolean): void {
    if (!this.onUpdateCallback) return;

    const visibleItems = this.items.filter(
      (item) => item.globalTimeMs <= this.currentTimeMs
    );

    if (visibleItems.length === 0) {
      this.onUpdateCallback({
        charIndex: 0,
        character: '',
        strokesSoFar: [],
        progress: 0,
        isFinished,
      });
      return;
    }

    const lastItem = visibleItems[visibleItems.length - 1];

    // 重构当前字的已有完整笔画与当前正在画的半截笔画
    const currentCharItems = visibleItems.filter(
      (it) => it.charIndex === lastItem.charIndex
    );
    const strokesMap = new Map<number, BrushStroke>();

    currentCharItems.forEach((it) => {
      if (!strokesMap.has(it.strokeIndex)) {
        strokesMap.set(it.strokeIndex, { points: [] });
      }
      strokesMap.get(it.strokeIndex)!.points.push(it.point);
    });

    const strokesArray = Array.from(strokesMap.values());
    const progress = Math.min(1.0, this.currentTimeMs / this.totalDurationMs);

    this.onUpdateCallback({
      charIndex: lastItem.charIndex,
      character: lastItem.character,
      strokesSoFar: strokesArray,
      progress,
      isFinished,
    });
  }

  /**
   * 销毁与资源释放
   */
  public dispose(): void {
    this.pause();
    this.items = [];
    this.onUpdateCallback = undefined;
  }
}
