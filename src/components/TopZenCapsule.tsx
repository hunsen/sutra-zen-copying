// ============================================================================
// 「静心抄经」顶部微光禅意胶囊导航栏
// src/components/TopZenCapsule.tsx
// 悬浮微光胶囊设计：
// 1. 书写运笔时自动淡隐降至 25% 不透明度，移入或停笔恢复，零视觉干扰
// 2. 纸墨主题快速切换（宣纸、磁青、红笺、竹纸）
// 3. 抄经进度与累计静心时长实时反馈
// 4. 音效静音控制、藏经阁与钤印导出入口
// ============================================================================

import React, { useState } from 'react';
import {
  PaperTheme,
  InkType,
  PAPER_THEMES,
  INK_COLORS,
  BRUSH_PRESETS,
} from '../types/sutra';
import {
  BookOpen,
  Palette,
  Volume2,
  VolumeX,
  Clock,
  Download,
  Scroll,
  Paintbrush,
} from 'lucide-react';

export interface TopZenCapsuleProps {
  /** 经文标题，如 "般若波罗蜜多心经" */
  title: string;
  /** 当前字序号 (0 ~ N - 1) */
  currentIndex: number;
  /** 总字数 (如 260) */
  totalChars: number;
  /** 当前纸张主题 */
  paperTheme: PaperTheme;
  /** 当前墨色类型 */
  inkType: InkType;
  /** 累计静心时长（秒） */
  durationSec: number;
  /** 是否正在运笔书写（用于触发自动淡隐） */
  isWriting?: boolean;
  /** 是否静音 */
  isMuted?: boolean;
  /** 当前毛笔粗细 (px) */
  brushThickness?: number;
  /** 切换纸张主题回调 */
  onSelectTheme: (theme: PaperTheme) => void;
  /** 切换墨色回调 */
  onSelectInk: (ink: InkType) => void;
  /** 调节毛笔粗细回调 */
  onSelectBrushThickness?: (thickness: number) => void;
  /** 静音切换回调 */
  onToggleMute: () => void;
  /** 点击藏经阁回调 */
  onOpenLibrary?: () => void;
  /** 点击导出长卷回调 */
  onOpenExport?: () => void;
}

/**
 * 格式化秒数为 00:00 或 00:00:00
 */
function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export const TopZenCapsule: React.FC<TopZenCapsuleProps> = ({
  title,
  currentIndex,
  totalChars,
  paperTheme,
  inkType,
  durationSec,
  isWriting = false,
  isMuted = false,
  brushThickness = 14,
  onSelectTheme,
  onSelectInk,
  onSelectBrushThickness,
  onToggleMute,
  onOpenLibrary,
  onOpenExport,
}) => {
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const percent =
    totalChars > 0
      ? Math.min(100, Math.round(((currentIndex + 1) / totalChars) * 100))
      : 0;

  return (
    <div
      className={`fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out max-w-[96vw] ${
        isWriting
          ? 'opacity-25 hover:opacity-100 hover:scale-100 scale-95'
          : 'opacity-100 scale-100'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 bg-stone-900/85 hover:bg-stone-900/95 backdrop-blur-xl border border-stone-700/60 shadow-2xl rounded-full text-stone-200 transition-colors">
        {/* 藏经阁入口 */}
        <button
          type="button"
          onClick={onOpenLibrary}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full hover:bg-stone-800 text-amber-200 hover:text-amber-100 transition-all font-serif text-xs sm:text-sm font-medium tracking-wide active:scale-95"
          title="藏经阁：选经、自建字帖与功德簿"
        >
          <BookOpen size={14} className="flex-shrink-0" />
          <span className="max-w-[65px] sm:max-w-[130px] truncate">{title}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-stone-700/80" />

        {/* 纸墨笔配置下拉触发 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-all font-serif text-xs active:scale-95"
            title="选择纸张古笺、墨色与笔触粗细"
          >
            <Palette size={13} className="text-amber-400 flex-shrink-0" />
            <span className="hidden sm:inline">
              {PAPER_THEMES[paperTheme]?.name} · {brushThickness}px
            </span>
          </button>

          {/* 纸墨笔参数弹出浮层 */}
          {showThemeMenu && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-stone-900/95 backdrop-blur-2xl border border-stone-700/80 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 font-serif animate-fade-in"
              onMouseLeave={() => setShowThemeMenu(false)}
            >
              <div>
                <span className="text-[11px] text-stone-400 tracking-wider">古典纸张</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {(Object.keys(PAPER_THEMES) as PaperTheme[]).map((thm) => {
                    const cfg = PAPER_THEMES[thm];
                    const active = thm === paperTheme;
                    return (
                      <button
                        key={thm}
                        type="button"
                        onClick={() => {
                          onSelectTheme(thm);
                          setShowThemeMenu(false);
                        }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs transition-all border ${
                          active
                            ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                            : 'bg-stone-800/60 border-transparent hover:border-stone-600 text-stone-300'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-stone-500/50 flex-shrink-0"
                          style={{ backgroundColor: cfg.bgColor }}
                        />
                        <span className="truncate">{cfg.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-stone-400 tracking-wider">传统墨色</span>
                <div className="flex gap-2 mt-1.5">
                  {(['black', 'gold', 'cinnabar'] as InkType[]).map((ink) => {
                    const active = ink === inkType;
                    const labels: Record<InkType, string> = {
                      black: '松烟墨',
                      gold: '泥金墨',
                      cinnabar: '朱砂墨',
                    };
                    return (
                      <button
                        key={ink}
                        type="button"
                        onClick={() => {
                          onSelectInk(ink);
                          setShowThemeMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs transition-all border ${
                          active
                            ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                            : 'bg-stone-800/60 border-transparent hover:border-stone-600 text-stone-300'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-stone-500/40"
                          style={{ backgroundColor: INK_COLORS[ink] }}
                        />
                        <span>{labels[ink]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 毛笔笔触粗细 */}
              {onSelectBrushThickness && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400 tracking-wider">
                    <span className="flex items-center gap-1">
                      <Paintbrush size={11} className="text-amber-400" />
                      <span>笔触粗细</span>
                    </span>
                    <span className="text-amber-300 font-mono">{brushThickness}px</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-1.5">
                    {BRUSH_PRESETS.map((bp) => {
                      const active = brushThickness === bp.thickness;
                      return (
                        <button
                          key={bp.id}
                          type="button"
                          onClick={() => onSelectBrushThickness(bp.thickness)}
                          className={`py-1 px-1 rounded-lg text-xs transition-all border flex flex-col items-center justify-center ${
                            active
                              ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                              : 'bg-stone-800/60 border-transparent hover:border-stone-700 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <span className="font-medium text-[11px] leading-tight">{bp.name}</span>
                          <span className="text-[9px] text-stone-500 mt-0.5">{bp.thickness}px</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-[1px] h-3.5 bg-stone-700/80" />

        {/* 抄经进度指示 */}
        <div className="flex items-center gap-1 text-[11px] sm:text-xs text-stone-300 font-serif whitespace-nowrap">
          <Scroll size={12} className="text-amber-400 hidden sm:inline flex-shrink-0" />
          <span>
            {Math.min(currentIndex + 1, totalChars)}/{totalChars}
          </span>
          <span className="text-stone-400 text-[10px] hidden xs:inline">({percent}%)</span>
        </div>

        {/* 静心计时器（大屏展示，手机端紧凑布局） */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-stone-300 font-serif">
          <div className="w-[1px] h-3.5 bg-stone-700/80 mr-1" />
          <Clock size={12} className="text-amber-400/80 flex-shrink-0" />
          <span className="font-mono text-[11px] tracking-wider text-amber-100">
            {formatDuration(durationSec)}
          </span>
        </div>

        <div className="w-[1px] h-3.5 bg-stone-700/80" />

        {/* 音效开关 */}
        <button
          type="button"
          onClick={onToggleMute}
          className="p-1 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          title={isMuted ? '解除静音' : '禅音静音'}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* 卷尾装裱与导出长图 */}
        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-800/80 hover:bg-amber-700 text-amber-50 font-serif text-xs font-medium transition-all shadow-sm active:scale-95 whitespace-nowrap"
          title="钤印落款与长卷高清导出"
        >
          <Download size={12} />
          <span className="hidden sm:inline">钤印导出</span>
        </button>
      </div>
    </div>
  );
};
