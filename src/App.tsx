// ============================================================================
// 「静心抄经」主应用程序与自适应双区联动容器
// src/App.tsx
// 1. 适配小米 Pad 5 (16:10, 2560x1600) 与横竖屏双模式响应式架构
// 2. 左区（60% 全景竖排手卷） + 右区（40% 放大米字格书写台）实时联动
// 3. 顶部微光胶囊导航栏（书写时自动隐退）
// 4. 完整的仪式闭环：焚香调息仪式 + 藏经阁/功德簿 + 钤印落款与超清长卷导出
// 5. IndexedDB 离线会话全自动恢复与毫秒级持久化，纯原生 Web Audio 禅意氛围
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
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

  const [liveStrokes, setLiveStrokes] = useState<BrushStroke[]>(EMPTY_STROKES);
  const [completedAt, setCompletedAt] = useState<number | undefined>(undefined);

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
    completedAt,
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
    completedAt,
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
          setCompletedAt(lastSession.completedAt);
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
      completedAt: cur.completedAt,
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
   * 当前书写台笔画实时同步（保证未提交笔画、撤销与清空与会话状态实时一致，杜绝覆盖与幽灵笔迹）
   */
  const handleStrokesChange = useCallback(
    (strokes: BrushStroke[]) => {
      setLiveStrokes(strokes);
      setWrittenChars((prev) => {
        const existing = prev[currentIndex];
        if (strokes.length === 0) {
          if (!existing) return prev;
          const next = { ...prev };
          delete next[currentIndex];
          return next;
        }
        return {
          ...prev,
          [currentIndex]: {
            charIndex: currentIndex,
            character: sutra.content[currentIndex] || '',
            strokes: [...strokes],
            updatedAt: Date.now(),
          },
        };
      });
    },
    [currentIndex, sutra.content]
  );

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

      // 严格检查全篇是否真正圆满：必须每一个字索引都至少有一笔
      const totalChars = sutra.content.length;
      const isAllCharsFinished =
        totalChars > 0 &&
        Array.from({ length: totalChars }, (_, i) => i).every(
          (i) => (nextWritten[i]?.strokes?.length ?? 0) > 0
        );

      if (currentIndex < totalChars - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setLiveStrokes(nextWritten[nextIdx]?.strokes ?? EMPTY_STROKES);
      } else if (isAllCharsFinished) {
        // 全篇所有汉字均抄写完毕，圆满结卷
        const now = Date.now();
        setCompletedAt(now);
        zenAudio.playSingingBowl(6.0, 432);
        setShowExportModal(true);
        persistSession({
          completedAt: now,
          writtenChars: nextWritten,
        });
      } else {
        // 到达末字但尚有未写全的缺字：仅持久化当前字笔画，不伪造全篇圆满标记
        persistSession({
          writtenChars: nextWritten,
        });
      }
    },
    [currentIndex, persistSession, sessionId, sutra.content, writtenChars]
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
    setCompletedAt(undefined);
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
      setCompletedAt(s.completedAt);
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
  const handleOpenIncense = useCallback(() => setShowIncenseModal(true), []);
  const handleCloseExport = useCallback(() => setShowExportModal(false), []);
  const handleCloseLibrary = useCallback(() => setShowLibraryModal(false), []);
  const handleOpenLibrary = useCallback(() => setShowLibraryModal(true), []);
  const handleOpenExport = useCallback(() => setShowExportModal(true), []);

  const currentChar = sutra.content[currentIndex] || '观';
  const initialStrokesForCurrent = writtenChars[currentIndex]?.strokes ?? EMPTY_STROKES;
  const themeBgColor = PAPER_THEMES[paperTheme]?.bgColor || '#F4EFE6';
  const isDarkTheme = paperTheme === 'ciqing' || paperTheme === 'red-gold';

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col font-serif select-none transition-colors duration-700"
      style={{ backgroundColor: themeBgColor }}
      onPointerDown={() => {
        // 全局唤醒 Web Audio
        zenAudio.ensureContext();
      }}
    >
      {/* 移动端 WebFont 预热隐藏节点：强制 iOS WebKit / Android Blink 立即下载并栅格化楷体与篆体字形 */}
      <div
        aria-hidden="true"
        className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none select-none"
      >
        <span style={{ fontFamily: '"ZenKai", serif', fontWeight: 'normal' }}>
          觀自在菩薩行深般若波羅蜜多時照見五蘊皆空度一切苦厄
        </span>
        <span style={{ fontFamily: '"ZenKai", serif', fontWeight: 'bold' }}>
          般若波羅蜜多心經唐玄奘法師譯
        </span>
        <span style={{ fontFamily: '"AncientSeal", serif', fontWeight: 'normal' }}>
          靜心吉祥如意
        </span>
      </div>

      {/* 禅房书案暖光与四周柔和景深晕影 */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
        style={{
          background: isDarkTheme
            ? 'radial-gradient(circle at 50% 42%, rgba(212, 175, 55, 0.07) 0%, rgba(0, 0, 0, 0.28) 100%)'
            : 'radial-gradient(circle at 50% 42%, rgba(255, 248, 232, 0.32) 0%, rgba(65, 48, 30, 0.09) 100%)',
        }}
      />

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
        onOpenIncense={handleOpenIncense}
      />

      {/* 主工作区：响应式双区联动布局（适配移动端横竖屏与桌面/平板双模式） */}
      <main className="relative z-10 w-full h-full flex flex-col landscape:flex-row lg:flex-row pt-12 sm:pt-14 pb-1 sm:pb-2 px-1.5 sm:px-4 gap-1.5 sm:gap-4 overflow-hidden">
        {/* 左区：竖排从右至左全景手卷预览与浏览区（宽屏下解除最大高度，占满全部剩余空间） */}
        <motion.section
          initial={{ opacity: 0, x: -16, scale: 0.985 }}
          animate={{
            opacity: 1,
            x: 0,
            scale: showIncenseModal ? 0.985 : 1,
          }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className={`relative rounded-xl sm:rounded-2xl overflow-hidden border border-stone-800/20 shadow-inner flex items-center justify-center p-1 sm:p-2 transition-colors duration-300 ${
            isScrollExpandedMobile
              ? 'flex-1 w-full h-full'
              : 'flex-none h-[26vh] min-h-[145px] max-h-[200px] landscape:h-full landscape:min-h-0 landscape:max-h-none landscape:flex-1 landscape:w-auto lg:h-full lg:min-h-0 lg:max-h-none lg:flex-1 lg:w-auto'
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
        </motion.section>

        {/* 右区：黄金落笔区——手指专属放大米字格书写台（宽屏下紧凑停靠 ~410px，留出最大区域给长卷） */}
        <motion.section
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: showIncenseModal ? 0.985 : 1,
          }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col items-center justify-center relative p-1 sm:p-4 overflow-x-hidden overflow-y-auto no-scrollbar transition-colors duration-300 ${
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
            onStrokesChange={handleStrokesChange}
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
        </motion.section>
      </main>

      {/* 仪式感与功能模态框 */}

      {/* 1. 开卷焚香调息仪式 */}
      <IncenseRitualModal
        isOpen={showIncenseModal}
        onComplete={handleCloseIncense}
        onSkip={handleCloseIncense}
      />

      {/* 2. 钤印落款、回向文与高清长卷导出 */}
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
