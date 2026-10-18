// ============================================================================
// 「静心抄经」竖排从右至左全景长卷渲染器
// src/components/SutraScrollCanvas.tsx
// 1. 传统中国古籍竖排从右至左（智能自适应：手机窄屏大字横卷 2~3 行，大屏全景 8 行）
// 2. 卷首右侧双边框经名签条 + 卷尾回向文与朱砂篆刻印章
// 3. 已抄写字格调用 FingerBrushEngine 矢量重绘；当前字格柔和金色呼吸框高亮 + 实时镜像渲染
// 4. 手势平滑左右拖拽浏览长卷 + 点击任意字格跳转重写 + 走纸自动居中平滑追踪
// 5. 显存与像素完美适配：物理 Canvas 按视口精确分配，杜绝 iOS WebKit 超大纹理溢出崩溃
// ============================================================================

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import {
  WrittenCharRecord,
  BrushStroke,
  PaperTheme,
  InkType,
  INK_COLORS,
  PAPER_THEMES,
} from '../types/sutra';
import { renderMultipleStrokes } from '../engine/FingerBrushEngine';
import { drawPaperBackground } from '../engine/PaperTextureGen';
import { drawSealOnCanvas } from '../engine/ScrollExporter';
import { toTraditional } from '../data/builtInSutras';

const KAI_TI_FONT_STACK =
  '"ZenKai", "Kaiti TC", "BiauKai", "DFKai-SB", "TW-MOE-Std-Kai", "Kaiti SC", "STKaiti", "KaiTi", serif';

export interface SutraScrollCanvasProps {
  /** 经文全部单字数组 */
  content: string[];
  /** 经文标题，如 "般若波罗蜜多心经" */
  title: string;
  /** 译者或作者，如 "唐·玄奘法师 译" */
  authorOrTranslator: string;
  /** 已抄写的汉字记录字典 (key 为 charIndex) */
  writtenChars: Record<number, WrittenCharRecord>;
  /** 当前正在书写的字序号 (0 ~ N - 1) */
  currentIndex: number;
  /** 正在右侧放大书写台中实时书写的笔画（用于实时镜像渲染） */
  liveStrokes?: BrushStroke[];
  /** 纸张主题 */
  paperTheme?: PaperTheme;
  /** 墨色类型 */
  inkType?: InkType;
  /** 回向文 */
  dedicationText?: string;
  /** 闲章/姓名章文字 */
  sealText?: string;
  /** 点击字格跳转回调 */
  onSelectChar?: (charIndex: number) => void;
  /** 每列字数（默认自适应） */
  charsPerColumn?: number;
}

const CELL_SIZE = 76; // 每个字格设计基准尺寸 (px)
const CELL_PADDING = 4; // 字格内边距

export const SutraScrollCanvas: React.FC<SutraScrollCanvasProps> = ({
  content,
  title,
  authorOrTranslator,
  writtenChars,
  currentIndex,
  liveStrokes = [],
  paperTheme = 'xuan',
  inkType = 'black',
  dedicationText = '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
  sealText = '静心',
  onSelectChar,
  charsPerColumn,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 视口与拖拽滚动状态
  const [viewportWidth, setViewportWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(300);
  const [scrollX, setScrollX] = useState(0); // 视口水平偏移量（从右向左为正向）
  const scrollXRef = useRef(0);
  scrollXRef.current = scrollX;

  // 用户手动选择的排版模式：'auto'（自动感知高度）| 'large'（大字横卷 2~4 行）| 'classic'（经典全景 8 行）
  const [layoutMode, setLayoutMode] = useState<'auto' | 'large' | 'classic'>('auto');
  // 用户自选缩放乘数 (0.7x ~ 2.0x)
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1.0);

  // 计算当前有效每列行数
  const effectiveCharsPerColumn = useMemo(() => {
    if (charsPerColumn && charsPerColumn !== 8) {
      return charsPerColumn;
    }
    if (layoutMode === 'large') {
      if (containerHeight < 175) return 2;
      if (containerHeight < 360) return 3;
      return 4; // 宽屏大字模式：4 行超大书法临摹字格
    }
    if (layoutMode === 'classic') {
      return 8;
    }
    // 'auto' 模式
    if (containerHeight < 175) {
      return 2; // 极窄屏幕胶囊横卷：双行大字
    }
    if (containerHeight < 280) {
      return 3; // 手机竖屏预览栏：三行大字，单字高度清晰饱满
    }
    return 8; // 平板、桌面或全屏展开模式：经典经折装八行
  }, [charsPerColumn, containerHeight, layoutMode]);

  // 边距与标头尺寸根据行数动态微调
  const isCompactMode = effectiveCharsPerColumn <= 4;
  const MARGIN_TOP = isCompactMode ? 18 : 40;
  const MARGIN_BOTTOM = isCompactMode ? 18 : 40;
  const MARGIN_RIGHT = isCompactMode ? 30 : 45;
  const MARGIN_LEFT = isCompactMode ? 40 : 60;
  const HEADER_WIDTH = isCompactMode ? (effectiveCharsPerColumn <= 2 ? 96 : 115) : 130;
  const TAIL_WIDTH = isCompactMode ? (effectiveCharsPerColumn <= 2 ? 110 : 130) : 140;

  // 几何计算
  const totalChars = content.length;
  const numColumns = Math.max(1, Math.ceil(totalChars / effectiveCharsPerColumn));
  const scrollTotalHeight = MARGIN_TOP + effectiveCharsPerColumn * CELL_SIZE + MARGIN_BOTTOM;
  const scrollTotalWidth =
    MARGIN_RIGHT +
    HEADER_WIDTH +
    numColumns * CELL_SIZE +
    TAIL_WIDTH +
    MARGIN_LEFT;

  // 自适应纵向缩放比例：宽屏下突破固定高度限制，撑满可用容器高度，并叠加缩放乘数
  const baseAvailableHeight = Math.max(90, containerHeight - 16);
  const baseDisplayHeight = Math.min(scrollTotalHeight * 1.65, baseAvailableHeight);
  const baseScale = baseDisplayHeight / scrollTotalHeight;
  const displayScale = baseScale * zoomMultiplier;

  const displayHeight = Math.round(scrollTotalHeight * displayScale);
  const displayWidth = Math.round(scrollTotalWidth * displayScale);

  // 拖拽手势交互
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const themeConfig = PAPER_THEMES[paperTheme] || PAPER_THEMES.xuan;
  const inkHex = INK_COLORS[inkType] || '#1C1B19';

  // 监听容器尺寸调整
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewportWidth(containerRef.current.clientWidth);
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  /**
   * 将当前字居中平滑滚入视野黄金位置
   */
  const scrollToCharIndex = useCallback(
    (index: number, smooth = true) => {
      if (index < 0 || index >= totalChars) return;

      const colIndex = Math.floor(index / effectiveCharsPerColumn);
      // 古籍从右向左：第 0 列在最右边（经比例缩放）
      const colRightOffset = (MARGIN_RIGHT + HEADER_WIDTH + (colIndex + 0.5) * CELL_SIZE) * displayScale;
      // 卷轴绝对 X 坐标（从左向右坐标系中）
      const charCenterX = displayWidth - colRightOffset;

      // 目标视口左上角 X：将该字居中偏左（视野黄金分割区）
      const maxScroll = Math.max(0, displayWidth - viewportWidth);
      const targetScrollX = Math.max(
        0,
        Math.min(
          maxScroll,
          charCenterX - viewportWidth * 0.45
        )
      );

      if (smooth && containerRef.current) {
        containerRef.current.scrollTo({
          left: targetScrollX,
          behavior: 'smooth',
        });
      } else if (containerRef.current) {
        containerRef.current.scrollLeft = targetScrollX;
      }
      setScrollX(targetScrollX);
    },
    [
      HEADER_WIDTH,
      MARGIN_RIGHT,
      displayScale,
      displayWidth,
      effectiveCharsPerColumn,
      totalChars,
      viewportWidth,
    ]
  );

  // 初始化时：滚动到卷首最右侧（经名签条与首列字）
  useEffect(() => {
    if (containerRef.current) {
      const initialScroll = Math.max(0, displayWidth - viewportWidth);
      containerRef.current.scrollLeft = initialScroll;
      setScrollX(initialScroll);
    }
  }, [displayWidth, viewportWidth]);

  // 当当前书写字进位时，平滑自动追踪
  useEffect(() => {
    scrollToCharIndex(currentIndex, true);
  }, [currentIndex, scrollToCharIndex]);

  /**
   * 核心画卷渲染函数
   */
  const renderScroll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 限制 DPR 最大为 2，避免手机 3x 高分屏创建超大离屏纹理产生性能开销与显存溢出
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 核心显存保护机制：物理 Canvas 尺寸严格等于实际显示的 displayWidth * dpr，
    // 彻底根除移动端 WebKit 4096px / 8192px 纹理截断白屏缺陷！
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    // 统一将设计基准坐标系缩放至实际画布像素尺寸
    ctx.scale(dpr * displayScale, dpr * displayScale);

    // 1. 铺设完整的古法纸张背景纹理
    drawPaperBackground(ctx, paperTheme, scrollTotalWidth, scrollTotalHeight);

    // 2. 卷轴装裱上下绫边（细微暗金/宣纸双线边栏）
    const gridColor = themeConfig.gridColor || '#C8B69E';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.5;

    // 上栏线（天头界线）
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, MARGIN_TOP);
    ctx.lineTo(scrollTotalWidth - MARGIN_RIGHT, MARGIN_TOP);
    ctx.stroke();

    // 下栏线（地头界线）
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, scrollTotalHeight - MARGIN_BOTTOM);
    ctx.lineTo(scrollTotalWidth - MARGIN_RIGHT, scrollTotalHeight - MARGIN_BOTTOM);
    ctx.stroke();

    // 3. 卷首（最右端）：经名双边框竖排签条
    const headerX = scrollTotalWidth - MARGIN_RIGHT - HEADER_WIDTH;
    const headerY = MARGIN_TOP + (isCompactMode ? 6 : 12);
    const headerH = effectiveCharsPerColumn * CELL_SIZE - (isCompactMode ? 12 : 24);

    ctx.save();
    // 签条外框
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 2.0;
    ctx.strokeRect(headerX + 10, headerY, HEADER_WIDTH - 20, headerH);
    // 签条内细框
    ctx.lineWidth = 0.8;
    ctx.strokeRect(headerX + 14, headerY + 3, HEADER_WIDTH - 28, headerH - 6);

    ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titleChars = toTraditional(title).split('');

    if (isCompactMode) {
      // 紧凑横卷模式：经名双列优雅排版
      ctx.font = `normal bold 16px ${KAI_TI_FONT_STACK}`;
      const halfTitle = Math.ceil(titleChars.length / 2);
      const titleCol1 = titleChars.slice(0, halfTitle);
      const titleCol2 = titleChars.slice(halfTitle);

      const col1X = headerX + HEADER_WIDTH / 2 + 15;
      const col2X = headerX + HEADER_WIDTH / 2 - 10;
      const step = Math.min(22, (headerH - 24) / (titleCol1.length || 1));
      const startY = headerY + 16;

      titleCol1.forEach((ch, idx) => {
        ctx.fillText(ch, col1X, startY + idx * step);
      });
      titleCol2.forEach((ch, idx) => {
        ctx.fillText(ch, col2X, startY + idx * step);
      });
    } else {
      // 经典多行模式：单列经名 + 译者题跋
      ctx.font = `normal bold 22px ${KAI_TI_FONT_STACK}`;
      const titleCenterX = headerX + HEADER_WIDTH / 2 + 12;
      const titleCharStep = Math.min(32, (headerH - 90) / (titleChars.length || 1));
      const titleStartY = headerY + 45;

      titleChars.forEach((ch, idx) => {
        ctx.fillText(ch, titleCenterX, titleStartY + idx * titleCharStep);
      });

      // 绘制译者/题跋（稍小号竖排，居左）
      ctx.font = `normal normal 13px ${KAI_TI_FONT_STACK}`;
      ctx.globalAlpha = 0.75;
      const authorCenterX = headerX + HEADER_WIDTH / 2 - 16;
      const authorChars = toTraditional(authorOrTranslator).split('');
      const authorCharStep = 18;
      const authorStartY = headerY + 65;
      authorChars.forEach((ch, idx) => {
        ctx.fillText(ch, authorCenterX, authorStartY + idx * authorCharStep);
      });
    }
    ctx.restore();

    // 4. 经文主体：从右向左逐列乌丝栏
    const columnsStartX = scrollTotalWidth - MARGIN_RIGHT - HEADER_WIDTH;

    for (let c = 0; c < numColumns; c++) {
      // 当前列 X 坐标（从右向左递减）
      const colX = columnsStartX - (c + 1) * CELL_SIZE;

      // 绘制纵向列分割线（乌丝栏）
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(colX, MARGIN_TOP);
      ctx.lineTo(colX, MARGIN_TOP + effectiveCharsPerColumn * CELL_SIZE);
      ctx.stroke();

      for (let r = 0; r < effectiveCharsPerColumn; r++) {
        const charIdx = c * effectiveCharsPerColumn + r;
        if (charIdx >= totalChars) break;

        const cellX = colX;
        const cellY = MARGIN_TOP + r * CELL_SIZE;
        const ch = content[charIdx];
        const isCurrent = charIdx === currentIndex;
        const record = writtenChars[charIdx];

        // 绘制微细字格横虚线底纹
        ctx.save();
        ctx.strokeStyle = gridColor;
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([2, 4]);
        ctx.strokeRect(
          cellX + CELL_PADDING,
          cellY + CELL_PADDING,
          CELL_SIZE - CELL_PADDING * 2,
          CELL_SIZE - CELL_PADDING * 2
        );
        ctx.restore();

        // 笔墨与底字渲染：当前字优先展示书写台实时笔画镜像
        const strokesToDraw = isCurrent && liveStrokes.length > 0 ? liveStrokes : record?.strokes;
        if (strokesToDraw && strokesToDraw.length > 0) {
          ctx.save();
          ctx.translate(cellX + CELL_PADDING, cellY + CELL_PADDING);
          const innerSize = CELL_SIZE - CELL_PADDING * 2;
          renderMultipleStrokes(ctx, strokesToDraw, innerSize, innerSize, inkHex);
          ctx.restore();
        } else {
          // 未抄写字格：半透明小楷名家底稿字模（正体繁体）
          ctx.save();
          const charFontSize = Math.floor(CELL_SIZE * 0.66);
          ctx.font = `normal normal ${charFontSize}px ${KAI_TI_FONT_STACK}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (isCurrent) {
            ctx.fillStyle = '#C8963E';
            ctx.globalAlpha = 0.85; // 当前活动字高亮
          } else {
            ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
            ctx.globalAlpha = 0.35; // 底帖字模清晰可见，久看不累
          }
          ctx.fillText(
            toTraditional(ch),
            cellX + CELL_SIZE / 2,
            cellY + CELL_SIZE / 2 + 2
          );
          ctx.restore();
        }
      }
    }

    // 5. 卷尾（最左侧）：回向文与朱砂篆刻印章
    const tailStartX = columnsStartX - numColumns * CELL_SIZE - TAIL_WIDTH;
    const tailY = MARGIN_TOP + (isCompactMode ? 6 : 12);
    const tailH = effectiveCharsPerColumn * CELL_SIZE - (isCompactMode ? 12 : 24);

    ctx.save();
    ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cleanDedication = toTraditional(dedicationText).replace(/[，。]/g, '');
    const dedicationChars = cleanDedication.split('');

    if (isCompactMode) {
      // 紧凑横卷模式：回向文多列紧凑小楷 + 闲章
      ctx.font = `normal normal 12px ${KAI_TI_FONT_STACK}`;
      ctx.globalAlpha = 0.85;

      const charsPerCol = effectiveCharsPerColumn === 2 ? 4 : 5;
      const colsCount = Math.ceil(dedicationChars.length / charsPerCol);
      const stepY = Math.min(18, (tailH - 10) / charsPerCol);
      const startX = tailStartX + TAIL_WIDTH - 22;

      for (let ci = 0; ci < colsCount; ci++) {
        const cx = startX - ci * 18;
        const slice = dedicationChars.slice(ci * charsPerCol, (ci + 1) * charsPerCol);
        slice.forEach((c, idx) => {
          ctx.fillText(c, cx, tailY + 12 + idx * stepY);
        });
      }

      // 印章放置在最左侧
      const sealSize = effectiveCharsPerColumn === 2 ? 30 : 36;
      const sealX = tailStartX + 8;
      const sealY = tailY + (tailH - sealSize) / 2;
      drawSealOnCanvas(ctx, sealX, sealY, sealSize, {
        text: toTraditional(sealText || '靜心'),
        style: 'bai',
        shape: 'square',
        roughness: 0.2,
      });
    } else {
      // 经典多行模式：回向文两列排版 + 方印
      ctx.font = `normal normal 13px ${KAI_TI_FONT_STACK}`;
      ctx.globalAlpha = 0.85;

      const rawDedicationChars = toTraditional(dedicationText).split('');
      const half = Math.ceil(rawDedicationChars.length / 2);
      const col1Chars = rawDedicationChars.slice(0, half);
      const col2Chars = rawDedicationChars.slice(half);

      const tailCol1X = tailStartX + TAIL_WIDTH - 38;
      const tailCol2X = tailCol1X - 22;
      const stepDedication = 18;

      col1Chars.forEach((c, idx) => {
        ctx.fillText(c, tailCol1X, tailY + 20 + idx * stepDedication);
      });
      col2Chars.forEach((c, idx) => {
        ctx.fillText(c, tailCol2X, tailY + 20 + idx * stepDedication);
      });

      // 卷尾朱砂篆刻方印 (钤印)
      const sealSize = 42;
      const sealX = tailStartX + 20;
      const sealY = tailY + tailH - sealSize - 20;
      drawSealOnCanvas(ctx, sealX, sealY, sealSize, {
        text: toTraditional(sealText || '靜心'),
        style: 'bai',
        shape: 'square',
        roughness: 0.2,
      });
    }
    ctx.restore();

    ctx.restore();
  }, [
    HEADER_WIDTH,
    MARGIN_BOTTOM,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    TAIL_WIDTH,
    authorOrTranslator,
    content,
    currentIndex,
    dedicationText,
    displayHeight,
    displayScale,
    displayWidth,
    effectiveCharsPerColumn,
    inkHex,
    isCompactMode,
    liveStrokes,
    numColumns,
    paperTheme,
    scrollTotalHeight,
    scrollTotalWidth,
    sealText,
    themeConfig,
    title,
    totalChars,
    writtenChars,
  ]);

  // 当经卷数据、选字或实时笔画变化时更新画布渲染
  useEffect(() => {
    renderScroll();
  }, [renderScroll]);

  // ============================================================================
  // 交互逻辑：平滑拖拽与单指滑动 + 点击字格直接跳转
  // ============================================================================

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollRef.current = containerRef.current?.scrollLeft || 0;
    dragDistanceRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    dragDistanceRef.current += Math.abs(deltaX);
    containerRef.current.scrollLeft = dragStartScrollRef.current - deltaX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // 如果手指只是轻点（移动距离小于 6px），判断是否命中了某个字格
    if (dragDistanceRef.current < 6 && onSelectChar && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = scrollTotalWidth / rect.width;
      const scaleY = scrollTotalHeight / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const columnsStartX = scrollTotalWidth - MARGIN_RIGHT - HEADER_WIDTH;

      // 判断是否在经文网格区域内
      if (
        clickY >= MARGIN_TOP &&
        clickY <= MARGIN_TOP + effectiveCharsPerColumn * CELL_SIZE
      ) {
        const row = Math.floor((clickY - MARGIN_TOP) / CELL_SIZE);
        const colOffset = columnsStartX - clickX;
        if (colOffset >= 0) {
          const col = Math.floor(colOffset / CELL_SIZE);
          const targetIndex = col * effectiveCharsPerColumn + row;
          if (targetIndex >= 0 && targetIndex < totalChars) {
            onSelectChar(targetIndex);
          }
        }
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollX(e.currentTarget.scrollLeft);
  };

  // 当前正在书写格的几何坐标（用于 GPU 加速呼吸指示框）
  const currentCol = Math.floor(currentIndex / effectiveCharsPerColumn);
  const currentRow = currentIndex % effectiveCharsPerColumn;
  const columnsStartX = scrollTotalWidth - MARGIN_RIGHT - HEADER_WIDTH;
  const currentCellX = columnsStartX - (currentCol + 1) * CELL_SIZE;
  const currentCellY = MARGIN_TOP + currentRow * CELL_SIZE;
  const hasValidCurrentCell = currentIndex >= 0 && currentIndex < totalChars;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* 排版模式与缩放快捷悬浮胶囊 */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-stone-900/85 hover:bg-stone-900/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-stone-700/60 shadow-md transition-all">
        {/* 排版模式切换 */}
        <button
          type="button"
          onClick={() => {
            setLayoutMode((prev) => {
              if (prev === 'auto') return effectiveCharsPerColumn <= 4 ? 'classic' : 'large';
              if (prev === 'large') return 'classic';
              return 'large';
            });
          }}
          className="text-[10px] sm:text-[11px] font-serif text-amber-200/90 hover:text-amber-100 flex items-center gap-1 active:scale-95 pr-1.5 border-r border-stone-700/50"
          title="切换卷轴排版：大字模式 / 全景八行"
        >
          <span>{effectiveCharsPerColumn <= 4 ? `大字模式 (${effectiveCharsPerColumn}行)` : '全景八行'}</span>
          <span className="text-[9px] text-stone-400">切换</span>
        </button>

        {/* 缩放按钮 */}
        <div className="flex items-center gap-0.5 text-stone-300">
          <button
            type="button"
            onClick={() => setZoomMultiplier((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
            className="p-1 hover:text-amber-200 active:scale-90 transition-transform"
            title="缩小卷轴"
          >
            <ZoomOut size={12} />
          </button>
          <button
            type="button"
            onClick={() => setZoomMultiplier(1.0)}
            className="text-[10px] px-1 font-mono hover:text-amber-200 transition-colors"
            title="恢复 100% 默认缩放"
          >
            {Math.round(zoomMultiplier * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoomMultiplier((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100))}
            className="p-1 hover:text-amber-200 active:scale-90 transition-transform"
            title="放大卷轴"
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* 滚动容器 */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onScroll={handleScroll}
        className="w-full h-full overflow-x-auto overflow-y-auto cursor-grab active:cursor-grabbing no-scrollbar touch-pan-x touch-pan-y flex items-center"
        style={{ scrollBehavior: 'auto' }}
      >
        <div
          className="relative flex-shrink-0 my-auto"
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
            }}
            className="shadow-2xl rounded-lg block"
          />

          {/* 金色呼吸高亮框 (GPU 加速 CSS 动效，按比例缩放适配) */}
          {hasValidCurrentCell && (
            <div
              className="absolute pointer-events-none rounded transition-all duration-300 ease-out z-10"
              style={{
                left: `${(currentCellX + CELL_PADDING) * displayScale}px`,
                top: `${(currentCellY + CELL_PADDING) * displayScale}px`,
                width: `${(CELL_SIZE - CELL_PADDING * 2) * displayScale}px`,
                height: `${(CELL_SIZE - CELL_PADDING * 2) * displayScale}px`,
                border: '2px solid rgba(218, 165, 32, 0.95)',
                boxShadow: '0 0 14px 2px rgba(238, 205, 95, 0.65)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* 卷首与卷尾导航提示小浮标（大屏展示，手机端隐藏避免挤占空间） */}
      <div className="hidden sm:block absolute bottom-2 left-4 pointer-events-none text-xs font-serif text-stone-500/80 bg-stone-900/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-stone-600/30">
        <span>从右至左展开长卷 · 双指/单指左右滑动 · 点击字格可重写</span>
      </div>
    </div>
  );
};
