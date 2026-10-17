// ============================================================================
// 「静心抄经」主应用程序与自适应双区联动容器
// src/App.tsx
// 1. 适配小米 Pad 5 (16:10, 2560x1600) 与横竖屏双模式响应式架构
// 2. 左区（60% 全景竖排手卷） + 右区（40% 放大米字格书写台）实时联动
// 3. 顶部微光胶囊导航栏（书写时自动隐退）
// 4. 完整的仪式闭环：焚香调息仪式 + 藏经阁/功德簿 + 钤印落款与超清长卷导出/笔迹倍速回放
// 5. IndexedDB 离线会话全自动恢复与毫秒级持久化，纯原生 Web Audio 禅意氛围
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CopyingSession,
  WrittenCharRecord,
  PaperTheme,
  InkType,
  SutraDocument,
  PAPER_THEMES,
  BrushStroke,
} from './types/sutra';

const EMPTY_STROKES: BrushStroke[] = [];
import { BUILT_IN_SUTRAS, getSutraById } from './data/builtInSutras';
import {
  getLastActiveSession,
  saveSession,
  saveWrittenChar,
  findSutraById,
  getSession,
} from './db/localDb';
import { zenAudio } from './engine/ZenAudioEngine';
import { SutraScrollCanvas } from './components/SutraScrollCanvas';
import { ZoomWritingPad } from './components/ZoomWritingPad';
import { TopZenCapsule } from './components/TopZenCapsule';
import { IncenseRitualModal } from './components/IncenseRitualModal';
import { SealAndExportModal } from './components/SealAndExportModal';
import { SutraLibraryModal } from './components/SutraLibraryModal';
import { Maximize2, Minimize2 } from 'lucide-react';

export const App: React.FC = () => {
  // 当前抄经经文
  const [sutra, setSutra] = useState<SutraDocument>(
    getSutraById('heart-sutra') || BUILT_IN_SUTRAS[0]
  );

  // 抄经会话核心状态
  const [sessionId, setSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [paperTheme, setPaperTheme] = useState<PaperTheme>('xuan');
  const [inkType, setInkType] = useState<InkType>('black');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [writtenChars, setWrittenChars] = useState<Record<number, WrittenCharRecord>>({});
  const [dedicationText, setDedicationText] = useState<string>(
    '愿以此功德，普及于一切，我等与众生，皆共成佛道。'
  );
  const [sealText, setSealText] = useState<string>('静心');
  const [durationSec, setDurationSec] = useState<number>(0);

  // 毛笔笔触粗细（默认 14px 兼毫中楷，支持本地持久化存储）
  const [brushThickness, setBrushThickness] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sutra_brush_thickness');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 6 && val <= 32) {
          return val;
        }
      }
    }
    return 14;
  });

  const handleBrushThicknessChange = useCallback((thickness: number) => {
    setBrushThickness(thickness);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sutra_brush_thickness', String(thickness));
    }
  }, []);

  // 交互态反馈
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // 三大模态框显隐控制
  const [showIncenseModal, setShowIncenseModal] = useState<boolean>(true); // 首次进入引导开卷焚香
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showLibraryModal, setShowLibraryModal] = useState<boolean>(false);

  // 手机窄屏竖排手卷全屏展开模式
  const [isScrollExpandedMobile, setIsScrollExpandedMobile] = useState<boolean>(false);

  // 保持会话起始时间稳定
  const startedAtRef = useRef<number>(Date.now());

  // 实时单字笔迹同步至全景画卷
  const [liveStrokes, setLiveStrokes] = useState<BrushStroke[]>(EMPTY_STROKES);

  // 保持对最新状态的引用以供定期持久化，杜绝计时器频繁重启
  const stateRef = useRef({
    sessionId,
    sutra,
    paperTheme,
    inkType,
    writtenChars,
    currentIndex,
    dedicationText,
    sealText,
    durationSec,
  });
  stateRef.current = {
    sessionId,
    sutra,
    paperTheme,
    inkType,
    writtenChars,
    currentIndex,
    dedicationText,
    sealText,
    durationSec,
  };

  /**
   * 初始化：从 IndexedDB 恢复上一次未完成的抄经进度
   */
  useEffect(() => {
    let isSubscribed = true;

    getLastActiveSession()
      .then(async (lastSession) => {
        if (!isSubscribed) return;

        if (lastSession) {
          setSessionId(lastSession.sessionId);
          setPaperTheme(lastSession.paperTheme || 'xuan');
          setInkType(lastSession.inkType || 'black');
          setCurrentIndex(lastSession.currentIndex || 0);
          setWrittenChars(lastSession.writtenChars || {});
          setLiveStrokes(lastSession.writtenChars?.[lastSession.currentIndex || 0]?.strokes ?? EMPTY_STROKES);
          setDedicationText(
            lastSession.dedicationText ||
              '愿以此功德，普及于一切，我等与众生，皆共成佛道。'
          );
          setSealText(lastSession.sealText || '静心');
          setDurationSec(lastSession.totalDurationSec || 0);
          startedAtRef.current = lastSession.startedAt || Date.now();

          // 恢复经文
          if (lastSession.sutraId) {
            const foundSutra = await findSutraById(lastSession.sutraId);
            if (foundSutra && isSubscribed) {
              setSutra(foundSutra);
            }
          }
        } else {
          // 初始化默认心经会话
          const initialSessionId = `session-${Date.now()}`;
          const now = Date.now();
          setSessionId(initialSessionId);
          startedAtRef.current = now;

          const initialSession: CopyingSession = {
            sessionId: initialSessionId,
            sutraId: 'heart-sutra',
            paperTheme: 'xuan',
            inkType: 'black',
            writtenChars: {},
            currentIndex: 0,
            dedicationText: '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
            sealText: '静心',
            startedAt: now,
            totalDurationSec: 0,
            lastActiveAt: now,
          };
          saveSession(initialSession).catch((err) =>
            console.warn('初始化会话存储异常:', err)
          );
        }
      })
      .catch((err) => {
        console.warn('读取上次进度失败，使用默认配置:', err);
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoaded(true);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  /**
   * 静心计时器：每秒更新
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  /**
   * 会话状态持久化（读取 stateRef，避免闭包捕获与计时器雪崩）
   */
  const persistSession = useCallback((overrides?: Partial<CopyingSession>) => {
    const cur = stateRef.current;
    const sessionToSave: CopyingSession = {
      sessionId: cur.sessionId,
      sutraId: cur.sutra.id,
      paperTheme: cur.paperTheme,
      inkType: cur.inkType,
      writtenChars: cur.writtenChars,
      currentIndex: cur.currentIndex,
      dedicationText: cur.dedicationText,
      sealText: cur.sealText,
      startedAt: startedAtRef.current,
      totalDurationSec: cur.durationSec,
      lastActiveAt: Date.now(),
      ...overrides,
    };

    saveSession(sessionToSave).catch((err) =>
      console.warn('定期保存会话异常:', err)
    );
  }, []);

  // 每 15 秒自动同步一次会话统计到 IndexedDB（单例平稳触发）
  useEffect(() => {
    if (!isLoaded) return;

    const timer = window.setInterval(() => {
      persistSession();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isLoaded, persistSession]);

  /**
   * 单字书写完成（自动走纸或手动确认）回调处理
   */
  const handleCharComplete = useCallback(
    (record: WrittenCharRecord) => {
      const nextWritten = {
        ...writtenChars,
        [record.charIndex]: record,
      };
      setWrittenChars(nextWritten);
      setLiveStrokes(EMPTY_STROKES);

      // 增量持久化单字笔迹到 IndexedDB
      saveWrittenChar(sessionId, record).catch((err) =>
        console.warn('写入单字字迹记录失败:', err)
      );

      // 平滑推进到下一字
      if (currentIndex < sutra.content.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // 全篇圆满，播放铜磬长余音，并弹窗提示导出长卷
        zenAudio.playSingingBowl(6.0, 432);
        setShowExportModal(true);
        persistSession({
          completedAt: Date.now(),
          writtenChars: nextWritten,
        });
      }
    },
    [currentIndex, persistSession, sessionId, sutra.content.length, writtenChars]
  );

  /**
   * 用户在左侧全景长卷中点击任意字格直接跳转
   */
  const handleSelectChar = useCallback(
    (targetIndex: number) => {
      setCurrentIndex(targetIndex);
      setLiveStrokes(writtenChars[targetIndex]?.strokes ?? EMPTY_STROKES);
    },
    [writtenChars]
  );

  /**
   * 切换纸张主题
   */
  const handleSelectTheme = (newTheme: PaperTheme) => {
    setPaperTheme(newTheme);
    const recommendedInk = PAPER_THEMES[newTheme]?.recommendedInkColor;
    if (recommendedInk === '#E6C17A') {
      setInkType('gold');
    } else if (recommendedInk === '#F5D076') {
      setInkType('gold');
    } else {
      setInkType('black');
    }
  };

  /**
   * 切换墨色
   */
  const handleSelectInk = (newInk: InkType) => {
    setInkType(newInk);
  };

  /**
   * 音效静音切换
   */
  const handleToggleMute = () => {
    const next = zenAudio.toggleMute();
    setIsMuted(next);
  };

  /**
   * 切换当前经文
   */
  const handleSelectSutra = (newSutra: SutraDocument) => {
    setSutra(newSutra);
    setCurrentIndex(0);
    setWrittenChars({});
    setLiveStrokes(EMPTY_STROKES);
    setDurationSec(0);
    const now = Date.now();
    startedAtRef.current = now;
    const newSessionId = `session-${now}`;
    setSessionId(newSessionId);

    const initialSession: CopyingSession = {
      sessionId: newSessionId,
      sutraId: newSutra.id,
      paperTheme,
      inkType,
      writtenChars: {},
      currentIndex: 0,
      dedicationText,
      sealText,
      startedAt: now,
      totalDurationSec: 0,
      lastActiveAt: now,
    };
    saveSession(initialSession).catch(console.warn);
  };

  /**
   * 恢复历史会话
   */
  const handleResumeSession = async (resumedSessionId: string) => {
    try {
      const s = await getSession(resumedSessionId);
      if (!s) return;

      setSessionId(s.sessionId);
      setPaperTheme(s.paperTheme || 'xuan');
      setInkType(s.inkType || 'black');
      setCurrentIndex(s.currentIndex || 0);
      setWrittenChars(s.writtenChars || {});
      setLiveStrokes(s.writtenChars?.[s.currentIndex || 0]?.strokes ?? EMPTY_STROKES);
      setDedicationText(s.dedicationText || dedicationText);
      setSealText(s.sealText || sealText);
      setDurationSec(s.totalDurationSec || 0);
      startedAtRef.current = s.startedAt || Date.now();

      const foundSutra = await findSutraById(s.sutraId);
      if (foundSutra) {
        setSutra(foundSutra);
      }
    } catch (err) {
      console.warn('恢复历史会话失败:', err);
    }
  };

  // 模态框关闭处理记忆化，防止每秒倒计时触发重渲染
  const handleCloseIncense = useCallback(() => setShowIncenseModal(false), []);
  const handleCloseExport = useCallback(() => setShowExportModal(false), []);
  const handleCloseLibrary = useCallback(() => setShowLibraryModal(false), []);
  const handleOpenLibrary = useCallback(() => setShowLibraryModal(true), []);
  const handleOpenExport = useCallback(() => setShowExportModal(true), []);

  const currentChar = sutra.content[currentIndex] || '观';
  const initialStrokesForCurrent = writtenChars[currentIndex]?.strokes ?? EMPTY_STROKES;
  const themeBgColor = PAPER_THEMES[paperTheme]?.bgColor || '#F4EFE6';

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col font-serif select-none transition-colors duration-700"
      style={{ backgroundColor: themeBgColor }}
      onPointerDown={() => {
        // 全局唤醒 Web Audio
        zenAudio.ensureContext();
      }}
    >
      {/* 顶部微光禅意胶囊导航栏 */}
      <TopZenCapsule
        title={sutra.title}
        currentIndex={currentIndex}
        totalChars={sutra.content.length}
        paperTheme={paperTheme}
        inkType={inkType}
        durationSec={durationSec}
        isWriting={isWriting}
        isMuted={isMuted}
        brushThickness={brushThickness}
        onSelectTheme={handleSelectTheme}
        onSelectInk={handleSelectInk}
        onSelectBrushThickness={handleBrushThicknessChange}
        onToggleMute={handleToggleMute}
        onOpenLibrary={handleOpenLibrary}
        onOpenExport={handleOpenExport}
      />

      {/* 主工作区：响应式双区联动布局（适配移动端横竖屏与桌面/平板双模式） */}
      <main className="w-full h-full flex flex-col landscape:flex-row lg:flex-row pt-12 sm:pt-14 pb-1 sm:pb-2 px-1.5 sm:px-4 gap-1.5 sm:gap-4 overflow-hidden">
        {/* 左区：竖排从右至左全景手卷预览与浏览区（宽屏下占满全部剩余宽度，全屏模式下占满 100%） */}
        <section
          className={`relative rounded-xl sm:rounded-2xl overflow-hidden border border-stone-800/20 shadow-inner flex items-center justify-center p-1 sm:p-2 transition-all duration-300 ${
            isScrollExpandedMobile
              ? 'flex-1 w-full h-full'
              : 'flex-none h-[26vh] min-h-[145px] max-h-[200px] landscape:h-full landscape:flex-1 landscape:w-auto lg:h-full lg:flex-1 lg:w-auto'
          }`}
          style={{
            background:
              'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.05) 100%)',
          }}
        >
          {/* 全屏展开长卷 / 返回临摹快捷胶囊（全设备通用） */}
          <button
            type="button"
            onClick={() => setIsScrollExpandedMobile(!isScrollExpandedMobile)}
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-stone-900/85 hover:bg-stone-800 backdrop-blur-md border border-stone-700/60 text-[11px] sm:text-xs font-serif text-amber-200 hover:text-amber-100 transition-all active:scale-95 shadow-md"
            title={isScrollExpandedMobile ? '收起长卷，返回书写台' : '全屏展开浏览整篇长卷'}
          >
            {isScrollExpandedMobile ? (
              <>
                <Minimize2 size={13} />
                <span>返回临摹</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} />
                <span>全屏长卷</span>
              </>
            )}
          </button>

          <SutraScrollCanvas
            content={sutra.content}
            title={sutra.title}
            authorOrTranslator={sutra.authorOrTranslator}
            writtenChars={writtenChars}
            currentIndex={currentIndex}
            liveStrokes={liveStrokes}
            paperTheme={paperTheme}
            inkType={inkType}
            dedicationText={dedicationText}
            sealText={sealText}
            onSelectChar={(targetIndex) => {
              handleSelectChar(targetIndex);
              // 手机竖屏如果在长卷全景中点了某个字，自动收起切回书写
              if (isScrollExpandedMobile) {
                setIsScrollExpandedMobile(false);
              }
            }}
          />
        </section>

        {/* 右区：黄金落笔区——手指专属放大米字格书写台（宽屏下紧凑停靠 ~410px，留出最大区域给长卷） */}
        <section
          className={`flex flex-col items-center justify-center relative p-1 sm:p-4 overflow-hidden transition-all duration-300 ${
            isScrollExpandedMobile
              ? 'hidden'
              : 'flex-1 min-h-0 landscape:h-full landscape:flex-none landscape:w-[410px] xl:w-[440px] lg:h-full lg:flex-none lg:w-[420px]'
          }`}
        >
          <ZoomWritingPad
            currentChar={currentChar}
            charIndex={currentIndex}
            totalChars={sutra.content.length}
            paperTheme={paperTheme}
            inkType={inkType}
            sessionId={sessionId}
            initialStrokes={initialStrokesForCurrent}
            brushThickness={brushThickness}
            onBrushThicknessChange={handleBrushThicknessChange}
            onStrokesChange={setLiveStrokes}
            onWritingChange={setIsWriting}
            onCharComplete={handleCharComplete}
            onPrevChar={() => {
              if (currentIndex > 0) {
                const nextIdx = currentIndex - 1;
                setCurrentIndex(nextIdx);
                setLiveStrokes(writtenChars[nextIdx]?.strokes ?? EMPTY_STROKES);
              }
            }}
            onNextChar={() => {
              if (currentIndex < sutra.content.length - 1) {
                const nextIdx = currentIndex + 1;
                setCurrentIndex(nextIdx);
                setLiveStrokes(writtenChars[nextIdx]?.strokes ?? EMPTY_STROKES);
              }
            }}
          />
        </section>
      </main>

      {/* 仪式感与功能模态框 */}

      {/* 1. 开卷焚香调息仪式 */}
      <IncenseRitualModal
        isOpen={showIncenseModal}
        onComplete={handleCloseIncense}
        onSkip={handleCloseIncense}
      />

      {/* 2. 钤印落款、回向文与高清长卷导出 / 笔迹倍速回放 */}
      <SealAndExportModal
        isOpen={showExportModal}
        onClose={handleCloseExport}
        sutra={sutra}
        writtenChars={writtenChars}
        paperTheme={paperTheme}
        inkType={inkType}
        initialDedicationText={dedicationText}
        initialSealText={sealText}
        onSaveSealAndDedication={(newDedication, newSeal) => {
          setDedicationText(newDedication);
          setSealText(newSeal);
          persistSession({
            dedicationText: newDedication,
            sealText: newSeal,
          });
        }}
      />

      {/* 3. 藏经阁（选经与自建字帖）与功德簿 */}
      <SutraLibraryModal
        isOpen={showLibraryModal}
        onClose={handleCloseLibrary}
        currentSutraId={sutra.id}
        onSelectSutra={handleSelectSutra}
        onResumeSession={handleResumeSession}
      />
    </div>
  );
};
