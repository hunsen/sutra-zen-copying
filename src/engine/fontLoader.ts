// ============================================================================
// 「静心抄经」跨平台移动端 WebFont 强制预加载与 Canvas 重绘通知引擎
// src/engine/fontLoader.ts
// 解决痛点：
// 1. iOS (iPhone/iPad) 与 Android 原生系统无内置楷体（Kaiti），完全依赖 3.6MB 的 ZenKai.woff2
// 2. HTML5 Canvas (fillText) 是即时位图绘制，WebFont 异步下载完成后 Canvas 不会自动重绘
// 3. 部分移动端浏览器对 @font-face 懒加载，若无显式 FontFace.load() 或字重不匹配会退回系统宋体/黑体
// ============================================================================

import { useState, useEffect } from 'react';

const zenKaiUrl = new URL('../assets/fonts/ZenKai.woff2', import.meta.url).href;
const ancientSealUrl = new URL('../assets/fonts/AncientSeal.woff2', import.meta.url).href;

let fontReadyVersion = 0;
let isLoadingStarted = false;
const listeners = new Set<(version: number) => void>();

function notifyListeners() {
  fontReadyVersion += 1;
  listeners.forEach((fn) => fn(fontReadyVersion));
}

/**
 * 启动 ZenKai（正体楷体）与 AncientSeal（崇羲小篆）主动加载
 */
export function ensureZenFontsLoaded(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (isLoadingStarted) return;
  isLoadingStarted = true;

  const fontSet = (document as unknown as { fonts?: FontFaceSet }).fonts;

  // 1. 使用原生 FontFace API 显式注册并加载常规与粗体字重，解决移动端 Canvas bold 字重降级问题
  if (typeof FontFace !== 'undefined' && fontSet && typeof fontSet.add === 'function') {
    const loadFace = async (
      family: string,
      url: string,
      weight: string
    ) => {
      try {
        const face = new FontFace(family, `url("${url}") format("woff2")`, {
          weight,
          style: 'normal',
          display: 'swap',
        });
        const loaded = await face.load();
        fontSet.add(loaded);
        notifyListeners();
      } catch {
        // 若 FontFace 构造回退，交给 CSS @font-face 与 document.fonts.load 处理
      }
    };

    loadFace('ZenKai', zenKaiUrl, 'normal');
    loadFace('ZenKai', zenKaiUrl, 'bold');
    loadFace('AncientSeal', ancientSealUrl, 'normal');
  }

  // 2. 触发 CSS @font-face 规则的显式拉取与就绪监听
  if (fontSet) {
    if (typeof fontSet.load === 'function') {
      Promise.allSettled([
        fontSet.load('normal 24px "ZenKai"', '觀自在菩薩行深般若波羅蜜多時'),
        fontSet.load('bold 24px "ZenKai"', '般若波羅蜜多心經'),
        fontSet.load('normal 24px "AncientSeal"', '靜心'),
      ]).then(() => {
        notifyListeners();
      });
    }

    if (fontSet.ready) {
      fontSet.ready.then(() => {
        notifyListeners();
      });
    }

    if (typeof fontSet.addEventListener === 'function') {
      fontSet.addEventListener('loadingdone', () => {
        notifyListeners();
      });
    }
  }
}

/**
 * React Hook：当楷体或篆体 WebFont 下载并栅格化就绪时，自动触发组件与 Canvas 重绘
 */
export function useZenFontsReady(): number {
  const [version, setVersion] = useState<number>(fontReadyVersion);

  useEffect(() => {
    ensureZenFontsLoaded();
    const handler = (nextVersion: number) => {
      setVersion(nextVersion);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return version;
}
