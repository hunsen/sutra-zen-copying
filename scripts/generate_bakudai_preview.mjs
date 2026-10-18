import { spawn, execSync } from 'node:child_process';
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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: false,
    });
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', {
      format: 'png',
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

async function captureForFont(fontSourcePath, fontLabel, filenamePrefix) {
  console.log(`\n=== 正在生成【${fontLabel}】实景效果图 ===`);
  fs.copyFileSync(fontSourcePath, path.join(ROOT_DIR, 'public', 'fonts', 'ZenKai.woff2'));
  fs.copyFileSync(fontSourcePath, path.join(ROOT_DIR, 'src', 'assets', 'fonts', 'ZenKai.woff2'));

  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

  const previewPort = 5179;
  const previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(previewPort), '--strictPort'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });
  await sleep(1500);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = '/tmp/chrome-bakudai-preview-' + Date.now();
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9224',
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'pipe' }
  );
  await sleep(1500);

  const newTargetResp = await fetch('http://127.0.0.1:9224/json/new?about:blank', { method: 'PUT' });
  const targetJson = await newTargetResp.json();
  const pageWs = targetJson.webSocketDebuggerUrl;

  const client = new CDPClient(pageWs);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  try {
    await client.setViewport(1440, 900);
    await client.send('Page.navigate', { url: `http://localhost:${previewPort}/` });
    await sleep(2000);

    // 跳过开屏礼佛弹窗
    await client.evaluate(`(() => {
      const skipBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent?.includes('跳过') || b.textContent?.includes('开始抄经')
      );
      if (skipBtn) skipBtn.click();
    })()`);
    await sleep(1000);

    await client.evaluate(`document.fonts.ready`);
    await sleep(500);

    // 截图 1: 桌面全景效果（左侧长卷 + 右侧放大米字格书写台）
    await client.screenshot(`${filenamePrefix}-01-desktop-full.png`);

    // 切换至磁青纸墨金主题截图
    await client.evaluate(`(() => {
      const themeBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.title?.includes('文房四宝') || b.textContent?.includes('宣纸') || b.textContent?.includes('纸')
      );
      if (themeBtn) themeBtn.click();
    })()`);
    await sleep(600);

    // 点击磁青纸
    await client.evaluate(`(() => {
      const ciqingBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('磁青'));
      if (ciqingBtn) ciqingBtn.click();
      const closeBtn = document.querySelector('button svg.lucide-x')?.closest('button');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(800);

    await client.screenshot(`${filenamePrefix}-02-ciqing-gold.png`);

  } finally {
    await client.close();
    chromeProcess.kill('SIGTERM');
    previewProcess.kill('SIGTERM');
    await sleep(800);
  }
}

async function main() {
  await captureForFont(
    '/tmp/candidates/Bakudai_subset.woff2',
    '莫大毛笔楷书 (Bakudai 真迹毛笔楷书)',
    'preview-bakudai'
  );
  console.log('\n=== 莫大毛笔楷书实机效果图生成完成！===');
}

main().catch((err) => {
  console.error('生成失败:', err);
  process.exit(1);
});
