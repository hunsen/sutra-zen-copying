import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const EVIDENCE_DIR = path.join(ROOT_DIR, 'docs', 'qa-fix-evidence');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { res: resolve, rej: reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(EVIDENCE_DIR, filename), Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function drawStroke(client) {
  await client.evaluate(`(() => {
    const canvas = document.querySelector('.cursor-crosshair');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;

    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: cx - 40,
      clientY: cy,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      pressure: 0.8,
    }));

    for (let i = 1; i <= 8; i++) {
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: cx - 40 + i * 10,
        clientY: cy,
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        pressure: 0.8,
      }));
    }

    canvas.dispatchEvent(new PointerEvent('pointerup', {
      clientX: cx + 40,
      clientY: cy,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
    }));
  })()`);
  await sleep(400);
}

async function closeModal(client) {
  await client.evaluate(`(() => {
    const modal = document.querySelector('.max-w-2xl');
    if (!modal) return;
    const closeBtn = modal.querySelector('button svg.lucide-x')?.closest('button') ||
      Array.from(modal.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-x'));
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(500);
}

async function main() {
  const previewPort = 5181;
  const previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(previewPort), '--strictPort'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });
  await sleep(1500);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = '/tmp/chrome-test-replay-' + Date.now();
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9226',
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'pipe' }
  );
  await sleep(1500);

  const newTargetResp = await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' });
  const targetJson = await newTargetResp.json();
  const client = new CDPClient(targetJson.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });

  await client.send('Page.navigate', { url: `http://localhost:${previewPort}/` });
  await sleep(2000);

  // 跳过香仪
  await client.evaluate(`(() => {
    const skipBtn = Array.from(document.querySelectorAll('button')).find(b => 
      b.textContent?.includes('跳过') || b.textContent?.includes('开始抄经')
    );
    if (skipBtn) skipBtn.click();
  })()`);
  await sleep(600);

  const testCases = [
    { theme: '磁青金经', ink: '泥金墨', expected: 'gold', filename: 'round2-r02-ciqing-gold.jpg' },
    { theme: '磁青金经', ink: '朱砂墨', expected: 'cinnabar', filename: 'round2-r02-ciqing-cinnabar.jpg' },
    { theme: '磁青金经', ink: '松烟墨', expected: 'black', filename: 'round2-r02-ciqing-black.jpg' },
    { theme: '古法宣纸', ink: '松烟墨', expected: 'black', filename: 'round2-r02-xuan-black.jpg' },
    { theme: '古法宣纸', ink: '泥金墨', expected: 'gold', filename: 'round2-r02-xuan-gold.jpg' },
    { theme: '古法宣纸', ink: '朱砂墨', expected: 'cinnabar', filename: 'round2-r02-xuan-cinnabar.jpg' },
  ];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`测试回放色彩: 纸张=[${tc.theme}], 墨色=[${tc.ink}]`);
    console.log(`========================================`);

    // 1. 打开纸墨设置菜单
    await client.evaluate(`(() => {
      const themeBtn = document.querySelector('button[title*="选择纸张古笺"]');
      if (themeBtn) themeBtn.click();
    })()`);
    await sleep(400);

    // 2. 选择纸张
    await client.evaluate(`((thm) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === thm);
      if (btn) btn.click();
    })('${tc.theme}')`);
    await sleep(300);

    // 3. 选择墨色
    await client.evaluate(`((ink) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === ink);
      if (btn) btn.click();
    })('${tc.ink}')`);
    await sleep(300);

    // 4. 关闭纸墨菜单
    await client.evaluate(`(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.title === '关闭' || b.textContent === '✕');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 5. 重写清空字格
    await client.evaluate(`(() => {
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('重写'));
      if (clearBtn && !clearBtn.disabled) clearBtn.click();
    })()`);
    await sleep(400);

    // 6. 画一笔
    await drawStroke(client);

    // 7. 打开“钤印导出”
    await client.evaluate(`(() => {
      const exportBtn = document.querySelector('button[title*="钤印落款"]') ||
        Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('钤印导出'));
      if (exportBtn) exportBtn.click();
    })()`);
    await sleep(600);

    // 8. 切换到“笔迹回放”
    await client.evaluate(`(() => {
      const replayTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('笔迹回放'));
      if (replayTab) replayTab.click();
    })()`);
    await sleep(600);

    // 9. 点击“播放”
    await client.evaluate(`(() => {
      const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('播放'));
      if (playBtn) playBtn.click();
    })()`);
    await sleep(900);

    // 10. 准确采样画笔中心像素（采样字格中心笔迹区域，避开背景）
    const sampledColor = await client.evaluate(`(() => {
      const replayCanvas = document.querySelector('.aspect-square canvas');
      if (!replayCanvas) return { error: 'canvas not found' };
      const ctx = replayCanvas.getContext('2d');
      // 笔画位于画布中心附近 (x: 0.45 ~ 0.55, y: 0.48 ~ 0.52)
      const w = replayCanvas.width;
      const h = replayCanvas.height;
      const x1 = Math.floor(w * 0.45);
      const y1 = Math.floor(h * 0.48);
      const sw = Math.floor(w * 0.1);
      const sh = Math.floor(h * 0.04);
      const imgData = ctx.getImageData(x1, y1, sw, sh).data;

      // 在这一段笔迹区域中寻找最具代表性的墨迹像素
      let bestPixel = null;
      let minBgDist = 999999;

      // 提取所有像素的 RGB
      const colors = [];
      for (let i = 0; i < imgData.length; i += 4) {
        colors.push({ r: imgData[i], g: imgData[i+1], b: imgData[i+2] });
      }

      // 计算松烟墨 #1C1B19 (28, 27, 25), 泥金墨 #E6C17A (230, 193, 122), 朱砂墨 #B22222 (178, 34, 34) 的相似度
      let goldMatches = 0;
      let cinnabarMatches = 0;
      let blackMatches = 0;

      for (const c of colors) {
        // 金色判定: r > 180, g > 150, b < 160
        if (c.r > 180 && c.g > 150 && c.b < 160) {
          goldMatches++;
        }
        // 朱砂判定: r > 130, g < 60, b < 60
        if (c.r > 130 && c.g < 60 && c.b < 60) {
          cinnabarMatches++;
        }
        // 松烟墨判定: r < 40, g < 40, b < 40
        if (c.r < 40 && c.g < 40 && c.b < 40) {
          blackMatches++;
        }
      }

      let detected = 'unknown';
      if (goldMatches > cinnabarMatches && goldMatches > blackMatches) detected = 'gold';
      else if (cinnabarMatches > goldMatches && cinnabarMatches > blackMatches) detected = 'cinnabar';
      else if (blackMatches > goldMatches && blackMatches > cinnabarMatches) detected = 'black';

      return {
        goldMatches,
        cinnabarMatches,
        blackMatches,
        detected,
      };
    })()`);

    console.log(`检测结果:`, sampledColor);
    const pass = sampledColor.detected === tc.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] 纸张[${tc.theme}] + 墨色[${tc.ink}] -> 预期: ${tc.expected}, 实际: ${sampledColor.detected}`);

    await client.screenshot(tc.filename);

    // 11. 彻底关闭模态框
    await closeModal(client);
    await sleep(400);
  }

  await client.close();
  chromeProcess.kill('SIGTERM');
  previewProcess.kill('SIGTERM');
}

main().catch(console.error);
