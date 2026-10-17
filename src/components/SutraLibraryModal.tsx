// ============================================================================
// 「静心抄经」藏经阁与功德簿模态框
// src/components/SutraLibraryModal.tsx
// 1. 藏经阁：内置四大经典经卷（心经、清静经、大学、吉祥经）+ 自建字帖（录入任意古诗家训）
// 2. 功德簿：累计抄写汉字总数、静心时长统计与历史作品会话画廊
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  SutraDocument,
  SessionSummary,
  PAPER_THEMES,
} from '../types/sutra';
import {
  BUILT_IN_SUTRAS,
  createCustomSutra,
  filterToChineseChars,
} from '../data/builtInSutras';
import {
  listSessionSummaries,
  getCustomSutras,
  saveCustomSutra,
  deleteSession,
  deleteCustomSutra,
} from '../db/localDb';
import {
  X,
  BookOpen,
  Award,
  Plus,
  Clock,
  Trash2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export interface SutraLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSutraId: string;
  onSelectSutra: (sutra: SutraDocument) => void;
  onResumeSession?: (sessionId: string) => void;
}

export const SutraLibraryModal: React.FC<SutraLibraryModalProps> = ({
  isOpen,
  onClose,
  currentSutraId,
  onSelectSutra,
  onResumeSession,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'records'>('library');

  // 自定义字帖状态
  const [customSutras, setCustomSutras] = useState<SutraDocument[]>([]);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [customRawText, setCustomRawText] = useState('');
  const [customError, setCustomError] = useState('');

  // 功德簿记录状态
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);

  // 加载自定义经文与历史记录
  useEffect(() => {
    if (!isOpen) return;

    getCustomSutras()
      .then(setCustomSutras)
      .catch((err) => console.warn('获取自定义经文失败:', err));

    listSessionSummaries()
      .then(setSummaries)
      .catch((err) => console.warn('获取功德簿记录失败:', err));
  }, [isOpen]);

  /**
   * 提交自建字帖
   */
  const handleCreateCustom = async () => {
    setCustomError('');
    try {
      const cleanChars = filterToChineseChars(customRawText);
      if (cleanChars.length === 0) {
        setCustomError('请输入包含有效汉字的文本');
        return;
      }

      const doc = createCustomSutra(customTitle, customAuthor, customRawText);
      await saveCustomSutra(doc);

      setCustomSutras((prev) => [doc, ...prev]);
      setIsCreatingCustom(false);
      setCustomTitle('');
      setCustomAuthor('');
      setCustomRawText('');

      // 直接选用新自建经文开卷
      onSelectSutra(doc);
      onClose();
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : '创建自定义经文失败');
    }
  };

  /**
   * 删除自定义字帖
   */
  const handleDeleteCustom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确认删除此自选字帖吗？')) return;

    await deleteCustomSutra(id);
    setCustomSutras((prev) => prev.filter((item) => item.id !== id));
  };

  /**
   * 删除历史会话
   */
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确认删除此条抄经记录吗？')) return;

    await deleteSession(sessionId);
    setSummaries((prev) => prev.filter((item) => item.sessionId !== sessionId));
  };

  if (!isOpen) return null;

  // 累计统计数据计算
  const totalCharactersWritten = summaries.reduce(
    (acc, cur) => acc + (cur.completedChars || 0),
    0
  );
  const totalDurationMinutes = Math.round(
    summaries.reduce((acc, cur) => acc + (cur.totalDurationSec || 0), 0) / 60
  );
  const completedCount = summaries.filter((item) => item.isFinished).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-serif select-none">
      <div className="relative w-full max-w-3xl bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-200">
        {/* 顶部标签切换 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'library'
                  ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <BookOpen size={16} />
              <span>藏经阁 (经典与字帖)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'records'
                  ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Award size={16} />
              <span>功德簿 (统计与画廊)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 主体视窗 */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {activeTab === 'library' ? (
            <div className="flex flex-col gap-6">
              {/* 内置名篇经卷 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-amber-400 tracking-wider">
                    内置传世经典
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/40 hover:bg-amber-800 text-amber-200 text-xs border border-amber-700/50 transition-all active:scale-95"
                  >
                    <Plus size={14} />
                    <span>自建新字帖</span>
                  </button>
                </div>

                {/* 自建字帖折叠表单 */}
                {isCreatingCustom && (
                  <div className="p-4 mb-4 bg-stone-800/60 rounded-2xl border border-amber-900/30 flex flex-col gap-3 animate-fade-in">
                    <span className="text-xs font-medium text-amber-300">
                      录入任意古诗词、座右铭或家训文本
                    </span>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="经卷标题（如：陋室铭）"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600 font-serif"
                      />
                      <input
                        type="text"
                        placeholder="作者/出处（如：唐·刘禹锡）"
                        value={customAuthor}
                        onChange={(e) => setCustomAuthor(e.target.value)}
                        className="w-1/3 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-600 font-serif"
                      />
                    </div>
                    <textarea
                      rows={3}
                      placeholder="粘贴正文内容（系统将自动剔除标点与空格，提取纯净汉字单字流）..."
                      value={customRawText}
                      onChange={(e) => setCustomRawText(e.target.value)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-600 resize-none font-serif leading-relaxed"
                    />

                    {customError && (
                      <span className="text-xs text-rose-400">{customError}</span>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-stone-400">
                        汉字统计：{filterToChineseChars(customRawText).length} 字
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingCustom(false)}
                          className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCustom}
                          className="px-4 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-700 text-amber-50 text-xs font-medium transition-all shadow-md active:scale-95"
                        >
                          生成长卷并开卷
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 内置经文卡片网格 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {BUILT_IN_SUTRAS.map((item) => {
                    const isSelected = item.id === currentSutraId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          onSelectSutra(item);
                          onClose();
                        }}
                        className={`group relative p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-600/70 shadow-lg ring-1 ring-amber-600/50'
                            : 'bg-stone-800/40 border-stone-700/60 hover:border-stone-500 hover:bg-stone-800/70'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-700/60 text-stone-300 font-sans text-[10px]">
                              {item.category}
                            </span>
                            <h4 className="text-base font-bold text-amber-100 mt-1.5 group-hover:text-amber-200 transition-colors tracking-wide">
                              {item.title}
                            </h4>
                            <p className="text-xs text-stone-400 mt-1">
                              {item.authorOrTranslator}
                            </p>
                          </div>

                          <span className="text-xs font-mono text-amber-400/80 bg-stone-900/60 px-2 py-1 rounded-lg">
                            {item.content.length} 字
                          </span>
                        </div>

                        {isSelected && (
                          <div className="absolute bottom-3 right-3 text-amber-500 flex items-center gap-1 text-xs">
                            <CheckCircle2 size={14} />
                            <span>当前正在抄写</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 用户自定义经卷 */}
              {customSutras.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-amber-400 tracking-wider mb-3">
                    自建字帖藏卷
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {customSutras.map((item) => {
                      const isSelected = item.id === currentSutraId;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            onSelectSutra(item);
                            onClose();
                          }}
                          className={`group relative p-4 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-950/40 border-amber-600/70 shadow-lg'
                              : 'bg-stone-800/40 border-stone-700/60 hover:border-stone-500 hover:bg-stone-800/70'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 font-sans text-[10px] border border-amber-800/40">
                                自建
                              </span>
                              <h4 className="text-base font-bold text-amber-100 mt-1.5 group-hover:text-amber-200 transition-colors">
                                {item.title}
                              </h4>
                              <p className="text-xs text-stone-400 mt-1">
                                {item.authorOrTranslator}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-amber-400/80 bg-stone-900/60 px-2 py-1 rounded-lg">
                                {item.content.length} 字
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustom(item.id, e)}
                                className="p-1 hover:text-rose-400 text-stone-500 transition-colors"
                                title="删除此自建帖"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 功德簿统计与历史会话 */
            <div className="flex flex-col gap-6">
              {/* 核心指标统计卡片 */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-700/50">
                  <span className="text-xs text-stone-400 block mb-1">累计敬写汉字</span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-300">
                    {totalCharactersWritten}
                  </span>
                  <span className="text-xs text-stone-500 block mt-0.5">字</span>
                </div>

                <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-700/50">
                  <span className="text-xs text-stone-400 block mb-1">累计静心修持</span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-300">
                    {totalDurationMinutes}
                  </span>
                  <span className="text-xs text-stone-500 block mt-0.5">分钟</span>
                </div>

                <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-700/50">
                  <span className="text-xs text-stone-400 block mb-1">圆满长卷经部</span>
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-300">
                    {completedCount}
                  </span>
                  <span className="text-xs text-stone-500 block mt-0.5">部</span>
                </div>
              </div>

              {/* 历史抄经记录列表 */}
              <div>
                <h3 className="text-sm font-medium text-amber-400 tracking-wider mb-3">
                  历史抄经功德画廊
                </h3>

                {summaries.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-sm">
                    尚无历史抄经记录，落笔生华，静心从第一笔开始。
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {summaries.map((s) => {
                      const paperCfg = PAPER_THEMES[s.paperTheme];
                      return (
                        <div
                          key={s.sessionId}
                          onClick={() => {
                            if (onResumeSession) {
                              onResumeSession(s.sessionId);
                              onClose();
                            }
                          }}
                          className="flex items-center justify-between p-3.5 bg-stone-800/40 hover:bg-stone-800/70 border border-stone-700/60 rounded-2xl cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-stone-500/50 flex-shrink-0"
                              style={{ backgroundColor: paperCfg?.bgColor }}
                              title={paperCfg?.name}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-amber-100 group-hover:text-amber-200">
                                  {s.sutraTitle}
                                </h4>
                                {s.isFinished && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    已圆满
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-stone-400 mt-1 font-sans">
                                <span>
                                  进度：{s.completedChars}/{s.totalChars} 字
                                </span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock size={11} />
                                  {Math.round(s.totalDurationSec / 60)} 分钟
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-400/80 group-hover:text-amber-200 flex items-center gap-0.5">
                              <span>进入</span>
                              <ArrowRight size={13} />
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(s.sessionId, e)}
                              className="p-1.5 hover:text-rose-400 text-stone-500 transition-colors ml-2"
                              title="删除记录"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
