// ============================================================================
// 「静心抄经」装裱钤印导出与笔迹动态回放模态框
// src/components/SealAndExportModal.tsx
// 1. 自定义 2~4 字传统朱文/白文篆刻方印与回向文模板
// 2. 高清装裱长卷 PNG 一键合成并下载
// 3. 笔迹倍速回放 (Time-Lapse Replay)：5x/10x/20x 动态再现一笔一画
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SutraDocument,
  WrittenCharRecord,
  PaperTheme,
  InkType,
  SealConfig,
  INK_COLORS,
  PAPER_THEMES,
} from '../types/sutra';
import { DEDICATION_TEMPLATES } from '../data/builtInSutras';
import {
  downloadScrollImage,
  TimeLapseReplayer,
  ReplayFrameState,
  drawSealOnCanvas,
} from '../engine/ScrollExporter';
import { renderStrokeToCanvas } from '../engine/FingerBrushEngine';
import { drawPaperBackground } from '../engine/PaperTextureGen';
import {
  X,
  Download,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Stamp,
  Film,
} from 'lucide-react';

export interface SealAndExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sutra: SutraDocument;
  writtenChars: Record<number, WrittenCharRecord>;
  paperTheme: PaperTheme;
  inkType: InkType;
  initialDedicationText?: string;
  initialSealText?: string;
  onSaveSealAndDedication?: (dedication: string, seal: string) => void;
}

export const SealAndExportModal: React.FC<SealAndExportModalProps> = ({
  isOpen,
  onClose,
  sutra,
  writtenChars,
  paperTheme,
  inkType,
  initialDedicationText = '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
  initialSealText = '静心',
  onSaveSealAndDedication,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'replay'>('export');

  // 钤印与回向文设置
  const [sealText, setSealText] = useState(initialSealText);
  const [sealStyle, setSealStyle] = useState<'bai' | 'zhu'>('bai');
  const [dedicationText, setDedicationText] = useState(initialDedicationText);
  const [isExporting, setIsExporting] = useState(false);

  // 印章实时预览 Canvas
  const sealCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 动态回放状态
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const replayerRef = useRef<TimeLapseReplayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(10);
  const [replayProgress, setReplayProgress] = useState(0);
  const [currentReplayChar, setCurrentReplayChar] = useState('');

  // 绘制印章微缩预览
  const renderSeal = useCallback((targetCanvas?: HTMLCanvasElement | null) => {
    const canvas = targetCanvas || sealCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 96;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const cfg: SealConfig = {
      text: sealText || '静心',
      style: sealStyle,
      shape: 'square',
      roughness: 0.2,
    };

    drawSealOnCanvas(ctx, 4, 4, size - 8, cfg);
  }, [sealText, sealStyle]);

  // 当模态框打开、切回导出标签、或者印章文字/样式变更时均重新绘制
  useEffect(() => {
    if (isOpen && activeTab === 'export') {
      renderSeal();
      const raf = requestAnimationFrame(() => renderSeal());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, activeTab, renderSeal]);

  // 当模态框重新开启时同步最新的印章与回向文
  useEffect(() => {
    if (isOpen) {
      setSealText(initialSealText);
      setDedicationText(initialDedicationText);
    }
  }, [isOpen, initialSealText, initialDedicationText]);

  // 回放引擎生命周期（移除 replaySpeed 依赖，使倍速切换不打断当前播放）
  useEffect(() => {
    if (!isOpen || activeTab !== 'replay') {
      if (replayerRef.current) {
        replayerRef.current.dispose();
        replayerRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    const replayer = new TimeLapseReplayer(
      sutra.content,
      writtenChars,
      replaySpeed
    );
    replayerRef.current = replayer;

    return () => {
      replayer.dispose();
      replayerRef.current = null;
    };
  }, [isOpen, activeTab, sutra.content, writtenChars]);

  // 回放初始画面预览（展示当前纸张底色与虚线米字格）
  useEffect(() => {
    if (isOpen && activeTab === 'replay') {
      const canvas = replayCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const padSize = 340;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = padSize * dpr;
          canvas.height = padSize * dpr;
          ctx.save();
          ctx.scale(dpr, dpr);
          drawPaperBackground(ctx, paperTheme, padSize, padSize);
          const themeConfig = PAPER_THEMES[paperTheme] || PAPER_THEMES.xuan;
          const gridColor = themeConfig.gridColor || '#C8B69E';
          ctx.save();
          ctx.strokeStyle = gridColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(12, 12, padSize - 24, padSize - 24);
          ctx.beginPath();
          ctx.moveTo(12, padSize / 2);
          ctx.lineTo(padSize - 12, padSize / 2);
          ctx.moveTo(padSize / 2, 12);
          ctx.lineTo(padSize / 2, padSize - 12);
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        }
      }
    }
  }, [isOpen, activeTab, paperTheme]);

  /**
   * 渲染单帧回放画面到 Canvas（支持高分屏 DPR 抗锯齿）
   */
  const handleReplayFrame = (state: ReplayFrameState) => {
    setReplayProgress(state.progress);
    setCurrentReplayChar(state.character);
    if (state.isFinished) {
      setIsPlaying(false);
    }

    const canvas = replayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padSize = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = padSize * dpr;
    canvas.height = padSize * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 纸张底色
    drawPaperBackground(ctx, paperTheme, padSize, padSize);

    const themeConfig = PAPER_THEMES[paperTheme] || PAPER_THEMES.xuan;
    const gridColor = themeConfig.gridColor || '#C8B69E';
    const inkHex = INK_COLORS[inkType] || '#1C1B19';

    // 米字格虚线
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(12, 12, padSize - 24, padSize - 24);
    ctx.beginPath();
    ctx.moveTo(12, padSize / 2);
    ctx.lineTo(padSize - 12, padSize / 2);
    ctx.moveTo(padSize / 2, 12);
    ctx.lineTo(padSize / 2, padSize - 12);
    ctx.stroke();
    ctx.restore();

    // 绘制已有笔画（采用与当前书写/导出一致的墨色）
    state.strokesSoFar.forEach((stroke) => {
      renderStrokeToCanvas(ctx, stroke, padSize, padSize, inkHex, 1.5);
    });

    ctx.restore();
  };

  /**
   * 播放 / 暂停回放
   */
  const handleTogglePlay = () => {
    if (!replayerRef.current) return;

    if (isPlaying) {
      replayerRef.current.pause();
      setIsPlaying(false);
    } else {
      replayerRef.current.play(handleReplayFrame);
      setIsPlaying(true);
    }
  };

  /**
   * 重新从头开始回放
   */
  const handleRestart = () => {
    if (!replayerRef.current) return;
    replayerRef.current.restart();
    replayerRef.current.play(handleReplayFrame);
    setIsPlaying(true);
  };

  /**
   * 执行高清装裱长卷 PNG 下载
   */
  const handleDownload = () => {
    setIsExporting(true);

    if (onSaveSealAndDedication) {
      onSaveSealAndDedication(dedicationText, sealText);
    }

    // 延时让 UI 给予点击反馈
    window.setTimeout(() => {
      try {
        downloadScrollImage({
          sutra,
          writtenChars,
          paperTheme,
          inkType,
          dedicationText,
          sealConfig: {
            text: sealText || '静心',
            style: sealStyle,
            shape: 'square',
            roughness: 0.2,
          },
          scale: 2.0, // 2x 超清印刷级长卷
        });
      } catch (err) {
        console.error('导出长图失败:', err);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 animate-fade-in font-serif select-none">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-200">
        {/* 顶部标题与 Tab 栏 */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 pt-3.5 sm:pt-5 pb-2.5 sm:pb-3 border-b border-stone-800">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'export'
                  ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Stamp size={14} />
              <span>钤印导出</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('replay')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'replay'
                  ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Film size={14} />
              <span>笔迹回放</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容主体 */}
        <div className="p-3.5 sm:p-6 overflow-y-auto max-h-[80vh]">
          {activeTab === 'export' ? (
            <div className="flex flex-col gap-5">
              {/* 印章配置 */}
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center bg-stone-800/40 p-4 rounded-2xl border border-stone-700/40">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-stone-400 mb-2">印章实景预览</span>
                  <canvas
                    ref={(node) => {
                      sealCanvasRef.current = node;
                      if (node) {
                        renderSeal(node);
                      }
                    }}
                    className="w-24 h-24 rounded-lg shadow-md bg-stone-950/40 p-1"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">
                      篆刻印文（2~4字，如姓名、静心、欢喜）
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={sealText}
                      onChange={(e) => setSealText(e.target.value)}
                      placeholder="静心"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-sm text-amber-100 focus:outline-none focus:border-amber-600 font-serif"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-stone-400 block mb-1">印章风格</span>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                        <input
                          type="radio"
                          name="sealStyle"
                          checked={sealStyle === 'bai'}
                          onChange={() => setSealStyle('bai')}
                          className="text-amber-600 focus:ring-0"
                        />
                        <span>白文（阴刻·红底白字，推荐）</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                        <input
                          type="radio"
                          name="sealStyle"
                          checked={sealStyle === 'zhu'}
                          onChange={() => setSealStyle('zhu')}
                          className="text-amber-600 focus:ring-0"
                        />
                        <span>朱文（阳刻·纸底红字）</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 回向文设置 */}
              <div>
                <label className="text-xs text-stone-400 block mb-1.5">
                  卷尾发愿回向文
                </label>
                <textarea
                  rows={2}
                  value={dedicationText}
                  onChange={(e) => setDedicationText(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-sm text-stone-200 focus:outline-none focus:border-amber-600 resize-none font-serif leading-relaxed"
                />

                {/* 传统模板快速选用 */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-stone-500 py-1">常用模板：</span>
                  {DEDICATION_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDedicationText(tmpl)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-amber-200 border border-stone-700/50 transition-colors truncate max-w-[200px]"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* 导出说明与按钮 */}
              <div className="mt-2 pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-stone-400">
                  <span>长卷尺寸：超清装裱画幅（2x 缩放，内含乌丝栏与全部矢量笔迹）</span>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-50 font-medium text-sm tracking-wider shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  <Download size={16} />
                  <span>{isExporting ? '长卷装裱合成中...' : '下载装裱长卷 PNG'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* 笔迹倍速回放面板 */
            <div className="flex flex-col items-center w-full">
              <div className="relative w-full aspect-square max-w-[min(340px,75vw)] max-h-[min(340px,75vw)] rounded-xl sm:rounded-2xl overflow-hidden shadow-inner border border-stone-700/60 bg-stone-950 flex items-center justify-center">
                <canvas
                  ref={replayCanvasRef}
                  className="w-full h-full"
                />
                {currentReplayChar && (
                  <span className="absolute top-2.5 left-3 text-[11px] sm:text-xs font-serif font-bold text-amber-300/80 px-2 py-0.5 rounded-full bg-stone-900/70 border border-amber-600/30">
                    正在回放：「{currentReplayChar}」
                  </span>
                )}
              </div>

              {/* 进度条 */}
              <div className="w-full max-w-[min(340px,75vw)] mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3">
                <span className="text-xs text-stone-400 font-mono">
                  {Math.round(replayProgress * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.005"
                  value={replayProgress}
                  onChange={(e) => {
                    const prog = parseFloat(e.target.value);
                    setReplayProgress(prog);
                    if (replayerRef.current) {
                      replayerRef.current.seek(prog);
                    }
                  }}
                  className="flex-1 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
              </div>

              {/* 控制按钮与倍速 */}
              <div className="w-full max-w-[min(340px,75vw)] mt-2.5 sm:mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-800 hover:bg-amber-700 text-amber-50 text-xs font-medium transition-all shadow-md active:scale-95"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? '暂停' : '播放'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestart}
                    className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                    title="从头开始"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* 倍速选择 */}
                <div className="flex items-center gap-1 text-xs text-stone-400">
                  <Sparkles size={12} className="text-amber-500" />
                  <span>倍速：</span>
                  {[5, 10, 20].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => {
                        setReplaySpeed(spd);
                        if (replayerRef.current) {
                          replayerRef.current.setSpeed(spd);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        replaySpeed === spd
                          ? 'bg-amber-900 text-amber-200 border border-amber-600/40'
                          : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
