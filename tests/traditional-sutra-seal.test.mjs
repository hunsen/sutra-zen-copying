import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('1. 驗證 builtInSutras.ts 中全部經文、題名、作者、回向文與印章皆為純正繁體字', () => {
  const code = fs.readFileSync('src/data/builtInSutras.ts', 'utf8');

  // 驗證心經
  assert.ok(code.includes("title: '般若波羅蜜多心經'"), '心經標題為正體');
  assert.ok(code.includes("authorOrTranslator: '唐·玄奘法師 譯'"), '心經譯者為正體');
  assert.ok(code.includes("category: '佛經'"), '心經分類為正體');
  assert.ok(code.includes("觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。"), '心經開篇為正體');
  assert.ok(code.includes("心無罣礙；無罣礙故，無有恐怖，遠離顛倒夢想，究竟涅槃。"), '心經核心句子為正體');

  // 驗證常清靜經
  assert.ok(code.includes("title: '太上老君說常清靜經'"), '清靜經標題為正體');
  assert.ok(code.includes("authorOrTranslator: '唐·葛玄 筆錄'"), '清靜經筆錄者為正體');
  assert.ok(code.includes("老君曰：大道無形，生育天地；大道無情，運行日月；大道無名，長養萬物；吾不知其名，強名曰道。"), '清靜經正文為正體');

  // 驗證大學·開篇
  assert.ok(code.includes("title: '大學·開篇'"), '大學開篇標題為正體');
  assert.ok(code.includes("category: '儒家經典'"), '大學分類為正體');
  assert.ok(code.includes("大學之道，在明明德，在親民，在止於至善。"), '大學正文為正體');

  // 驗證吉祥經
  assert.ok(code.includes("title: '佛說吉祥經'"), '吉祥經標題為正體');
  assert.ok(code.includes("authorOrTranslator: '南傳三藏 · 李榮熙 譯'"), '吉祥經譯者為正體');

  // 驗證默認印章與回向文
  assert.ok(code.includes("DEFAULT_SEAL_TEXT = '靜心'"), '默認印章為繁體「靜心」');
  assert.ok(code.includes("DEFAULT_DEDICATION_TEXT = '願以此功德，普及於一切，我等與眾生，皆共成佛道。'"), '默認回向文為繁體');
});

test('2. 驗證 s2tData.ts 簡繁轉換工具覆蓋常用印文與經文字符', () => {
  const code = fs.readFileSync('src/data/s2tData.ts', 'utf8');

  assert.ok(code.includes('"静": "靜"'), '映射包含 静->靜');
  assert.ok(code.includes('"净": "淨"'), '映射包含 净->淨');
  assert.ok(code.includes('"观": "觀"'), '映射包含 观->觀');
  assert.ok(code.includes('"欢": "歡"'), '映射包含 欢->歡');
  assert.ok(code.includes('"萨": "薩"'), '映射包含 萨->薩');
  assert.ok(code.includes('"愿": "願"'), '映射包含 愿->願');
});

test('3. 驗證 chineseStrokeData.ts 完整收錄繁體字標準筆畫數', () => {
  const code = fs.readFileSync('src/data/chineseStrokeData.ts', 'utf8');

  const checkChars = ['觀', '薩', '蘊', '識', '諸', '滅', '淨', '無', '靜', '學', '國', '齊'];
  for (const ch of checkChars) {
    assert.ok(code.includes(`"${ch}":`), `chineseStrokeData 應收錄繁體字 ${ch}`);
  }
});

test('4. 驗證 ScrollExporter.ts 与 SutraScrollCanvas.tsx 楷體字體棧與小篆印章自適應', () => {
  const exporter = fs.readFileSync('src/engine/ScrollExporter.ts', 'utf8');
  assert.ok(exporter.includes('KAI_TI_FONT_STACK'), '使用統一楷體字體棧');
  assert.ok(exporter.includes('"Kaiti TC"'), '字體棧優先繁體楷體 Kaiti TC');
  assert.ok(exporter.includes('"BiauKai"'), '字體棧包含標楷體 BiauKai');
  assert.ok(exporter.includes('ANCIENT_SEAL_FONT_STACK'), '定義古代小篆印章字體棧');
  assert.ok(exporter.includes('"AncientSeal"'), '包含 AncientSeal 小篆字體');
  assert.ok(exporter.includes('numChars === 1'), '支持 1 字印自適應排版');
  assert.ok(exporter.includes('numChars === 2'), '支持 2 字印自適應排版');
  assert.ok(exporter.includes('numChars === 3'), '支持 3 字印自適應排版');
  assert.ok(exporter.includes('numChars === 4'), '支持 4 字印自適應排版');

  const canvas = fs.readFileSync('src/components/SutraScrollCanvas.tsx', 'utf8');
  assert.ok(canvas.includes('KAI_TI_FONT_STACK'), 'SutraScrollCanvas 使用楷體字體棧');
  assert.ok(canvas.includes('toTraditional'), 'SutraScrollCanvas 調用繁體轉換');
});

test('5. 驗證 AncientSeal.woff2 字體文件已正確部署至 src/assets/fonts 與 public/fonts', () => {
  assert.ok(fs.existsSync('src/assets/fonts/AncientSeal.woff2'), 'src/assets/fonts/AncientSeal.woff2 存在');
  assert.ok(fs.existsSync('public/fonts/AncientSeal.woff2'), 'public/fonts/AncientSeal.woff2 存在');
  assert.ok(fs.statSync('public/fonts/AncientSeal.woff2').size > 1000000, '字體大小正常 (~2MB)');
});

test('6. 驗證印章字體充滿印面（滿白/滿朱章法）與米字格書寫字模加大至 88%', () => {
  const exporter = fs.readFileSync('src/engine/ScrollExporter.ts', 'utf8');
  assert.ok(exporter.includes('drawSealChar'), '定義印章字符居中縮放繪製輔助函數');
  assert.ok(exporter.includes('雙列並峙'), '二字印採用雙列並峙章法完全充實左右兩廂');
  assert.ok(exporter.includes('右二左一'), '三字印採用右二左一飽滿佈局');
  assert.ok(exporter.includes('田字格'), '四字印採用經典田字格茂密滿白佈局');

  const pad = fs.readFileSync('src/components/ZoomWritingPad.tsx', 'utf8');
  assert.ok(pad.includes('innerSize * 0.88'), '米字格書寫底模尺寸比例提升至 88%');
});

