import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT_DIR = process.cwd();
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

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  const previewPort = 5184;
  const previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(previewPort), '--strictPort'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });
  await sleep(1500);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = '/tmp/chrome-inspect-rgb-' + Date.now();
  const chromeProcess = spawn(
    chromePath,
    ['--headless=new', '--remote-debugging-port=9228', '--no-first-run', '--disable-gpu', `--user-data-dir=${userDataDir}`, 'about:blank'],
    { stdio: 'pipe' }
  );
  await sleep(1500);

  const newTargetResp = await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' });
  const targetJson = await newTargetResp.json();
  const client = new CDPClient(targetJson.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

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

  // 选磁青纸 + 泥金墨
  await client.evaluate(`(() => {
    const themeBtn = document.querySelector('button[title*="选择纸张古笺"]');
    if (themeBtn) themeBtn.click();
  })()`);
  await sleep(300);
  await client.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '磁青金经');
    if (btn) btn.click();
  })()`);
  await sleep(300);
  await client.evaluate(`(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.title === '关闭' || b.textContent === '✕');
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(300);

  // 画一笔
  await client.evaluate(`(() => {
    const canvas = document.querySelector('.cursor-crosshair');
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx - 40, clientY: cy, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', pressure: 0.8 }));
    for (let i = 1; i <= 8; i++) {
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: cx - 40 + i * 10, clientY: cy, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', pressure: 0.8 }));
    }
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: cx + 40, clientY: cy, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' }));
  })()`);
  await sleep(500);

  // 打开回放
  await client.evaluate(`(() => {
    const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('钤印导出'));
    if (exportBtn) exportBtn.click();
  })()`);
  await sleep(500);
  await client.evaluate(`(() => {
    const replayTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('笔迹回放'));
    if (replayTab) replayTab.click();
  })()`);
  await sleep(500);
  await client.evaluate(`(() => {
    const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('播放'));
    if (playBtn) playBtn.click();
  })()`);
  await sleep(900);

  // 检查回放画布上的非背景像素
  const rgbProfile = await client.evaluate(`(() => {
    const replayCanvas = document.querySelector('.aspect-square canvas');
    if (!replayCanvas) return { error: 'no canvas' };
    const ctx = replayCanvas.getContext('2d');
    const w = replayCanvas.width;
    const h = replayCanvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    // 统计不同色系的像素数量
    const samples = [];
    for (let i = 0; i < data.length; i += 4 * 20) { // 每隔20个像素采样
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      // 排除背景色 (磁青纸: r:22, g:33, b:46)
      if (Math.abs(r - 22) > 20 || Math.abs(g - 33) > 20 || Math.abs(b - 46) > 20) {
        samples.push({ r, g, b });
      }
    }
    return {
      w, h,
      nonBgSampleCount: samples.length,
      sampleColors: samples.slice(0, 15),
    };
  })()`);
  console.log('RGB 采样分析结果:', JSON.stringify(rgbProfile, null, 2));

  await client.close();
  chromeProcess.kill('SIGTERM');
  previewProcess.kill('SIGTERM');
}

main().catch(console.error);
