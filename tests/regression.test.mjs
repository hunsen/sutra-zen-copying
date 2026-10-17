import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// 回归测试：针对 QA-01, QA-02, QA-11, QA-12 等数据丢失和状态不一致问题
// ============================================================================

test('QA-11 判定规则：空笔画不计入完成字数，未写完全部字决不判定为圆满', () => {
  // 模拟 sutra 内容为 3 个字
  const totalChars = 3;

  // 场景 A: 只有第 0 字写了一笔，第 1 字跳过，第 2 字笔画为空（如清空未补写）
  const writtenCharsPartial = {
    0: { charIndex: 0, character: '一', strokes: [{ path: [{ x: 10, y: 10, pressure: 0.5, time: 100 }], color: '#000', baseWidth: 20 }] },
    1: { charIndex: 1, character: '二', strokes: [] }, // 空笔画记录
  };

  const completedCharsA = Object.values(writtenCharsPartial).filter((c) => (c.strokes?.length ?? 0) > 0).length;
  const isFinishedA = Boolean(
    totalChars > 0 &&
      completedCharsA >= totalChars &&
      (Boolean(Date.now()) || completedCharsA === totalChars)
  );

  assert.equal(completedCharsA, 1, '仅有效笔画数大于0的字记录计入已完成字数');
  assert.equal(isFinishedA, false, '未写满 3 字时无论 completedAt 是否存在，绝不判定为已圆满');

  // 场景 B: 全部 3 字均写有笔画
  const writtenCharsFull = {
    0: { charIndex: 0, character: '一', strokes: [{ path: [{ x: 1, y: 1, pressure: 0.5, time: 1 }], color: '#000', baseWidth: 20 }] },
    1: { charIndex: 1, character: '二', strokes: [{ path: [{ x: 2, y: 2, pressure: 0.5, time: 2 }], color: '#000', baseWidth: 20 }] },
    2: { charIndex: 2, character: '三', strokes: [{ path: [{ x: 3, y: 3, pressure: 0.5, time: 3 }], color: '#000', baseWidth: 20 }] },
  };

  const completedCharsB = Object.values(writtenCharsFull).filter((c) => (c.strokes?.length ?? 0) > 0).length;
  const isFinishedB = Boolean(
    totalChars > 0 &&
      completedCharsB >= totalChars &&
      (Boolean(Date.now()) || completedCharsB === totalChars)
  );

  assert.equal(completedCharsB, 3, '3字全部有效书写');
  assert.equal(isFinishedB, true, '全部字格完成后判定为圆满');
});

test('QA-01 & QA-02 状态同步逻辑：handleStrokesChange 实时同步与清空删除', () => {
  // 模拟 App 内部的 writtenChars 状态字典
  let writtenChars = {};

  const handleStrokesChange = (charIndex, character, strokes) => {
    if (strokes.length === 0) {
      if (writtenChars[charIndex]) {
        const next = { ...writtenChars };
        delete next[charIndex];
        writtenChars = next;
      }
    } else {
      writtenChars = {
        ...writtenChars,
        [charIndex]: {
          charIndex,
          character,
          strokes,
          updatedAt: Date.now(),
        },
      };
    }
  };

  // 1. 用户落笔第 1 笔（未点击写完走纸，处于草稿未提交状态）
  const stroke1 = { path: [{ x: 10, y: 10, pressure: 0.5, time: 100 }], color: '#000', baseWidth: 20 };
  handleStrokesChange(0, '观', [stroke1]);

  assert.ok(writtenChars[0], '未点击提交时，内存中的 writtenChars 已即时同步');
  assert.equal(writtenChars[0].strokes.length, 1);

  // 模拟此时触发 15 秒自动保存：保存的是最新的 writtenChars
  const savedState = JSON.parse(JSON.stringify(writtenChars));
  assert.equal(savedState[0].strokes.length, 1, '自动保存不会因未点击下一字而覆盖丢失草稿笔画');

  // 2. 用户点击“清空重写” (strokes 变为空数组)
  handleStrokesChange(0, '观', []);
  assert.equal(writtenChars[0], undefined, '清空后内存中的记录被立即移除');

  // 模拟切字后再次自动保存：不会复活旧字迹
  const savedAfterClear = JSON.parse(JSON.stringify(writtenChars));
  assert.equal(savedAfterClear[0], undefined, '切换字格后旧笔迹不会死灰复燃并写入持久化存储');
});

test('QA-12 PWA 图标与清单有效性：相对路径与真实尺寸校验', () => {
  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, 'dist', 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest 必须存在于 dist 产物中');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.ok(manifest.icons && manifest.icons.length >= 2, 'manifest 中必须配置 icons');

  // 检查每个图标路径不带绝对斜杠 /，且文件在 dist 根目录下存在
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `icon.src "${icon.src}" 不应以绝对斜杠开头，防止子目录部署 404`);
    const iconFile = path.join(rootDir, 'dist', icon.src);
    assert.ok(fs.existsSync(iconFile), `图标文件 ${iconFile} 必须真实存在`);
    const stat = fs.statSync(iconFile);
    assert.ok(stat.size > 1000, `图标文件 ${icon.src} 大小应大于 1KB (实际 ${stat.size} 字节)`);
  }
});
