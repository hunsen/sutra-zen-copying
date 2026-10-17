import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const EVIDENCE_DIR = path.join(ROOT_DIR, 'docs', 'qa-fix-evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

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

  async setViewport(width, height, isMobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
      screenOrientation:
        width > height
          ? { angle: 90, type: 'landscapePrimary' }
          : { angle: 0, type: 'portraitPrimary' },
    });
  }

  async screenshot(filename, quality = 85) {
    const res = await this.send('Page.captureScreenshot', {
      format: filename.endsWith('.png') ? 'png' : 'jpeg',
      quality: filename.endsWith('.png') ? undefined : quality,
    });
    const filePath = path.join(EVIDENCE_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function dismissIncenseModal(client) {
  await client.evaluate(`(() => {
    const skipBtn = Array.from(document.querySelectorAll('button')).find(b => 
      b.textContent?.includes('跳过') || b.textContent?.includes('开始抄经')
    );
    if (skipBtn) skipBtn.click();
  })()`);
  await sleep(600);
}

async function main() {
  console.log('=== 复现 R-01 (窄屏纸墨菜单裁切) 与 R-02 (回放墨色写死) ===');

  const previewPort = 5176;
  console.log(`启动 Vite Preview 服务 (端口 ${previewPort})...`);
  const previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(previewPort), '--strictPort'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });

  await sleep(2000);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = '/tmp/chrome-zen-reproduce-' + Date.now();
  console.log('启动 Chrome Headless 实例...');
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9223',
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'pipe' }
  );

  await sleep(1500);

  const newTargetResp = await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' });
  const targetJson = await newTargetResp.json();
  const pageWs = targetJson.webSocketDebuggerUrl;

  const client = new CDPClient(pageWs);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  const targetUrl = `http://localhost:${previewPort}/`;

  try {
    // ------------------------------------------------------------------------
    // 复现 R-01: 390 宽屏和 320 宽屏下的纸墨菜单裁切
    // ------------------------------------------------------------------------
    console.log('\n--- 检查 R-01: 390×844 视口下纸墨菜单 ---');
    await client.setViewport(390, 844, true);
    await client.send('Page.navigate', { url: targetUrl });
    await sleep(2000);
    await dismissIncenseModal(client);

    // 点击顶栏“选择纸张古笺”
    await client.evaluate(`(() => {
      const themeBtn = document.querySelector('button[title*="选择纸张古笺"]');
      if (themeBtn) themeBtn.click();
    })()`);
    await sleep(500);

    const r01Metrics390 = await client.evaluate(`(() => {
      const menu = document.querySelector('.animate-fade-in');
      if (!menu) return { error: 'menu not found' };
      const menuRect = menu.getBoundingClientRect();
      const buttons = Array.from(menu.querySelectorAll('button')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), left: r.left, right: r.right, width: r.width };
      });
      const zhushaBtn = buttons.find(b => b.text.includes('朱砂墨'));
      return {
        menuLeft: menuRect.left,
        menuRight: menuRect.right,
        menuWidth: menuRect.width,
        clientWidth: menu.clientWidth,
        scrollWidth: menu.scrollWidth,
        zhushaBtn,
        isZhushaClipped: zhushaBtn ? zhushaBtn.right > menuRect.right : false,
      };
    })()`);
    console.log('390×844 测量结果:', JSON.stringify(r01Metrics390, null, 2));
    await client.screenshot('reproduce-r01-390.jpg');

    console.log('\n--- 检查 R-01: 320×568 视口下纸墨菜单 ---');
    await client.setViewport(320, 568, true);
    await sleep(600);

    const r01Metrics320 = await client.evaluate(`(() => {
      const menu = document.querySelector('.animate-fade-in');
      if (!menu) return { error: 'menu not found' };
      const menuRect = menu.getBoundingClientRect();
      const buttons = Array.from(menu.querySelectorAll('button')).map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), left: r.left, right: r.right, width: r.width };
      });
      const zhushaBtn = buttons.find(b => b.text.includes('朱砂墨'));
      return {
        menuLeft: menuRect.left,
        menuRight: menuRect.right,
        menuWidth: menuRect.width,
        clientWidth: menu.clientWidth,
        scrollWidth: menu.scrollWidth,
        zhushaBtn,
        isZhushaClipped: zhushaBtn ? zhushaBtn.right > menuRect.right : false,
      };
    })()`);
    console.log('320×568 测量结果:', JSON.stringify(r01Metrics320, null, 2));
    await client.screenshot('reproduce-r01-320.jpg');

    // ------------------------------------------------------------------------
    // 复现 R-02: 磁青纸上泥金墨回放变为近黑色
    // ------------------------------------------------------------------------
    console.log('\n--- 检查 R-02: 磁青金经下泥金墨笔迹回放颜色 ---');
    // 切换到磁青纸
    await client.evaluate(`(() => {
      const ciqingBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('磁青'));
      if (ciqingBtn) ciqingBtn.click();
    })()`);
    await sleep(400);

    // 切换到泥金墨
    await client.evaluate(`(() => {
      const goldBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('泥金墨'));
      if (goldBtn) goldBtn.click();
    })()`);
    await sleep(400);

    // 关闭菜单
    await client.evaluate(`(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.title === '关闭' || b.textContent === '✕');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 在字格上画一笔泥金
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
    await sleep(600);

    // 打开“钤印导出”
    await client.evaluate(`(() => {
      const exportBtn = document.querySelector('button[title*="钤印落款"]') ||
        Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('钤印导出'));
      if (exportBtn) exportBtn.click();
    })()`);
    await sleep(600);

    // 切换到“笔迹回放”
    await client.evaluate(`(() => {
      const replayTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('笔迹回放'));
      if (replayTab) replayTab.click();
    })()`);
    await sleep(600);

    // 点击“播放”
    await client.evaluate(`(() => {
      const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('播放'));
      if (playBtn) playBtn.click();
    })()`);
    await sleep(800);

    // 获取回放画布中心笔迹的像素颜色
    const r02Metrics = await client.evaluate(`(() => {
      const replayCanvas = document.querySelector('.aspect-square canvas');
      if (!replayCanvas) return { error: 'replay canvas not found' };
      const ctx = replayCanvas.getContext('2d');
      // 采样中间区域像素
      const w = replayCanvas.width;
      const h = replayCanvas.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      const pixels = imgData.data;

      // 寻找最深色和最亮色
      let darkPixels = 0; // rgb 接近 (28, 27, 25)
      let goldPixels = 0; // rgb 接近 (230, 193, 122)
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        if (a > 100) {
          // 松烟墨 #1C1B19: r:28, g:27, b:25
          if (r < 40 && g < 40 && b < 40) {
            darkPixels++;
          }
          // 泥金墨 #E6C17A: r:230, g:193, b:122
          if (r > 180 && g > 150 && b < 160) {
            goldPixels++;
          }
        }
      }
      return {
        width: w,
        height: h,
        darkPixels,
        goldPixels,
        dominantStrokeColor: darkPixels > goldPixels ? 'black (#1C1B19)' : 'gold (#E6C17A)',
      };
    })()`);
    console.log('R-02 回放墨色测量结果:', JSON.stringify(r02Metrics, null, 2));
    await client.screenshot('reproduce-r02-gold-replay.jpg');

  } catch (err) {
    console.error('复现脚本异常:', err);
  } finally {
    await client.close();
    chromeProcess.kill('SIGTERM');
    previewProcess.kill('SIGTERM');
  }
}

main().catch(console.error);
