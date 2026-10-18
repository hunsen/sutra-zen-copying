import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const EVIDENCE_DIR = path.join(ROOT_DIR, 'docs', 'qa-fix-evidence');

const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    padding: 32px;
    background: #121418;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h1 {
    text-align: center;
    font-size: 28px;
    margin-bottom: 8px;
    color: #f3f4f6;
  }
  p.subtitle {
    text-align: center;
    color: #9ca3af;
    margin-bottom: 32px;
    font-size: 15px;
  }
  .section {
    background: #1c2027;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 32px;
    border: 1px solid #374151;
  }
  .section-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 9999px;
    font-weight: normal;
  }
  .badge-a { background: #3b82f6; color: #fff; }
  .badge-b { background: #10b981; color: #fff; }
  .desc {
    font-size: 14px;
    color: #9ca3af;
    margin-bottom: 20px;
    line-height: 1.6;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card {
    background: #0f1217;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #2d3748;
  }
  .card-header {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: #cbd5e1;
    background: #181d24;
    border-bottom: 1px solid #2d3748;
  }
  img {
    width: 100%;
    display: block;
  }
</style>
</head>
<body>
  <h1>两款免费商用正楷书法字体 · 真实应用实机对比</h1>
  <p class="subtitle">已在长卷经文排版、米字格临摹大字、宣纸古法淡墨与磁青泥金主题中完全实机实测</p>

  <!-- 方案 A -->
  <div class="section">
    <div class="section-title">
      <span class="badge badge-a">方案 A</span>
      <span>寒蝉正楷 (ChillKai) —— 正宗毛笔行楷气韵 · 墨韵生动</span>
    </div>
    <div class="desc">
      <strong>授权：</strong>SIL Open Font License 1.1（100% 永久免费商用，支持无限制嵌入与修改）<br>
      <strong>书法特征：</strong>运笔起承转合清晰，起笔藏锋带势，顿挫分明，撇捺舒展且带毛笔提按韵律。写起来真正像手执毛笔蘸墨临摹，极具文人手抄经卷之清雅与灵动。
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-header">【方案 A】古法宣纸（长卷与米字格正楷临写）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-A-chillkai-01-desktop-full.png')}" />
      </div>
      <div class="card">
        <div class="card-header">【方案 A】磁青金经（皇家藏金写经风格）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-A-chillkai-02-ciqing-gold.png')}" />
      </div>
    </div>
  </div>

  <!-- 方案 B -->
  <div class="section">
    <div class="section-title">
      <span class="badge badge-b">方案 B</span>
      <span>全字库正楷 (TW-Kai) —— 典雅唐楷法度 · 庄重肃穆</span>
    </div>
    <div class="desc">
      <strong>授权：</strong>台湾政府资料开放授权条款（Open Government Data License，100% 免费商用）<br>
      <strong>书法特征：</strong>取法欧阳询、柳公权经典唐楷骨架，结构严谨端庄、中宫收紧、字形刚劲挺拔。犹如大藏经古籍木刻善本与寺院开山碑刻，肃穆庄严、正大光明。
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-header">【方案 B】古法宣纸（长卷与米字格正楷临写）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-B-twkai-01-desktop-full.png')}" />
      </div>
      <div class="card">
        <div class="card-header">【方案 B】磁青金经（皇家藏金写经风格）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-B-twkai-02-ciqing-gold.png')}" />
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('/tmp/font_collage.html', htmlContent);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(chromePath, [
  '--headless=new',
  '--no-first-run',
  '--disable-gpu',
  '--allow-file-access-from-files',
  '--window-size=2000,2400',
  '--screenshot=' + path.join(EVIDENCE_DIR, 'preview_side_by_side_summary.png'),
  '/tmp/font_collage.html'
]);

proc.on('exit', (code) => {
  console.log('Collage exit code:', code);
  process.exit(code || 0);
});
