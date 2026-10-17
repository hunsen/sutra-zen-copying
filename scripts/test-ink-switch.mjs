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
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const previewPort = 5179;
  const previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(previewPort), '--strictPort'], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });
  await sleep(1500);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = '/tmp/chrome-test-ink-' + Date.now();
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=9225',
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'pipe' }
  );
  await sleep(1500);

  const newTargetResp = await fetch('http://127.0.0.1:9225/json/new?about:blank', { method: 'PUT' });
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

  // 1. 打开纸墨菜单
  const openResult = await client.evaluate(`(() => {
    const themeBtn = document.querySelector('button[title*="选择纸张古笺"]');
    if (themeBtn) {
      themeBtn.click();
      return { success: true };
    }
    return { success: false };
  })()`);
  console.log('打开纸墨菜单结果:', openResult);
  await sleep(400);

  // 2. 查看当前菜单中的所有按钮
  const menuButtons = await client.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
    return btns;
  })()`);
  console.log('所有按钮文本:', menuButtons);

  // 3. 点击“朱砂墨”
  const clickZhusha = await client.evaluate(`(() => {
    const zhusha = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '朱砂墨');
    if (zhusha) {
      zhusha.click();
      return { found: true, text: zhusha.textContent };
    }
    return { found: false };
  })()`);
  console.log('点击朱砂墨结果:', clickZhusha);
  await sleep(400);

  // 4. 查看当前书写台或顶栏状态中 inkType / 颜色
  const currentStatus = await client.evaluate(`(() => {
    // 检查顶栏或主画布中的墨色指示
    const zhushaBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '朱砂墨');
    return {
      zhushaClasses: zhushaBtn ? zhushaBtn.className : null,
    };
  })()`);
  console.log('朱砂墨按钮激活状态:', currentStatus);

  await client.close();
  chromeProcess.kill('SIGTERM');
  previewProcess.kill('SIGTERM');
}

main().catch(console.error);
