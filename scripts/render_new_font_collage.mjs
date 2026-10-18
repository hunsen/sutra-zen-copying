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
    background: #0f1115;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h1 {
    text-align: center;
    font-size: 30px;
    margin-bottom: 8px;
    color: #f8fafc;
    letter-spacing: 1px;
  }
  p.subtitle {
    text-align: center;
    color: #94a3b8;
    margin-bottom: 32px;
    font-size: 15px;
  }
  .explanation-box {
    background: #1e1b18;
    border-left: 4px solid #f59e0b;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 36px;
    font-size: 14.5px;
    line-height: 1.7;
    color: #d1d5db;
  }
  .explanation-box strong {
    color: #fbbf24;
  }
  .section {
    background: #181b22;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 32px;
    border: 1px solid #2e3646;
  }
  .section-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge {
    font-size: 13px;
    padding: 4px 12px;
    border-radius: 9999px;
    font-weight: 600;
  }
  .badge-bakudai { background: #b45309; color: #fff; }
  .badge-masa { background: #0284c7; color: #fff; }
  .badge-tw { background: #475569; color: #e2e8f0; }
  .desc {
    font-size: 14px;
    color: #94a3b8;
    margin-bottom: 20px;
    line-height: 1.6;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card {
    background: #0b0d11;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #283040;
  }
  .card-header {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: #cbd5e1;
    background: #141720;
    border-bottom: 1px solid #283040;
  }
  img {
    width: 100%;
    display: block;
  }
</style>
</head>
<body>
  <h1>真迹毛笔书法 vs 电脑标楷体 · 实机视觉效果对比</h1>
  <p class="subtitle">100% 免费商用 · 经文全字库 0 缺字 · 真正具有毛笔运笔顿挫的真实字形</p>

  <div class="explanation-box">
    <strong>为什么之前的 A 与 B 方案效果看起来一样？</strong><br>
    您看得很准！此前候选的「寒蝉正楷 (ChillKai)」的汉字字模实际上就是完整引用了「全字库正楷 (TW-Kai)」的繁体字库（仅替换了西文字母），因此两者的<strong>中文字体实际上是同一套字模</strong>，都属于官方规范的“标楷体”，排版起来依然偏向标准公文印刷体，缺少书法真迹的毛笔提按韵味。<br>
    为此，我们特别提取了著名书法家手书真迹、经开源社区完整补齐繁体字库的两款<strong>真正毛笔书法真迹字体</strong>进行实机对比。
  </div>

  <!-- 新方案 1 -->
  <div class="section">
    <div class="section-title">
      <span class="badge badge-bakudai">新推荐 · 首选</span>
      <span>莫大毛笔楷书 (Bakudai) —— 书法家手书真迹正楷 · 墨韵浑厚</span>
    </div>
    <div class="desc">
      <strong>字源：</strong>日本著名书法家青柳衡山手书真迹楷书，经开源社区深度补齐繁体大字库（24,495 字，心经等全部经文 0 缺字）。<br>
      <strong>风骨：</strong>点如坠石、撇捺舒展、顿挫雄浑，具有浓郁纯正的毛笔书写墨韵与起笔藏锋，临摹感极佳！<br>
      <strong>授权：</strong>SIL Open Font License 1.1（100% 免费可商用，支持无限制嵌入）。
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-header">【莫大毛笔楷书】古法宣纸（长卷与米字格正楷临写）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-bakudai-01-desktop-full.png')}" />
      </div>
      <div class="card">
        <div class="card-header">【莫大毛笔楷书】磁青泥金（皇家藏金写经风格）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-bakudai-02-ciqing-gold.png')}" />
      </div>
    </div>
  </div>

  <!-- 新方案 2 -->
  <div class="section">
    <div class="section-title">
      <span class="badge badge-masa">备选方案 · 行楷</span>
      <span>正风毛笔行楷 (MasaFont) —— 行云流水 · 笔意连绵</span>
    </div>
    <div class="desc">
      <strong>字源：</strong>青柳衡山手书真迹行楷，经开源社区深度补齐繁体大字库（23,699 字，经文 0 缺字）。<br>
      <strong>风骨：</strong>笔势连贯、潇洒超逸，如文人雅士抄经写意，极具书法流动美感。<br>
      <strong>授权：</strong>SIL Open Font License 1.1（100% 免费可商用）。
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-header">【正风毛笔行楷】古法宣纸（长卷与米字格行楷临写）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-masafont-01-desktop-full.png')}" />
      </div>
      <div class="card">
        <div class="card-header">【正风毛笔行楷】磁青泥金（皇家藏金写经风格）</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-masafont-02-ciqing-gold.png')}" />
      </div>
    </div>
  </div>

  <!-- 对照方案 -->
  <div class="section">
    <div class="section-title">
      <span class="badge badge-tw">原方案</span>
      <span>全字库正楷 / 寒蝉正楷 (TW-Kai / ChillKai) —— 电脑标楷体</span>
    </div>
    <div class="desc">
      <strong>特征：</strong>标准公文标楷体，工整规范但偏向电脑字库印刷感，笔画粗细均匀，缺少手工毛笔书法的提按变化。
    </div>
    <div class="grid">
      <div class="card">
        <div class="card-header">【电脑标楷体】古法宣纸效果</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-B-twkai-01-desktop-full.png')}" />
      </div>
      <div class="card">
        <div class="card-header">【电脑标楷体】磁青泥金效果</div>
        <img src="file://${path.join(EVIDENCE_DIR, 'preview-B-twkai-02-ciqing-gold.png')}" />
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('/tmp/new_font_collage.html', htmlContent);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(chromePath, [
  '--headless=new',
  '--no-first-run',
  '--disable-gpu',
  '--allow-file-access-from-files',
  '--window-size=2000,3200',
  '--screenshot=' + path.join(EVIDENCE_DIR, 'real_calligraphy_vs_standard_kai.png'),
  '/tmp/new_font_collage.html'
]);

proc.on('exit', (code) => {
  console.log('Collage exit code:', code);
  process.exit(code || 0);
});
