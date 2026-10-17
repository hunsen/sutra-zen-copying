// ============================================================================
// 「静心抄经」原生 Web Audio 离线禅意音效合成引擎
// src/engine/ZenAudioEngine.ts
// 100% 纯代码程序化音频合成，零外部 MP3/WAV 依赖
// 1. playSingingBowl(): 432Hz 铜磬/颂钵多重泛音与指数长衰减
// 2. playWoodenFish(): 180Hz->110Hz 频降三角波 + 木槌冲击微爆
// 3. updateBrushFriction(velocity): 1200Hz 带通粉红噪声宣纸摩擦实时 ASMR
// ============================================================================

import { AudioSettings, DEFAULT_AUDIO_SETTINGS } from '../types/sutra';

export class ZenAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  // 宣纸摩擦 ASMR 节点链路
  private frictionNoiseBuffer: AudioBuffer | null = null;
  private frictionSourceNode: AudioBufferSourceNode | null = null;
  private frictionFilterNode: BiquadFilterNode | null = null;
  private frictionGainNode: GainNode | null = null;
  private isFrictionLoopActive = false;

  constructor() {
    // 延迟到用户首次交互时初始化 AudioContext（兼容移动端与现代浏览器自动播放策略）
  }

  /**
   * 确保并唤醒 Web Audio 上下文
   */
  public async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) {
        console.warn('当前浏览器环境不支持 Web Audio API');
        return null;
      }

      this.ctx = new AudioContextClass();

      // 构建总音量输出总线
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.settings.muted ? 0 : this.settings.masterVolume,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);

      // 准备宣纸摩擦底噪缓冲
      this.initFrictionLoop();
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('Web Audio 恢复播放状态失败:', err);
      }
    }

    return this.ctx;
  }

  /**
   * 1. 铜磬/颂钵空灵泛音 (playSingingBowl)
   *
   * @param duration 衰减持续时间（秒，默认 4.0s）
   * @param baseFreq 基频（默认 432Hz 古典律制，亦可传入其它音阶）
   */
  public async playSingingBowl(duration = 4.0, baseFreq = 432): Promise<void> {
    if (this.settings.muted || !this.settings.bowlEnabled) {
      return;
    }

    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }

    const now = ctx.currentTime;

    // 铜磬泛音列配置：[频率乘数, 振幅权重, 衰减时长倍率]
    // 432Hz 基音 + 2倍频泛音 + 3倍微失谐泛音 + 拍频微扰
    const harmonics = [
      { freqMult: 1.0, gain: 0.55, decayMult: 1.0 },      // 432.0 Hz 基频
      { freqMult: 1.0028, gain: 0.28, decayMult: 0.95 },  // 433.2 Hz 伴音（产生 1.2Hz 慢速拍频）
      { freqMult: 2.0, gain: 0.22, decayMult: 0.75 },     // 864.0 Hz 二次泛音
      { freqMult: 3.001, gain: 0.12, decayMult: 0.6 },    // 1296.5 Hz 三次泛音
      { freqMult: 4.12, gain: 0.05, decayMult: 0.4 },     // 1780 Hz 金属高阶泛音
    ];

    harmonics.forEach(({ freqMult, gain, decayMult }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * freqMult, now);

      // 音量包络：极速平滑击打起音（12ms 避免破音爆音）+ 指数长余音
      const targetGain = gain * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, now + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration * decayMult);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + duration * decayMult + 0.05);

      // 自动解绑回收节点
      osc.onended = () => {
        osc.disconnect();
        gainNode.disconnect();
      };
    });
  }

  /**
   * 2. 木鱼轻叩质朴音效 (playWoodenFish)
   *
   * @param pitchOffset 音调微偏置（-10 ~ +10 Hz，丰富连续敲击的自然细微变化）
   */
  public async playWoodenFish(pitchOffset = 0): Promise<void> {
    if (this.settings.muted || !this.settings.woodenFishEnabled) {
      return;
    }

    const ctx = await this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }

    const now = ctx.currentTime;
    const duration = 0.085; // 85ms 紧凑轻脆

    // A. 空心木腔体主振荡：三角波从 180Hz 快速俯冲至 110Hz
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'triangle';
    const startFreq = Math.max(140, 185 + pitchOffset);
    const endFreq = Math.max(90, 115 + pitchOffset * 0.5);

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.035);

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.7 * this.settings.masterVolume, now + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // B. 木槌敲击木壳的瞬态微爆声 (Transient Thump via Bandpassed Noise)
    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < output.length; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (output.length * 0.25));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(680, now);
    noiseFilter.Q.setValueAtTime(3.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35 * this.settings.masterVolume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    // 路由连线
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
    noiseSource.start(now);
    noiseSource.stop(now + 0.03);

    osc.onended = () => {
      osc.disconnect();
      oscGain.disconnect();
    };
    noiseSource.onended = () => {
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    };
  }

  /**
   * 3. 宣纸运笔摩擦白/粉红噪音生成链路初始化
   */
  private initFrictionLoop(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }

    // 生成 2 秒粉红噪声缓冲（循环播放，平滑无缝）
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 2;
    this.frictionNoiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = this.frictionNoiseBuffer.getChannelData(0);

    // Paul Kellet's filter 生成真实粉红噪声
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // 带通滤波器：中心频率 1200Hz，模拟毛笔狼毫/兼毫与宣纸粗糙纤维间的沙沙声
    this.frictionFilterNode = this.ctx.createBiquadFilter();
    this.frictionFilterNode.type = 'bandpass';
    this.frictionFilterNode.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.frictionFilterNode.Q.setValueAtTime(1.8, this.ctx.currentTime);

    // 摩擦增益控制节点（初始完全静音）
    this.frictionGainNode = this.ctx.createGain();
    this.frictionGainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    this.frictionFilterNode.connect(this.frictionGainNode);
    this.frictionGainNode.connect(this.masterGain);
  }

  /**
   * 启动摩擦音持续循环源
   */
  private startFrictionLoop(): void {
    if (!this.ctx || !this.frictionNoiseBuffer || !this.frictionFilterNode) {
      return;
    }
    if (this.isFrictionLoopActive) {
      return;
    }

    this.frictionSourceNode = this.ctx.createBufferSource();
    this.frictionSourceNode.buffer = this.frictionNoiseBuffer;
    this.frictionSourceNode.loop = true;
    this.frictionSourceNode.connect(this.frictionFilterNode);
    this.frictionSourceNode.start();
    this.isFrictionLoopActive = true;
  }

  /**
   * 运笔速度实时更新摩擦音量（手指滑动时调用）
   *
   * @param velocity 瞬时运笔速度 (px/ms)
   */
  public updateBrushFriction(velocity: number): void {
    if (this.settings.muted || !this.settings.frictionEnabled) {
      this.stopBrushFriction();
      return;
    }

    if (!this.ctx || !this.frictionGainNode) {
      this.ensureContext().then(() => {
        this.updateBrushFriction(velocity);
      });
      return;
    }

    if (!this.isFrictionLoopActive) {
      this.startFrictionLoop();
    }

    const now = this.ctx.currentTime;

    // 当 velocity <= 0.02 时视为停笔
    if (velocity <= 0.02) {
      // 50ms 平滑衰减至零，杜绝爆音
      this.frictionGainNode.gain.setTargetAtTime(0, now, 0.04);
      return;
    }

    // 动态增益映射：速度 0.05 ~ 1.5 px/ms 映射到增益 [0.005, 0.12]
    const clampedVelocity = Math.min(Math.max(velocity, 0), 2.5);
    const targetGain = Math.min(
      0.12,
      (clampedVelocity / 1.8) * 0.12 * this.settings.masterVolume
    );

    // 随着速度微调带通中心频率（运笔越快，沙沙声频率越高）
    if (this.frictionFilterNode) {
      const centerFreq = 1050 + clampedVelocity * 280;
      this.frictionFilterNode.frequency.setTargetAtTime(centerFreq, now, 0.03);
    }

    this.frictionGainNode.gain.setTargetAtTime(targetGain, now, 0.025);
  }

  /**
   * 运笔停止/抬笔时平滑关闭摩擦音
   */
  public stopBrushFriction(): void {
    if (!this.ctx || !this.frictionGainNode) {
      return;
    }
    const now = this.ctx.currentTime;
    this.frictionGainNode.gain.setTargetAtTime(0, now, 0.035);
  }

  // ============================================================================
  // 设置与生命周期管理
  // ============================================================================

  /**
   * 获取当前音频设置快照
   */
  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * 更新音频设置
   */
  public updateSettings(partial: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (this.masterGain && this.ctx) {
      const target = this.settings.muted ? 0 : this.settings.masterVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * 设置主音量 (0.0 ~ 1.0)
   */
  public setMasterVolume(volume: number): void {
    this.updateSettings({ masterVolume: Math.min(1, Math.max(0, volume)) });
  }

  /**
   * 静音/取消静音切换
   */
  public toggleMute(): boolean {
    const nextMuted = !this.settings.muted;
    this.updateSettings({ muted: nextMuted });
    return nextMuted;
  }

  /**
   * 释放并销毁音频上下文资源
   */
  public dispose(): void {
    if (this.frictionSourceNode) {
      try {
        this.frictionSourceNode.stop();
        this.frictionSourceNode.disconnect();
      } catch {
        // 忽略已停止的报错
      }
      this.frictionSourceNode = null;
    }
    this.isFrictionLoopActive = false;

    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * 全局单例实例
 */
export const zenAudio = new ZenAudioEngine();
