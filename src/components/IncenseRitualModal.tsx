// ============================================================================
// 「静心抄经」开卷焚香调息仪式模态框
// src/components/IncenseRitualModal.tsx
// 1. 伴随 432Hz 空灵铜磬长泛音 (playSingingBowl)
// 2. 铜香炉一缕青烟袅袅升起的粒子缓动动画
// 3. 经典三次禅意呼吸引导（吸气 -> 屏息 -> 呼气），助书写者收摄心神
// 4. 支持随时一键跳过直接开卷
// ============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { zenAudio } from '../engine/ZenAudioEngine';
import { Sparkles, X, ChevronRight } from 'lucide-react';

export interface IncenseRitualModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale';

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

  // 烟雾粒子系统
  const smokeParticlesRef = useRef<
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      maxLife: number;
      life: number;
      curve: number;
    }[]
  >([]);

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

  // Canvas 焚香青烟袅袅升起动效
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = 300);
    const height = (canvas.height = 360);
    const emitterX = width / 2;
    const emitterY = height - 70; // 香炉顶部香火位置

    smokeParticlesRef.current = [];
    const particles = smokeParticlesRef.current;

    let time = 0;

    const renderSmoke = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // 1. 发射新青烟微粒
      if (Math.random() > 0.15) {
        particles.push({
          x: emitterX + (Math.random() * 4 - 2),
          y: emitterY,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(0.8 + Math.random() * 0.8),
          size: 3 + Math.random() * 4,
          alpha: 0.55 + Math.random() * 0.25,
          maxLife: 160 + Math.random() * 60,
          life: 0,
          curve: Math.random() * Math.PI * 2,
        });
      }

      // 2. 绘制香炉与一炷香
      ctx.save();
      // 线香本体（细红棕色线）
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(emitterX, emitterY + 50);
      ctx.stroke();

      // 香火微光（红亮微闪点）
      const sparkPulse = 0.75 + 0.25 * Math.sin(time * 6);
      ctx.fillStyle = `rgba(255, 120, 40, ${sparkPulse})`;
      ctx.beginPath();
      ctx.arc(emitterX, emitterY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 铜香炉（三足双耳宣德炉简雅剪影）
      const burnerY = emitterY + 50;
      ctx.fillStyle = '#4A3B32';
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 1.0;

      // 炉身
      ctx.beginPath();
      ctx.ellipse(emitterX, burnerY + 8, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 炉底
      ctx.beginPath();
      ctx.ellipse(emitterX, burnerY + 12, 20, 8, 0, 0, Math.PI);
      ctx.fillStyle = '#3A2B22';
      ctx.fill();
      ctx.restore();

      // 3. 更新并绘制袅袅青烟
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // S形轻盈摆动
        const sOffset = Math.sin(time + p.life * 0.035 + p.curve) * 0.9;
        p.x += p.vx + sOffset;
        p.y += p.vy;
        p.size += 0.22; // 随着升腾逐渐弥散变大

        const progress = p.life / p.maxLife;
        // 先淡入，后平滑弥散淡出
        const currentAlpha =
          progress < 0.2
            ? (progress / 0.2) * p.alpha
            : (1 - (progress - 0.2) / 0.8) * p.alpha;

        if (p.life >= p.maxLife || p.y < 20) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        const radGrad = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size
        );
        radGrad.addColorStop(
          0,
          `rgba(225, 235, 245, ${currentAlpha * 0.45})`
        );
        radGrad.addColorStop(
          0.6,
          `rgba(180, 200, 215, ${currentAlpha * 0.2})`
        );
        radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animFrameRef.current = window.requestAnimationFrame(renderSmoke);
    };

    animFrameRef.current = window.requestAnimationFrame(renderSmoke);

    return () => {
      if (animFrameRef.current !== null) {
        window.cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 呼吸文案
  const phaseTexts: Record<BreathPhase, string> = {
    inhale: '深吸 · 收摄心神',
    hold: '屏息 · 杂念澄澈',
    exhale: '慢呼 · 万缘放下',
  };

  // 环形缩放比例 (吸气膨胀 1.35，呼气收缩 0.9)
  let scaleCircle = 1.0;
  if (phase === 'inhale') {
    scaleCircle = 0.9 + 0.45 * phaseProgress;
  } else if (phase === 'hold') {
    scaleCircle = 1.35;
  } else {
    scaleCircle = 1.35 - 0.45 * phaseProgress;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in font-serif select-none p-3 overflow-y-auto">
      {/* 右上角跳过按钮 */}
      <button
        type="button"
        onClick={onSkip}
        className="absolute top-3 sm:top-6 right-3 sm:right-6 flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-700/60 text-xs sm:text-sm font-medium transition-all z-20"
      >
        <span>跳过仪式</span>
        <X size={15} />
      </button>

      {/* 仪式主体面板 */}
      <div className="flex flex-col items-center max-w-sm sm:max-w-md w-full px-2 sm:px-4 py-4 text-center my-auto">
        {/* 顶部标语 */}
        <div className="flex items-center gap-1.5 mb-1.5 text-amber-400/90 text-xs sm:text-sm tracking-widest uppercase">
          <Sparkles size={14} />
          <span>开卷焚香 · 调息净手</span>
          <Sparkles size={14} />
        </div>

        <h2 className="text-xl sm:text-3xl font-bold text-amber-50 mb-2 tracking-widest">
          静心抄经
        </h2>

        {/* 核心焚香画布与呼吸引导环 */}
        <div className="relative w-[260px] sm:w-[300px] h-[240px] sm:h-[320px] flex items-center justify-center my-1 sm:my-2">
          {/* 呼吸外扩动态光环 */}
          <div
            className="absolute inset-0 m-auto w-44 h-44 sm:w-56 sm:h-56 rounded-full border-2 border-amber-500/30 transition-transform duration-100 ease-out pointer-events-none"
            style={{
              transform: `scale(${scaleCircle})`,
              boxShadow:
                phase === 'hold'
                  ? '0 0 35px rgba(212, 175, 55, 0.4)'
                  : '0 0 20px rgba(212, 175, 55, 0.15)',
            }}
          />

          {/* 青烟与香炉 Canvas */}
          <canvas
            ref={canvasRef}
            className="relative z-10 w-[260px] sm:w-[300px] h-[300px] sm:h-[360px]"
          />
        </div>

        {/* 呼吸指引文案 */}
        <div className="min-h-[42px] flex flex-col items-center justify-center">
          <p className="text-base sm:text-xl text-amber-200 tracking-widest font-medium transition-all">
            {phaseTexts[phase]}
          </p>
          <div className="flex gap-2 mt-1.5 sm:mt-2">
            {[1, 2, 3].map((b) => (
              <span
                key={b}
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                  b === breathCount
                    ? 'bg-amber-400 scale-125'
                    : b < breathCount
                    ? 'bg-amber-600'
                    : 'bg-stone-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 底部直接进入按钮 */}
        <button
          type="button"
          onClick={onComplete}
          className="mt-4 sm:mt-6 flex items-center justify-center gap-1.5 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-50 font-medium text-xs sm:text-base tracking-widest shadow-xl transition-all active:scale-95 border border-amber-600/40 whitespace-nowrap"
        >
          <span>净手敬书 · 开始抄经</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
