// ============================================================================
// 「静心抄经」装裱钤印与长卷高清导出模态框
// src/components/SealAndExportModal.tsx
// 1. 自定义 2~4 字传统朱文/白文篆刻方印与回向文模板
// 2. 高清装裱长卷 PNG 一键合成并下载
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SutraDocument,
  WrittenCharRecord,
  PaperTheme,
  InkType,
  SealConfig,
} from '../types/sutra';
import {
  DEDICATION_TEMPLATES,
  toTraditional,
} from '../data/builtInSutras';
import {
  downloadScrollImage,
  drawSealOnCanvas,
} from '../engine/ScrollExporter';
import {
  X,
  Download,
  Stamp,
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
  initialDedicationText = '願以此功德，普及於一切，我等與眾生，皆共成佛道。',
  initialSealText = '靜心',
  onSaveSealAndDedication,
}) => {
  // 鈐印與回向文設置
  const [sealText, setSealText] = useState(toTraditional(initialSealText) || '靜心');
  const [sealStyle, setSealStyle] = useState<'bai' | 'zhu'>('bai');
  const [dedicationText, setDedicationText] = useState(toTraditional(initialDedicationText));
  const [isExporting, setIsExporting] = useState(false);

  // 印章實時預覽 Canvas
  const sealCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 繪製印章微縮預覽（古代印章篆體自適應）
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
      text: toTraditional(sealText) || '靜心',
      style: sealStyle,
      shape: 'square',
      roughness: 0.2,
    };

    drawSealOnCanvas(ctx, 4, 4, size - 8, cfg);
  }, [sealText, sealStyle]);

  // 當模態框打開或者印章文字/樣式變更時均重新繪製
  useEffect(() => {
    if (isOpen) {
      if (document.fonts) {
        document.fonts.ready.then(() => renderSeal());
      }
      renderSeal();
      const raf = requestAnimationFrame(() => renderSeal());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, renderSeal]);

  // 當模態框重新開啟時同步最新的印章與回向文
  useEffect(() => {
    if (isOpen) {
      setSealText(toTraditional(initialSealText) || '靜心');
      setDedicationText(toTraditional(initialDedicationText));
    }
  }, [isOpen, initialSealText, initialDedicationText]);

  /**
   * 執行高清裝裱長卷 PNG 下載
   */
  const handleDownload = () => {
    setIsExporting(true);

    const finalDedication = toTraditional(dedicationText);
    const finalSeal = toTraditional(sealText) || '靜心';

    if (onSaveSealAndDedication) {
      onSaveSealAndDedication(finalDedication, finalSeal);
    }

    // 延時讓 UI 給予點擊反饋
    window.setTimeout(() => {
      try {
        downloadScrollImage({
          sutra,
          writtenChars,
          paperTheme,
          inkType,
          dedicationText: finalDedication,
          sealConfig: {
            text: finalSeal,
            style: sealStyle,
            shape: 'square',
            roughness: 0.2,
          },
          scale: 2.0, // 2x 超清印刷級長卷
        });
      } catch (err) {
        console.error('導出長圖失敗:', err);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 animate-fade-in font-serif select-none">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 pt-3.5 sm:pt-5 pb-2.5 sm:pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2 text-amber-200 font-serif font-medium text-sm sm:text-base">
            <Stamp size={16} />
            <span>装裱钤印与长卷导出</span>
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
          <div className="flex flex-col gap-5">
            {/* 印章配置 */}
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center bg-stone-800/40 p-4 rounded-2xl border border-stone-700/40">
              <div className="flex flex-col items-center">
                <span className="text-xs text-stone-400 mb-2">印章實景預覽</span>
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
                    篆刻印文（1~4字，小篆自適應佈局）
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={sealText}
                    onChange={(e) => setSealText(toTraditional(e.target.value).slice(0, 4))}
                    placeholder="輸入印文，例如：靜、靜心、清淨心、吉祥如意"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-sm text-stone-100 focus:outline-none focus:border-amber-600 transition-colors"
                  />
                </div>

                <div>
                  <span className="text-xs text-stone-400 block mb-1.5">
                    印章形制
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSealStyle('bai')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                        sealStyle === 'bai'
                          ? 'bg-amber-900/60 border-amber-600 text-amber-200 shadow-sm'
                          : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      白文（陰刻·紅底白字）
                    </button>
                    <button
                      type="button"
                      onClick={() => setSealStyle('zhu')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                        sealStyle === 'zhu'
                          ? 'bg-amber-900/60 border-amber-600 text-amber-200 shadow-sm'
                          : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      朱文（陽刻·白底紅字）
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 回向文配置 */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-200">
                  卷尾發願回向文
                </span>
                <span className="text-[11px] text-stone-400">
                  可直接選用經典回向偈，或自定善願
                </span>
              </div>

              {/* 常用回向文模板快捷选择 */}
              <div className="flex flex-wrap gap-1.5">
                {DEDICATION_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDedicationText(tmpl)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all truncate max-w-[200px] ${
                      dedicationText === tmpl
                        ? 'bg-amber-900/50 border-amber-600 text-amber-200'
                        : 'bg-stone-800/40 border-stone-700 text-stone-400 hover:text-stone-300'
                    }`}
                  >
                    {tmpl}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={dedicationText}
                onChange={(e) => setDedicationText(e.target.value)}
                placeholder="願以此抄經功德，回向一切眾生，平安喜樂..."
                className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-xs text-stone-200 leading-relaxed focus:outline-none focus:border-amber-600 transition-colors resize-none"
              />
            </div>

            {/* 导出说明与按钮 */}
            <div className="mt-2 pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-stone-400">
                <span>長卷尺寸：超清裝裱畫幅（2x 縮放，內含烏絲欄與全部矢量筆跡）</span>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isExporting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-50 font-medium text-sm tracking-wider shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                <Download size={16} />
                <span>{isExporting ? '長卷裝裱合成中...' : '下載裝裱長卷 PNG'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
