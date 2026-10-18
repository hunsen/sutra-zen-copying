// ============================================================================
// 「静心抄经」开卷焚香调息仪式模态框（大师级禅意视觉与流体烟云动效）
// src/components/IncenseRitualModal.tsx
// 1. 伴随 432Hz 空灵铜磬长泛音 (playSingingBowl)
// 2. 高清 DPR 宣德铜炉、呼吸余烬、流云丝带青烟与微尘金屑粒子动画
// 3. 经典三次禅意呼吸引导（吸气 -> 屏息 -> 呼气），多层水波同心光环与 SVG 进度轨
// 4. Framer Motion 云雾消散退场与层次入场，支持随时一键跳过直接开卷
// ============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { zenAudio } from '../engine/ZenAudioEngine';
import { X, ChevronRight, Wind } from 'lucide-react';

export interface IncenseRitualModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale';

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  curve: number;
  band: number;
}

interface GoldMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phaseOffset: number;
  baseAlpha: number;
}

const PHASE_META: Record<
  BreathPhase,
  { title: string; subtitle: string; rhythmLabel: string }
> = {
  inhale: {
    title: '深吸 · 收摄心神',
    subtitle: '鼻端引气，澄心如镜',
    rhythmLabel: '吸气四息',
  },
  hold: {
    title: '屏息 · 杂念澄澈',
    subtitle: '气息凝定，万籁俱寂',
    rhythmLabel: '住息二息',
  },
  exhale: {
    title: '慢呼 · 万缘放下',
    subtitle: '徐徐吐纳，尘劳俱泯',
    rhythmLabel: '呼气四息',
  },
};

export const IncenseRitualModal: React.FC<IncenseRitualModalProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  // 呼吸状态：第几次呼吸 (1, 2, 3) 与当前相位
  const [breathCount, setBreathCount] = useState(1);
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [phaseProgress, setPhaseProgress] = useState(0); // 0.0 ~ 1.0

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<BreathPhase>('inhale');
  const progressRef = useRef<number>(0);

  phaseRef.current = phase;
  progressRef.current = phaseProgress;

  // 烟雾与金屑粒子系统
  const smokeParticlesRef = useRef<SmokeParticle[]>([]);
  const goldMotesRef = useRef<GoldMote[]>([]);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 呼吸引导循环时序 (吸气 4s -> 屏息 2s -> 呼气 4s，三次完整呼吸)
  useEffect(() => {
    if (!isOpen) return;

    setBreathCount(1);
    setPhase('inhale');
    setPhaseProgress(0);

    // 首次敲击铜磬
    zenAudio.playSingingBowl(5.5, 432);

    let timer: number;
    let startTime = performance.now();
    let currentPhase: BreathPhase = 'inhale';
    let currentBreath = 1;

    const phaseDurations: Record<BreathPhase, number> = {
      inhale: 4000,
      hold: 2000,
      exhale: 4000,
    };

    const updateBreath = (now: number) => {
      const elapsed = now - startTime;
      const duration = phaseDurations[currentPhase];
      const prog = Math.min(1.0, elapsed / duration);
      setPhaseProgress(prog);

      if (prog >= 1.0) {
        startTime = now;
        if (currentPhase === 'inhale') {
          currentPhase = 'hold';
          setPhase('hold');
        } else if (currentPhase === 'hold') {
          currentPhase = 'exhale';
          setPhase('exhale');
        } else {
          // 呼气完成
          if (currentBreath < 3) {
            currentBreath += 1;
            setBreathCount(currentBreath);
            currentPhase = 'inhale';
            setPhase('inhale');
            zenAudio.playSingingBowl(4.0, 432); // 每次吸气轻鸣钟磬
          } else {
            // 三次呼吸圆满，进入经卷
            onCompleteRef.current?.();
            return;
          }
        }
      }

      timer = window.requestAnimationFrame(updateBreath);
    };

    timer = window.requestAnimationFrame(updateBreath);
    return () => {
      if (timer) window.cancelAnimationFrame(timer);
    };
  }, [isOpen]);

  // 高清 Canvas 宣德铜炉 + 丝缕流云青烟 + 金屑微尘动画
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 320;
    const height = 260;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const emitterX = width / 2;
    const emitterY = 158; // 香头位置

    smokeParticlesRef.current = [];
    const particles = smokeParticlesRef.current;

    // 初始化 22 颗悬浮金屑微尘
    goldMotesRef.current = Array.from({ length: 22 }, () => ({
      x: 35 + Math.random() * (width - 70),
      y: 20 + Math.random() * (height - 45),
      vx: (Math.random() - 0.5) * 0.18,
      vy: -(0.08 + Math.random() * 0.16),
      radius: 0.7 + Math.random() * 1.3,
      phaseOffset: Math.random() * Math.PI * 2,
      baseAlpha: 0.2 + Math.random() * 0.45,
    }));
    const motes = goldMotesRef.current;

    let time = 0;

    const renderScene = () => {
      time += 0.022;
      const curPhase = phaseRef.current;
      const curProg = progressRef.current;

      // 计算当前呼吸态的归一化能量 (0.0 ~ 1.0)
      const breathEnergy =
        curPhase === 'inhale'
          ? curProg
          : curPhase === 'hold'
          ? 1.0
          : 1.0 - curProg;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. 绘制微尘金屑（禅堂斜阳浮尘感）
      for (const m of motes) {
        m.x += m.vx + Math.sin(time * 0.9 + m.phaseOffset) * 0.12;
        m.y += m.vy;
        if (m.y < 14) {
          m.y = height - 28;
          m.x = 35 + Math.random() * (width - 70);
        }
        const twinkle =
          m.baseAlpha * (0.55 + 0.45 * Math.sin(time * 2.4 + m.phaseOffset));
        ctx.fillStyle = `rgba(232, 197, 116, ${twinkle})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 绘制两缕程序化连续丝带青烟（底层核心流云，体现东方线香细密的丝绸质感）
      for (let strand = 0; strand < 2; strand++) {
        ctx.save();
        ctx.beginPath();
        const maxH = 128;
        const steps = 28;
        const phaseShift = strand * 1.9;
        const swayAmp = curPhase === 'exhale' ? 14 : curPhase === 'hold' ? 7.5 : 10;

        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const py = emitterY - t * maxH;
          const wave =
            Math.sin(t * 4.5 - time * 1.65 + phaseShift) * (t * swayAmp) +
            Math.cos(t * 2.4 - time * 0.9 + phaseShift) * (t * 4.5);
          const px = emitterX + wave;
          if (s === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }

        const ribbonGrad = ctx.createLinearGradient(
          emitterX,
          emitterY,
          emitterX,
          emitterY - maxH
        );
        const baseRibbonAlpha = strand === 0 ? 0.28 : 0.17;
        ribbonGrad.addColorStop(0, `rgba(235, 228, 215, ${baseRibbonAlpha})`);
        ribbonGrad.addColorStop(
          0.45,
          `rgba(210, 222, 232, ${baseRibbonAlpha * 0.85})`
        );
        ribbonGrad.addColorStop(1, 'rgba(200, 215, 230, 0)');

        ctx.strokeStyle = ribbonGrad;
        ctx.lineWidth = strand === 0 ? 2.4 + breathEnergy * 1.2 : 4.2 + breathEnergy * 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // 3. 发射并更新弥散青烟微粒
      if (Math.random() > 0.14) {
        const speedMod = curPhase === 'inhale' ? 1.12 : curPhase === 'hold' ? 0.85 : 1.0;
        particles.push({
          x: emitterX + (Math.random() * 2.4 - 1.2),
          y: emitterY - 1,
          vx: (Math.random() - 0.5) * 0.28,
          vy: -(0.68 + Math.random() * 0.55) * speedMod,
          size: 2.2 + Math.random() * 3.0,
          alpha: 0.42 + Math.random() * 0.22,
          maxLife: 135 + Math.random() * 45,
          life: 0,
          curve: Math.random() * Math.PI * 2,
          band: Math.random() > 0.5 ? 1 : -1,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        const progress = p.life / p.maxLife;
        const swayFactor = curPhase === 'hold' ? 0.55 : 0.82;
        const sOffset =
          Math.sin(time * 1.3 + p.life * 0.038 + p.curve) *
          swayFactor *
          (0.4 + progress * 1.1);

        p.x += p.vx + sOffset;
        p.y += p.vy;
        p.size += 0.19;

        const currentAlpha =
          progress < 0.18
            ? (progress / 0.18) * p.alpha
            : Math.pow(1 - (progress - 0.18) / 0.82, 1.4) * p.alpha;

        if (p.life >= p.maxLife || p.y < 14) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        radGrad.addColorStop(
          0,
          `rgba(228, 235, 242, ${currentAlpha * 0.42})`
        );
        radGrad.addColorStop(
          0.55,
          `rgba(195, 208, 220, ${currentAlpha * 0.18})`
        );
        radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. 绘制宋明三足双耳宣德铜炉与一炷清香
      const burnerY = emitterY + 44; // Y = 202
      ctx.save();

      // 4a. 线香本体与顶部香灰
      ctx.strokeStyle = '#7A4928';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY + 2);
      ctx.lineTo(emitterX, burnerY + 4);
      ctx.stroke();

      // 顶部一截浅灰香灰
      ctx.strokeStyle = '#C4BEB5';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY - 1);
      ctx.lineTo(emitterX, emitterY + 3.5);
      ctx.stroke();

      // 4b. 香火余烬微光（随呼吸与时间律动）
      const sparkPulse = 0.72 + 0.28 * Math.sin(time * 5.2) + breathEnergy * 0.15;
      const emberGlow = ctx.createRadialGradient(
        emitterX,
        emitterY,
        0.5,
        emitterX,
        emitterY,
        9 + breathEnergy * 4
      );
      emberGlow.addColorStop(0, `rgba(255, 230, 160, ${Math.min(1, sparkPulse)})`);
      emberGlow.addColorStop(0.35, `rgba(255, 115, 35, ${sparkPulse * 0.75})`);
      emberGlow.addColorStop(1, 'rgba(255, 80, 15, 0)');
      ctx.fillStyle = emberGlow;
      ctx.beginPath();
      ctx.arc(emitterX, emitterY, 9 + breathEnergy * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFE4A0';
      ctx.beginPath();
      ctx.arc(emitterX, emitterY, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 4c. 宣德炉底座暗影
      const baseShadow = ctx.createRadialGradient(
        emitterX,
        burnerY + 28,
        4,
        emitterX,
        burnerY + 28,
        44
      );
      baseShadow.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      baseShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = baseShadow;
      ctx.beginPath();
      ctx.ellipse(emitterX, burnerY + 28, 42, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4d. 宣德炉双耳（左右桥形双耳）
      ctx.strokeStyle = '#B8924A';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      // 左耳
      ctx.arc(emitterX - 31, burnerY + 9, 6.5, Math.PI * 0.45, Math.PI * 1.55, false);
      ctx.stroke();
      ctx.beginPath();
      // 右耳
      ctx.arc(emitterX + 31, burnerY + 9, 6.5, -Math.PI * 0.55, Math.PI * 0.55, false);
      ctx.stroke();

      // 4e. 宣德炉三足
      ctx.fillStyle = '#3B2C20';
      ctx.strokeStyle = '#8C6B32';
      ctx.lineWidth = 1;
      const feetOffsets = [-19, 0, 19];
      feetOffsets.forEach((ox, idx) => {
        const fy = idx === 1 ? burnerY + 21 : burnerY + 19;
        ctx.beginPath();
        ctx.roundRect(emitterX + ox - 3.2, fy, 6.4, 8.5, 2.5);
        ctx.fill();
        ctx.stroke();
      });

      // 4f. 炉腹（古铜渐变金属光泽）
      const bodyGrad = ctx.createLinearGradient(
        emitterX - 32,
        burnerY,
        emitterX + 32,
        burnerY + 22
      );
      bodyGrad.addColorStop(0, '#3D2E22');
      bodyGrad.addColorStop(0.35, '#695138');
      bodyGrad.addColorStop(0.55, '#7E6142');
      bodyGrad.addColorStop(1, '#2D2118');

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = '#C9A458';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(emitterX, burnerY + 11, 31, 12.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 4g. 炉口内膛香灰与鎏金口沿
      ctx.fillStyle = '#2A221C';
      ctx.strokeStyle = '#E0BC6B';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(emitterX, burnerY + 2.5, 25, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 炉腹铭文暗纹装饰线
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(emitterX, burnerY + 11, 26, 7.5, 0, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      ctx.restore();
      ctx.restore();

      animFrameRef.current = window.requestAnimationFrame(renderScene);
    };

    animFrameRef.current = window.requestAnimationFrame(renderScene);

    return () => {
      if (animFrameRef.current !== null) {
        window.cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen]);

  // 环形缩放比例 (吸气膨胀 1.28，屏息凝定 1.28，呼气收敛 0.92)
  let scaleOuter = 1.0;
  let scaleInner = 1.0;
  if (phase === 'inhale') {
    scaleOuter = 0.92 + 0.36 * phaseProgress;
    scaleInner = 0.95 + 0.22 * phaseProgress;
  } else if (phase === 'hold') {
    scaleOuter = 1.28;
    scaleInner = 1.17;
  } else {
    scaleOuter = 1.28 - 0.36 * phaseProgress;
    scaleInner = 1.17 - 0.22 * phaseProgress;
  }

  // SVG 呼吸圆环周长计算
  const svgRadius = 96;
  const svgCircumference = 2 * Math.PI * svgRadius;
  const overallProgress =
    ((breathCount - 1) +
      (phase === 'inhale'
        ? phaseProgress * 0.4
        : phase === 'hold'
        ? 0.4 + phaseProgress * 0.2
        : 0.6 + phaseProgress * 0.4)) /
    3;
  const strokeDashoffset = svgCircumference * (1 - phaseProgress);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="incense-ritual-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0E0C]/90 backdrop-blur-xl font-serif select-none p-3 overflow-y-auto"
        >
          {/* 禅堂背景暖金径向氛围晕光 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 44%, rgba(212, 175, 55, 0.11) 0%, rgba(120, 82, 30, 0.04) 42%, rgba(10, 9, 8, 0.75) 100%)',
            }}
          />

          {/* 右上角跳过按钮 */}
          <motion.button
            type="button"
            onClick={onSkip}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="absolute top-3 sm:top-6 right-3 sm:right-6 flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-stone-900/80 hover:bg-stone-800/90 text-stone-400 hover:text-amber-100 border border-stone-700/60 hover:border-amber-600/40 text-xs sm:text-sm font-medium transition-all z-20 active:scale-95"
          >
            <span>跳过仪式</span>
            <X size={15} />
          </motion.button>

          {/* 仪式主体面板 */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center max-w-sm sm:max-w-md w-full px-3 sm:px-6 py-4 text-center my-auto"
          >
            {/* 顶部古典引首标语（无胶囊边框，采用宋式排印分隔） */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="flex items-center gap-2 mb-1.5 text-amber-400/85 text-xs sm:text-sm tracking-[0.25em]"
            >
              <span className="w-5 h-[1px] bg-gradient-to-r from-transparent to-amber-500/60" />
              <span>开卷焚香 · 调息净手</span>
              <span className="w-5 h-[1px] bg-gradient-to-l from-transparent to-amber-500/60" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.55 }}
              className="text-2xl sm:text-3xl font-bold text-amber-50 mb-1 tracking-[0.28em]"
            >
              静心抄经
            </motion.h2>

            {/* 核心焚香画布与多层禅意水波呼吸引导环 */}
            <div className="relative w-[320px] h-[260px] flex items-center justify-center my-1 flex-shrink-0">
              {/* 外层水波呼吸光环 */}
              <div
                className="absolute inset-0 m-auto w-48 h-48 rounded-full border border-amber-500/20 pointer-events-none will-change-transform"
                style={{
                  transform: `scale(${scaleOuter})`,
                  boxShadow:
                    phase === 'hold'
                      ? '0 0 48px rgba(212, 175, 55, 0.32), inset 0 0 24px rgba(212, 175, 55, 0.12)'
                      : '0 0 24px rgba(212, 175, 55, 0.14)',
                }}
              />

              {/* 内层调息共振环 */}
              <div
                className="absolute inset-0 m-auto w-40 h-40 rounded-full border border-amber-400/30 pointer-events-none will-change-transform"
                style={{
                  transform: `scale(${scaleInner})`,
                }}
              />

              {/* 精密 SVG 呼吸相位轨迹环 */}
              <svg
                className="absolute inset-0 m-auto w-[212px] h-[212px] -rotate-90 pointer-events-none"
                viewBox="0 0 212 212"
              >
                <circle
                  cx="106"
                  cy="106"
                  r={svgRadius}
                  stroke="rgba(212, 175, 55, 0.12)"
                  strokeWidth="1.2"
                  fill="none"
                />
                <circle
                  cx="106"
                  cy="106"
                  r={svgRadius}
                  stroke="rgba(232, 195, 95, 0.65)"
                  strokeWidth="1.8"
                  strokeDasharray={svgCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>

              {/* 青烟与宣德香炉高清 Canvas */}
              <canvas
                ref={canvasRef}
                className="relative z-10 w-[320px] h-[260px]"
              />
            </div>

            {/* 呼吸指引文案（带帧间平滑过渡） */}
            <div className="min-h-[68px] flex flex-col items-center justify-center mt-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={phase}
                  initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center"
                >
                  <p className="text-base sm:text-lg text-amber-100 tracking-[0.2em] font-medium">
                    {PHASE_META[phase].title}
                  </p>
                  <p className="text-xs text-stone-400 tracking-[0.15em] mt-1">
                    {PHASE_META[phase].subtitle} · {PHASE_META[phase].rhythmLabel}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* 三息进度指示器 */}
              <div className="flex items-center gap-3 mt-2.5">
                {[1, 2, 3].map((b) => {
                  const isActive = b === breathCount;
                  const isDone = b < breathCount;
                  return (
                    <div key={b} className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          isActive
                            ? 'w-7 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]'
                            : isDone
                            ? 'w-3 bg-amber-600/80'
                            : 'w-3 bg-stone-700/80'
                        }`}
                      />
                    </div>
                  );
                })}
                <span className="text-[11px] text-stone-400 font-mono tabular-nums ml-1">
                  {breathCount}/3 息 ({Math.round(overallProgress * 100)}%)
                </span>
              </div>
            </div>

            {/* 底部直接进入按钮 */}
            <motion.button
              type="button"
              onClick={onComplete}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="group relative mt-4 sm:mt-6 flex items-center justify-center gap-2 px-7 sm:px-9 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 hover:from-amber-700 hover:via-amber-600 hover:to-amber-700 text-amber-50 font-medium text-xs sm:text-base tracking-[0.18em] shadow-[0_10px_30px_-5px_rgba(180,120,30,0.45)] transition-all border border-amber-500/40 whitespace-nowrap overflow-hidden"
            >
              <Wind size={15} className="text-amber-200/90 transition-transform duration-300 group-hover:rotate-12" />
              <span>净手敬书 · 开始抄经</span>
              <ChevronRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
