// ============================================================================
// 「静心抄经」手指专属放大米字格书写台
// src/components/ZoomWritingPad.tsx
// 专为平板与手机手指触控设计的黄金书写区域：
// 1. 380x380 px 自适应 devicePixelRatio 高清双层 Canvas
// 2. 底层传统米字格虚线 + 名家小楷字模（浓度 12%~55% 可调，支持字模开关）
// 3. 智能字成走纸：基于汉字标准笔画数（473字内置库），整字写完才启动走纸倒计时，笔画间绝不误走纸
// 4. 三大走纸模式切换：智能笔画圆满走纸 (默认) | 自由手势/点击走纸 | 宽松定时走纸
// 5. 大尺寸防误触操作栏：[撤销一笔] [清空重写] [写完走纸 / 下一字] [上一字]
// ============================================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  BrushStroke,
  WrittenCharRecord,
  PaperTheme,
  InkType,
  INK_COLORS,
  PAPER_THEMES,
  BrushConfig,
  BRUSH_PRESETS,
  createBrushConfigFromThickness,
} from '../types/sutra';
import {
  FingerBrushTracker,
  renderStrokeToCanvas,
  renderInkStamp,
  renderSegmentInterpolation,
} from '../engine/FingerBrushEngine';
import { drawPaperBackground } from '../engine/PaperTextureGen';
import { zenAudio } from '../engine/ZenAudioEngine';
import { appendStrokeToCurrentChar, updateCurrentCharStrokes } from '../db/localDb';
import {
  getExpectedStrokeCount,
  isCharacterComplete,
} from '../data/chineseStrokeData';
import { toTraditional } from '../data/builtInSutras';
import {
  RotateCcw,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  SlidersHorizontal,
  Paintbrush,
} from 'lucide-react';

export type AdvanceMode = 'smart' | 'manual' | 'timed';

export interface ZoomWritingPadProps {
  /** 当前待书写的经文单字，如 "观" */
  currentChar: string;
  /** 当前字在整篇经文中的索引 (0 ~ N - 1) */
  charIndex: number;
  /** 经文总字数（如 260） */
  totalChars: number;
  /** 纸张主题（默认古法宣纸 'xuan'） */
  paperTheme?: PaperTheme;
  /** 墨色类型（默认松烟浓墨 'black'） */
  inkType?: InkType;
  /** 当前抄经会话 ID（用于笔画实时本地持久化） */
  sessionId?: string;
  /** 初始已写笔画（从历史进度恢复时传入） */
  initialStrokes?: BrushStroke[];
  /** 当本字书写完毕（自动走纸或手动确认）时的回调 */
  onCharComplete: (record: WrittenCharRecord) => void;
  /** 实时笔画变更通知（用于全景经卷镜像同步渲染与撤销联动） */
  onStrokesChange?: (strokes: BrushStroke[]) => void;
  /** 书写运笔状态变更回调（用于顶栏微光淡隐联动） */
  onWritingChange?: (isWriting: boolean) => void;
  /** 切换到上一个字（可选） */
  onPrevChar?: () => void;
  /** 切换到下一个字（跳过或推进，可选） */
  onNextChar?: () => void;
  /** 笔刷物理引擎微调参数（可选） */
  brushConfig?: Partial<BrushConfig>;
  /** 当前毛笔粗细 (px)（可选） */
  brushThickness?: number;
  /** 调节毛笔粗细回调（可选） */
  onBrushThicknessChange?: (thickness: number) => void;
}

const PAD_SIZE = 380; // 放大米字格设计基准尺寸 (px)

export const ZoomWritingPad: React.FC<ZoomWritingPadProps> = ({
  currentChar,
  charIndex,
  totalChars,
  paperTheme = 'xuan',
  inkType = 'black',
  sessionId,
  initialStrokes = [],
  onCharComplete,
  onStrokesChange,
  onWritingChange,
  onPrevChar,
  onNextChar,
  brushConfig,
  brushThickness,
  onBrushThicknessChange,
}) => {
  // 画布 DOM 引用（双层设计：底层为纸张背景与字模，顶层为笔墨轨迹）
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 毛笔粗细状态（支持外部受控与内部自管）
  const [localThickness, setLocalThickness] = useState<number>(brushThickness || 14);
  const [showBrushMenu, setShowBrushMenu] = useState(false);
  const currentThickness = brushThickness ?? localThickness;

  const handleUpdateThickness = (newThickness: number) => {
    setLocalThickness(newThickness);
    onBrushThicknessChange?.(newThickness);
  };

  // 笔刷动力学跟踪器
  const trackerRef = useRef<FingerBrushTracker>(
    new FingerBrushTracker(PAD_SIZE, PAD_SIZE, {
      ...createBrushConfigFromThickness(currentThickness),
      ...brushConfig,
    })
  );

  // 书写状态与笔画列表（使用 ref 同步保证 PointerMove 毫秒级零丢帧）
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const lastDrawnPointRef = useRef<{
    x: number;
    y: number;
    r: number;
    alpha: number;
  } | null>(null);

  const [strokes, setStrokes] = useState<BrushStroke[]>(initialStrokes);
  const currentStrokesRef = useRef<BrushStroke[]>(initialStrokes);
  currentStrokesRef.current = strokes;

  // 汉字标准笔画数计算
  const expectedStrokes = getExpectedStrokeCount(currentChar);
  const currentStrokeCount = strokes.length;
  const isComplete = isCharacterComplete(currentStrokeCount, expectedStrokes);

  // 字模辅助与设置状态
  const [showGuideChar, setShowGuideChar] = useState(true);
  const [guideOpacity, setGuideOpacity] = useState(0.35); // 默认 35% 透明度，清晰温润容易辨识

  // 走纸模式：'smart'（智能笔画圆满走纸，推荐）| 'manual'（手动/手势走纸）| 'timed'（纯定时走纸）
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>('smart');
  const [countdownDurationMs, setCountdownDurationMs] = useState(1200); // 1.2 秒从容准备
  const [showAdvanceMenu, setShowAdvanceMenu] = useState(false);

  // 停笔自动走纸倒计时动画状态
  const [countdownProgress, setCountdownProgress] = useState(0); // 0.0 ~ 1.0
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerStartTimeRef = useRef<number>(0);

  // 墨色计算
  const inkHex = INK_COLORS[inkType] || '#1C1B19';
  const themeConfig = PAPER_THEMES[paperTheme] || PAPER_THEMES.xuan;
  const isDarkPaper = paperTheme === 'ciqing' || paperTheme === 'red-gold';

  /**
   * 取消并重置当前的自动走纸定时器与环形动画
   */
  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (animFrameRef.current !== null) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setCountdownProgress(0);
  }, []);

  /**
   * 提交当前字的书写成果并推进到下一个字
   */
  const commitCurrentChar = useCallback(
    (strokesToCommit = currentStrokesRef.current) => {
      cancelAutoAdvance();

      const record: WrittenCharRecord = {
        charIndex,
        character: currentChar,
        strokes: [...strokesToCommit],
        updatedAt: Date.now(),
      };

      // 播放清脆木鱼声
      zenAudio.playWoodenFish();

      // 触发回调
      onCharComplete(record);
    },
    [cancelAutoAdvance, charIndex, currentChar, onCharComplete]
  );

  /**
   * 启动停笔自动走纸倒计时与环形指示器动画
   */
  const startAutoAdvanceCountdown = useCallback(() => {
    cancelAutoAdvance();

    timerStartTimeRef.current = performance.now();

    const updateRingAnimation = () => {
      const elapsed = performance.now() - timerStartTimeRef.current;
      const progress = Math.min(1.0, elapsed / countdownDurationMs);
      setCountdownProgress(progress);

      if (progress < 1.0) {
        animFrameRef.current = window.requestAnimationFrame(updateRingAnimation);
      }
    };

    animFrameRef.current = window.requestAnimationFrame(updateRingAnimation);

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      commitCurrentChar();
    }, countdownDurationMs);
  }, [cancelAutoAdvance, commitCurrentChar, countdownDurationMs]);

  const currentCharKey = `${sessionId || 'default'}_${charIndex}_${currentChar}`;
  const prevCharKeyRef = useRef(currentCharKey);

  // 当外部传入的当前字或字序号变化时，重置笔迹和状态；若初始异步加载完成也平滑补齐
  useEffect(() => {
    if (prevCharKeyRef.current !== currentCharKey) {
      prevCharKeyRef.current = currentCharKey;
      cancelAutoAdvance();
      setStrokes(initialStrokes);
      currentStrokesRef.current = initialStrokes;
    } else if (strokes.length === 0 && initialStrokes.length > 0) {
      setStrokes(initialStrokes);
      currentStrokesRef.current = initialStrokes;
    }
  }, [currentCharKey, cancelAutoAdvance, initialStrokes, strokes.length]);

  // 更新笔刷参数（包含粗细动力学同步）
  useEffect(() => {
    const computedConfig = {
      ...createBrushConfigFromThickness(currentThickness),
      ...brushConfig,
    };
    trackerRef.current.updateConfig(computedConfig);
  }, [currentThickness, brushConfig]);

  /**
   * 绘制底层画布（纸张纹理 + 米字格虚线 + 楷体底字）
   */
  const renderBackgroundLayer = useCallback(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PAD_SIZE * dpr;
    canvas.height = PAD_SIZE * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. 绘制古笺纸张背景纹理
    drawPaperBackground(ctx, paperTheme, PAD_SIZE, PAD_SIZE);

    // 2. 绘制传统米字格 (米字九宫格)
    const padding = 12;
    const innerSize = PAD_SIZE - padding * 2;
    const x0 = padding;
    const y0 = padding;
    const x1 = PAD_SIZE - padding;
    const y1 = PAD_SIZE - padding;
    const cx = PAD_SIZE / 2;
    const cy = PAD_SIZE / 2;

    const gridColor = themeConfig.gridColor || '#C8B69E';

    // A. 外边框 (双边框内实外虚)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, innerSize, innerSize);

    // B. 米字虚线 (中心横十字 + 对角交叉线)
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.0;
    ctx.setLineDash([4, 4]); // 虚线段

    ctx.beginPath();
    // 横中心线
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    // 竖中心线
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx, y1);
    // 对角斜线 1
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    // 对角斜线 2
    ctx.moveTo(x1, y0);
    ctx.lineTo(x0, y1);
    ctx.stroke();

    // 内心定位辅框（传统小内方格）
    const centerBoxHalf = innerSize * 0.18;
    ctx.strokeRect(
      cx - centerBoxHalf,
      cy - centerBoxHalf,
      centerBoxHalf * 2,
      centerBoxHalf * 2
    );
    ctx.restore();

    // 3. 绘制楷体小楷字模（正体名家底帖，加大字模在米字格中的占比，使气韵舒展饱满）
    if (showGuideChar && currentChar) {
      ctx.save();
      const fontSize = Math.floor(innerSize * 0.88);
      ctx.font = `normal normal 400 ${fontSize}px "ZenKai", "Kaiti TC", "BiauKai", "DFKai-SB", "TW-MOE-Std-Kai", "Kaiti SC", "STKaiti", "KaiTi", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 文字透明度与颜色（跟随推荐墨色，柔和半透明显示）
      ctx.fillStyle = themeConfig.recommendedInkColor || '#1C1B19';
      ctx.globalAlpha = Math.min(0.85, Math.max(0.08, guideOpacity));
      // 垂直居中微调（中文字符光学偏置 +4px）
      const displayChar = toTraditional(currentChar);
      ctx.fillText(displayChar, cx, cy + 4);
      ctx.restore();
    }

    ctx.restore();
  }, [guideOpacity, paperTheme, showGuideChar, currentChar, themeConfig]);

  /**
   * 重绘顶层手写笔迹图层
   */
  const renderStrokesLayer = useCallback(() => {
    const canvas = strokeCanvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PAD_SIZE * dpr;
    canvas.height = PAD_SIZE * dpr;

    // 注意：严禁在具有底层叠加透明度的图层上使用 desynchronized: true，
    // 否则在 iOS WebKit 与部分 Android 渲染合成器上会将透明通道直接渲染为纯黑！
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, PAD_SIZE, PAD_SIZE);

    // 绘制所有已完成的笔画
    strokes.forEach((stroke) => {
      renderStrokeToCanvas(ctx, stroke, PAD_SIZE, PAD_SIZE, inkHex, 1.5);
    });

    ctx.restore();
  }, [inkHex, strokes]);

  // 背景与字模更新时重新渲染底层
  useEffect(() => {
    renderBackgroundLayer();
  }, [renderBackgroundLayer]);

  // 当系统/网络楷体字体就绪时，立即重绘确保字模即刻显现
  useEffect(() => {
    if (typeof document !== 'undefined' && (document as unknown as { fonts?: { ready: Promise<void> } }).fonts) {
      (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready.then(() => {
        renderBackgroundLayer();
      });
    }
  }, [renderBackgroundLayer]);

  // 笔画列表变更时重新渲染顶层
  useEffect(() => {
    renderStrokesLayer();
  }, [renderStrokesLayer]);

  // ============================================================================
  // 手指触摸与鼠标事件处理 (Pointer Events)
  // ============================================================================

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = strokeCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? PAD_SIZE / rect.width : 1;
    const scaleY = rect.height > 0 ? PAD_SIZE / rect.height : 1;
    const x = Math.max(0, Math.min(PAD_SIZE, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(PAD_SIZE, (e.clientY - rect.top) * scaleY));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 兼容部分浏览器环境
    }

    // 唤醒 Web Audio 离线音频上下文
    zenAudio.ensureContext();

    // 手指再次落笔时，立即打断并撤销走纸倒计时！
    cancelAutoAdvance();

    const { x, y } = getCanvasCoords(e);
    const now = performance.now();

    isDrawingRef.current = true;
    setIsDrawing(true);
    onWritingChange?.(true);

    // 动力学引擎起笔
    const firstPoint = trackerRef.current.startStroke(x, y, now);
    lastDrawnPointRef.current = {
      x: firstPoint.x * PAD_SIZE,
      y: firstPoint.y * PAD_SIZE,
      r: firstPoint.r * PAD_SIZE,
      alpha: firstPoint.alpha,
    };

    // 立即在当前画布上绘制第一滴起笔圆润墨点
    const canvas = strokeCanvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(dpr, dpr);
        renderInkStamp(
          ctx,
          firstPoint.x * PAD_SIZE,
          firstPoint.y * PAD_SIZE,
          firstPoint.r * PAD_SIZE,
          firstPoint.alpha,
          inkHex
        );
        ctx.restore();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    const { x, y } = getCanvasCoords(e);
    const now = performance.now();

    // 动力学引擎增加采样点并计算速度与笔触大小
    const newPoint = trackerRef.current.addPoint(x, y, now);
    const smoothVel = trackerRef.current.getSmoothVelocity();

    // 实时更新宣纸运笔摩擦白噪音 ASMR
    zenAudio.updateBrushFriction(smoothVel);

    // 在上一落墨点与新落墨点之间进行密集印章插值，杜绝快速运笔时产生离散点洞
    const canvas = strokeCanvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(dpr, dpr);
        const currPx = {
          x: newPoint.x * PAD_SIZE,
          y: newPoint.y * PAD_SIZE,
          r: newPoint.r * PAD_SIZE,
          alpha: newPoint.alpha,
        };

        if (lastDrawnPointRef.current) {
          renderSegmentInterpolation(
            ctx,
            lastDrawnPointRef.current.x,
            lastDrawnPointRef.current.y,
            lastDrawnPointRef.current.r,
            lastDrawnPointRef.current.alpha,
            currPx.x,
            currPx.y,
            currPx.r,
            currPx.alpha,
            inkHex,
            1.5
          );
        } else {
          renderInkStamp(ctx, currPx.x, currPx.y, currPx.r, currPx.alpha, inkHex);
        }
        ctx.restore();
        lastDrawnPointRef.current = currPx;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // 忽略部分浏览器释放异常
    }

    isDrawingRef.current = false;
    setIsDrawing(false);
    onWritingChange?.(false);
    lastDrawnPointRef.current = null;

    // 运笔停止，平滑关闭宣纸摩擦音
    zenAudio.stopBrushFriction();

    // 收笔出锋合成（自动生成 6 个尖锋插值点）
    const completedPoints = trackerRef.current.endStroke(performance.now());

    if (completedPoints.length > 0) {
      const newStroke: BrushStroke = {
        points: completedPoints,
      };

      const nextStrokes = [...strokes, newStroke];
      setStrokes(nextStrokes);
      currentStrokesRef.current = nextStrokes;
      onStrokesChange?.(nextStrokes);

      // 异步持久化当前单笔至 IndexedDB（离线无缝防丢）
      if (sessionId) {
        appendStrokeToCurrentChar(sessionId, charIndex, currentChar, newStroke).catch(
          (err) => console.warn('自动保存笔画失败:', err)
        );
      }

      // ======================================================================
      // 核心判定：整字写完再走纸的智能判定机制
      // ======================================================================
      const nextStrokeCount = nextStrokes.length;
      const isCharFinished = isCharacterComplete(nextStrokeCount, expectedStrokes);

      if (advanceMode === 'smart') {
        // 模式 1（默认）：智能笔画圆满走纸
        // 只有当笔画数达到或基本达到该字标准笔画数（整字写完）时，才启动走纸倒计时！
        // 笔画未写完时，手指抬起绝对不触发倒计时，支持从容构思下一笔！
        if (isCharFinished) {
          startAutoAdvanceCountdown();
        }
      } else if (advanceMode === 'timed') {
        // 模式 3：定时模式（需已写至少一笔）
        if (nextStrokeCount > 0) {
          startAutoAdvanceCountdown();
        }
      }
      // 模式 2（manual）：不自动走纸，完全交由用户点击 [写完走纸] 控制
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // 忽略
    }
    isDrawingRef.current = false;
    setIsDrawing(false);
    onWritingChange?.(false);
    lastDrawnPointRef.current = null;
    zenAudio.stopBrushFriction();
  };

  // ============================================================================
  // 防误触大按钮操作
  // ============================================================================

  /**
   * 撤销上一笔
   */
  const handleUndoLastStroke = () => {
    cancelAutoAdvance();
    if (strokes.length === 0) return;

    const nextStrokes = strokes.slice(0, -1);
    setStrokes(nextStrokes);
    currentStrokesRef.current = nextStrokes;
    onStrokesChange?.(nextStrokes);

    if (sessionId) {
      updateCurrentCharStrokes(sessionId, charIndex, currentChar, nextStrokes).catch(
        (err) => console.warn('撤销笔迹持久化失败:', err)
      );
    }
  };

  /**
   * 清空重写本字
   */
  const handleClearCurrentChar = () => {
    cancelAutoAdvance();
    setStrokes([]);
    currentStrokesRef.current = [];
    onStrokesChange?.([]);

    if (sessionId) {
      updateCurrentCharStrokes(sessionId, charIndex, currentChar, []).catch(
        (err) => console.warn('清空笔迹持久化失败:', err)
      );
    }
  };

  /**
   * 手动直接完成走纸（修复：杜绝双重进位跳字）
   */
  const handleManualAdvanceNext = () => {
    if (strokes.length > 0) {
      commitCurrentChar();
    } else if (onNextChar) {
      onNextChar();
    }
  };

  /**
   * 回到上一字
   */
  const handleManualPrev = () => {
    cancelAutoAdvance();
    if (onPrevChar) {
      onPrevChar();
    }
  };

  // 计算圆环进度周长 (r = 22, 周长 ≈ 138.2)
  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - countdownProgress);

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[380px] mx-auto px-1">
      {/* 顶部指示条：当前字、笔画进度反馈与字模控制 */}
      <div
        className={`w-full flex items-center justify-between px-1 mb-1 sm:mb-2 flex-shrink-0 relative z-30 ${
          isDarkPaper ? 'text-amber-100/90' : 'text-stone-700'
        }`}
      >
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <span
            className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-serif font-medium border whitespace-nowrap ${
              isDarkPaper
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                : 'bg-amber-900/10 text-amber-950 border-amber-900/20'
            }`}
          >
            第 {charIndex + 1}/{totalChars}
          </span>
          <span
            className={`text-lg sm:text-xl font-serif font-bold tracking-wider ${
              isDarkPaper ? 'text-amber-100' : 'text-stone-900'
            }`}
          >
            「{currentChar}」
          </span>

          {/* 实时笔画状态胶囊徽标 */}
          <span
            className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-serif font-medium transition-all flex items-center gap-1 ${
              isComplete
                ? 'bg-amber-100 text-amber-900 border border-amber-400 shadow-sm animate-pulse-slow'
                : isDarkPaper
                ? 'bg-stone-800/80 text-amber-200/90 border-stone-600'
                : 'bg-stone-200/80 text-stone-600 border border-stone-300'
            }`}
            title={`当前字标准笔画约 ${expectedStrokes} 笔，已书写 ${currentStrokeCount} 笔`}
          >
            {isComplete && <Sparkles size={11} className="text-amber-700 flex-shrink-0" />}
            <span className="whitespace-nowrap">
              {isComplete
                ? `圆满 (${currentStrokeCount}/${expectedStrokes})`
                : `${currentStrokeCount}/${expectedStrokes}笔`}
            </span>
          </span>
        </div>

        {/* 字模透明度与笔触粗细控制胶囊 */}
        <div
          className={`relative flex items-center space-x-1.5 backdrop-blur-sm px-2 py-0.5 sm:py-1 rounded-full border text-xs shadow-sm ${
            isDarkPaper
              ? 'bg-stone-900/80 border-stone-700/80 text-stone-200'
              : 'bg-stone-100/85 border-stone-200/80 text-stone-700'
          }`}
        >
          {/* 字模显隐与浓度 */}
          <button
            type="button"
            onClick={() => setShowGuideChar(!showGuideChar)}
            title={showGuideChar ? '隐藏底稿字模' : '显示底稿字模'}
            className={isDarkPaper ? 'text-stone-300 hover:text-white transition-colors' : 'text-stone-600 hover:text-stone-900 transition-colors'}
          >
            {showGuideChar ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {showGuideChar && (
            <input
              type="range"
              min="0.10"
              max="0.70"
              step="0.02"
              value={guideOpacity}
              onChange={(e) => setGuideOpacity(parseFloat(e.target.value))}
              className="w-8 sm:w-12 h-1 bg-stone-400 rounded-lg appearance-none cursor-pointer accent-amber-600"
              title="调节底稿浓度"
            />
          )}

          <div className={`w-[1px] h-3 ${isDarkPaper ? 'bg-stone-700' : 'bg-stone-300'}`} />

          {/* 笔触粗细调节弹出按钮 */}
          <button
            type="button"
            onClick={() => setShowBrushMenu(!showBrushMenu)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all text-[11px] font-serif ${
              showBrushMenu
                ? 'bg-amber-900 text-amber-100 shadow-inner'
                : isDarkPaper
                ? 'text-amber-200/90 hover:text-amber-100 hover:bg-stone-800'
                : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
            title="调节毛笔粗细"
          >
            <Paintbrush size={12} className={isDarkPaper ? 'text-amber-300 flex-shrink-0' : 'text-amber-800 flex-shrink-0'} />
            <span className="font-medium whitespace-nowrap">{currentThickness}px</span>
          </button>

          {/* 点击外部区域关闭笔触弹窗遮罩 */}
          {showBrushMenu && (
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setShowBrushMenu(false)}
            />
          )}

          {/* 毛笔粗细悬浮设置面板 */}
          {showBrushMenu && (
            <div
              className="absolute top-full right-0 mt-2 w-64 p-3 bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl z-50 flex flex-col gap-2.5 font-serif text-xs text-stone-200 animate-fade-in"
              style={{ backgroundColor: 'rgba(28, 25, 23, 0.98)' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-stone-800">
                <div className="flex items-center gap-1.5">
                  <Paintbrush size={13} className="text-amber-400" />
                  <span className="text-amber-200 font-medium">笔触字号粗细</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs px-1.5 py-0.5 bg-stone-800 rounded text-amber-300">
                    {currentThickness} px
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBrushMenu(false)}
                    className="text-stone-400 hover:text-stone-200 p-0.5 rounded text-[10px]"
                    title="完成关闭"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 实时笔锋墨点动态预览 */}
              <div className="w-full h-11 rounded-xl bg-stone-800/80 border border-stone-700/60 flex items-center justify-between px-3">
                <span className="text-[10px] text-stone-400">落笔预览：</span>
                <div className="flex-1 flex items-center justify-center">
                  <div
                    className="rounded-full transition-all duration-150 shadow-sm"
                    style={{
                      width: `${Math.max(4, Math.min(28, currentThickness * 1.3))}px`,
                      height: `${Math.max(4, Math.min(28, currentThickness * 1.3))}px`,
                      backgroundColor: inkHex,
                      boxShadow: `0 0 6px ${inkHex}50`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-serif text-amber-200/90 whitespace-nowrap">
                  {BRUSH_PRESETS.find((p) => p.thickness === currentThickness)?.name || '自定义'}
                </span>
              </div>

              {/* 4 个经典古法档位快捷切换 */}
              <div className="grid grid-cols-4 gap-1">
                {BRUSH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleUpdateThickness(preset.thickness)}
                    className={`py-1.5 px-1 rounded-lg text-center flex flex-col items-center justify-center transition-all border active:scale-95 ${
                      currentThickness === preset.thickness
                        ? 'bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-sm ring-1 ring-amber-500/40'
                        : 'bg-stone-800/50 border-transparent hover:border-stone-700 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span className="text-[11px] font-medium leading-none">{preset.name}</span>
                    <span className="text-[9px] text-stone-500 mt-1">{preset.thickness}px</span>
                  </button>
                ))}
              </div>

              {/* 连续微调滑块 */}
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>细 (6px)</span>
                  <span>粗 (30px)</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="30"
                  step="1"
                  value={currentThickness}
                  onChange={(e) => handleUpdateThickness(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 核心书写画布区域（自适应方格，按可用宽高自适应缩放） */}
      <div
        className={`relative w-full aspect-square max-w-[min(380px,88vw,calc(100dvh-335px))] max-h-[min(380px,88vw,calc(100dvh-335px))] landscape:max-w-[calc(100dvh-135px)] landscape:max-h-[calc(100dvh-135px)] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 touch-none transition-colors duration-200 flex-shrink-0 ${
          isDrawing ? 'border-amber-700/60 ring-2 ring-amber-500/20' : isDarkPaper ? 'border-stone-700/80' : 'border-stone-300/80'
        }`}
        style={{
          backgroundColor: themeConfig.bgColor,
          boxShadow:
            '0 20px 25px -5px rgba(40, 30, 20, 0.12), 0 8px 10px -6px rgba(40, 30, 20, 0.08)',
        }}
      >
        {/* 底层画布：宣纸纹理 + 米字格 + 楷体字模 */}
        <canvas
          ref={bgCanvasRef}
          style={{ width: '100%', height: '100%' }}
          className="absolute inset-0 w-full h-full pointer-events-none block"
        />

        {/* 顶层手写交互画布：高分屏抗锯齿矢量笔墨 */}
        <canvas
          ref={strokeCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ width: '100%', height: '100%' }}
          className="absolute inset-0 w-full h-full cursor-crosshair z-10 block"
        />

        {/* 停笔自动走纸倒计时环形视觉反馈（悬浮在右上角） */}
        {countdownProgress > 0 && countdownProgress < 1.0 && (
          <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-lg border border-amber-900/20 animate-fade-in">
            <svg className="w-4 h-4 transform -rotate-90 mr-1" viewBox="0 0 52 52">
              <circle
                cx="26"
                cy="26"
                r={ringRadius}
                stroke="#E5E7EB"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="26"
                cy="26"
                r={ringRadius}
                stroke="#8E2924"
                strokeWidth="4"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-75"
              />
            </svg>
            <span className="text-[10px] sm:text-[11px] font-serif font-medium text-amber-950">
              走纸中...
            </span>
          </div>
        )}
      </div>

      {/* 底部人体工学防误触操作栏 */}
      <div className="w-full mt-2 sm:mt-3 flex items-center justify-between gap-1 sm:gap-2 px-0.5 flex-shrink-0">
        {/* 撤销上一笔 */}
        <button
          type="button"
          onClick={handleUndoLastStroke}
          disabled={strokes.length === 0}
          className={`flex-1 flex items-center justify-center gap-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl font-serif text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
            isDarkPaper
              ? 'bg-stone-800/90 hover:bg-stone-700 text-stone-200 border border-stone-700/80'
              : 'bg-stone-200/80 hover:bg-stone-300/80 text-stone-800'
          }`}
          title="撤销上一笔画"
        >
          <RotateCcw size={15} />
          <span>撤销</span>
        </button>

        {/* 清空重写本字 */}
        <button
          type="button"
          onClick={handleClearCurrentChar}
          disabled={strokes.length === 0}
          className={`flex-1 flex items-center justify-center gap-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl font-serif text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
            isDarkPaper
              ? 'bg-stone-800/90 hover:bg-rose-950/80 hover:text-rose-200 text-stone-200 border border-stone-700/80'
              : 'bg-stone-200/80 hover:bg-rose-100 hover:text-rose-900 text-stone-800'
          }`}
          title="清空当前字迹重写"
        >
          <Trash2 size={15} />
          <span>重写</span>
        </button>

        {/* 上一字 */}
        {onPrevChar && (
          <button
            type="button"
            onClick={handleManualPrev}
            disabled={charIndex <= 0}
            className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
              isDarkPaper
                ? 'bg-stone-800/90 hover:bg-stone-700 text-stone-200 border border-stone-700/80'
                : 'bg-stone-200/80 hover:bg-stone-300/80 text-stone-800'
            }`}
            title="回到上一字"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* 写完走纸 / 下一字（主按钮） */}
        <button
          type="button"
          onClick={handleManualAdvanceNext}
          className={`flex-[1.4] flex items-center justify-center gap-1 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg sm:rounded-xl font-serif text-xs sm:text-sm font-medium transition-all shadow-md active:scale-95 ${
            isComplete
              ? 'bg-gradient-to-r from-amber-800 to-amber-900 hover:from-amber-700 hover:to-amber-800 text-amber-50 ring-2 ring-amber-500/50 shadow-amber-900/30'
              : 'bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-stone-200'
          }`}
          title="整字写完，烘焙入卷并切入下一字"
        >
          <span>{charIndex >= totalChars - 1 ? '圆满结卷' : '写完走纸'}</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* 底部走纸模式设置面板 */}
      <div
        className={`w-full mt-1.5 sm:mt-2.5 flex items-center justify-between px-1 text-[11px] sm:text-xs font-serif relative flex-shrink-0 ${
          isDarkPaper ? 'text-stone-300' : 'text-stone-500'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAdvanceMenu(!showAdvanceMenu)}
            className={`flex items-center gap-1 transition-colors ${
              isDarkPaper ? 'text-amber-200/90 hover:text-amber-100' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <SlidersHorizontal size={12} className={isDarkPaper ? 'text-amber-400' : 'text-amber-800'} />
            <span className={`font-medium hidden xs:inline ${isDarkPaper ? 'text-stone-300' : 'text-stone-700'}`}>走纸模式：</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs whitespace-nowrap border ${
                isDarkPaper
                  ? 'text-amber-200 bg-amber-950/70 border-amber-600/40'
                  : 'text-amber-900 bg-amber-100/80 border-amber-300/60'
              }`}
            >
              {advanceMode === 'smart' && '✨ 智能字成'}
              {advanceMode === 'manual' && '✍️ 手动点击'}
              {advanceMode === 'timed' && '⏱️ 定时走纸'}
            </span>
          </button>
        </div>

        {/* 智能说明气泡 */}
        <span
          className={`text-[10px] sm:text-[11px] truncate max-w-[150px] sm:max-w-none text-right ${
            isDarkPaper ? 'text-stone-400' : 'text-stone-400'
          }`}
        >
          {advanceMode === 'smart'
            ? '整字写满自动走纸'
            : advanceMode === 'manual'
            ? '自由书写不限时'
            : `${(countdownDurationMs / 1000).toFixed(1)}s 停笔走纸`}
        </span>

        {/* 模式选择弹出菜单 */}
        {showAdvanceMenu && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setShowAdvanceMenu(false)}
            />
            <div
              className="fixed inset-x-3 top-1/2 -translate-y-1/2 mx-auto w-auto max-w-xs max-h-[88dvh] overflow-y-auto z-50 p-3.5 bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col gap-2 font-serif text-xs text-stone-200 animate-fade-in lg:absolute lg:inset-x-auto lg:left-0 lg:bottom-full lg:top-auto lg:translate-y-0 lg:mb-2 lg:w-72 lg:max-h-[80vh]"
              style={{ backgroundColor: 'rgba(28, 25, 23, 0.98)' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1 border-b border-stone-800">
                <span className="text-amber-400 font-medium">选择抄经节奏</span>
                <button
                  type="button"
                  onClick={() => setShowAdvanceMenu(false)}
                  className="text-stone-400 hover:text-stone-200 text-xs px-1 py-0.5 rounded"
                  title="关闭"
                >
                  ✕
                </button>
              </div>

              {/* 选项 1：智能模式 */}
              <button
                type="button"
                onClick={() => {
                  setAdvanceMode('smart');
                  cancelAutoAdvance();
                  setShowAdvanceMenu(false);
                }}
                className={`p-2 rounded-xl text-left transition-all border ${
                  advanceMode === 'smart'
                    ? 'bg-amber-950/80 border-amber-600/80 text-amber-200'
                    : 'bg-stone-800/60 border-transparent hover:border-stone-600 text-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">✨ 智能字成走纸 (推荐)</span>
                  {advanceMode === 'smart' && <Check size={14} className="text-amber-400" />}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  自动感知汉字标准笔画数（当前字 {expectedStrokes} 笔），写完全部笔画后才走纸，笔画间绝不抢跑。
                </p>
              </button>

              {/* 选项 2：手动走纸 */}
              <button
                type="button"
                onClick={() => {
                  setAdvanceMode('manual');
                  cancelAutoAdvance();
                  setShowAdvanceMenu(false);
                }}
                className={`p-2 rounded-xl text-left transition-all border ${
                  advanceMode === 'manual'
                    ? 'bg-amber-950/80 border-amber-600/80 text-amber-200'
                    : 'bg-stone-800/60 border-transparent hover:border-stone-600 text-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">✍️ 手动点击走纸</span>
                  {advanceMode === 'manual' && <Check size={14} className="text-amber-400" />}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  完全无倒计时催促，写完本字后手动点击 [写完走纸] 按钮。
                </p>
              </button>

              {/* 选项 3：纯定时走纸 */}
              <button
                type="button"
                onClick={() => {
                  setAdvanceMode('timed');
                  cancelAutoAdvance();
                  setShowAdvanceMenu(false);
                }}
                className={`p-2 rounded-xl text-left transition-all border ${
                  advanceMode === 'timed'
                    ? 'bg-amber-950/80 border-amber-600/80 text-amber-200'
                    : 'bg-stone-800/60 border-transparent hover:border-stone-600 text-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">⏱️ 纯延时走纸</span>
                  {advanceMode === 'timed' && <Check size={14} className="text-amber-400" />}
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  只要抬笔就启动倒计时，适合单笔练习。
                </p>
              </button>

              {/* 延时时长微调 */}
              {advanceMode !== 'manual' && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-[11px]">
                  <span className="text-stone-400">走纸等待缓冲：</span>
                  <div className="flex gap-1.5">
                    {[1000, 1500, 2000, 3000].map((ms) => (
                      <button
                        key={ms}
                        type="button"
                        onClick={() => setCountdownDurationMs(ms)}
                        className={`px-2 py-0.5 rounded ${
                          countdownDurationMs === ms
                            ? 'bg-amber-800 text-amber-100'
                            : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {(ms / 1000).toFixed(1)}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
