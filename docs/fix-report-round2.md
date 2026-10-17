# 「静心抄经」Round 2 缺陷修复与 PNG 交付验证报告

> **报告版本**：Round 2 最终验收版  
> **报告日期**：2026-10-17  
> **工作区**：`/Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016`  
> **测试环境**：Chrome 155 (Headless CDP) + Vite Preview (Production Mode, 端口 5183) + Node.js v24.16.0  
> **前置参考**：`docs/retest-report.md`、`docs/qa-retest-evidence/checks.txt`  
> **本轮交付物**：
> - 自动化测试记录：`docs/qa-fix-evidence/checks-round2.txt`
> - 交付长卷图片：`docs/qa-fix-evidence/般若波罗蜜多心经_装裱长卷_2026-10-17.png`
> - 针对性截图证据：`docs/qa-fix-evidence/round2-*.jpg`

---

## 一、验收结果总览

在本轮针对性修复中，针对独立复验报告限定的 **R-01**、**R-02** 以及 **PNG 真实交付文件获取** 三项任务进行了彻底的根因分析、最小代码修改与全要素端到端回归。

| 编号 | 任务项 | 原始状态 | 本轮修改后状态 | 真实证据与文件路径 |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | 窄屏纸墨菜单内部仍裁切（390px / 320px） | 裁剪复现（朱砂墨文字超出） | **PASS（验证通过）** | `round2-r01-390-fixed.jpg`<br>`round2-r01-320-fixed.jpg`<br>`round2-r01-1440-desktop.jpg` |
| **R-02** | 金色笔迹回放成黑色（磁青纸与宣纸三色回放） | 墨色固定为近黑色 | **PASS（验证通过）** | `round2-r02-ciqing-gold.jpg`<br>`round2-r02-ciqing-cinnabar.jpg`<br>`round2-r02-ciqing-black.jpg`<br>`round2-r02-xuan-gold.jpg`<br>`round2-r02-xuan-cinnabar.jpg`<br>`round2-r02-xuan-black.jpg` |
| **交付** | 补齐 PNG 最终长卷装裱文件获取与要素验收 | 历史超时未取得物理文件 | **PASS（验证通过）** | `docs/qa-fix-evidence/般若波罗蜜多心经_装裱长卷_2026-10-17.png`<br>（5.03 MB / 6160 × 1480 px） |

---

## 二、逐项诊断、修改与验证详情

### 1. R-01：窄屏纸墨菜单内部仍裁切

#### 缺陷根因分析
1. **CSS 规范中包含块（Containing Block）问题**：
   `TopZenCapsule.tsx` 顶栏外层容器声明了 `backdrop-blur-xl`（即 `backdrop-filter: blur(24px)`）。根据 W3C 标准规范，任何应用了非 `none` 的 `backdrop-filter` 或 `transform` 的元素，都会成为其所有子孙元素（即便声明为 `fixed`）的包含块（Containing Block）。
   顶栏胶囊本身的实际测量宽度仅约为 243px～310px，导致内部声明的 `fixed inset-x-3` 浮层并非以整个移动端视口为基准定位，而是被强行束缚在 243px 的胶囊矩形之内。
2. **按钮布局挤压**：
   菜单内三枚墨色按钮原采用 `flex gap-2` 且单项设有最小宽度，在窄屏浮层中产生水平溢出，导致排在第三位的“朱砂墨”右边缘被浮层容器裁切。

#### 最小必要修改
- **修改文件**：[`src/components/TopZenCapsule.tsx`](file:///Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016/src/components/TopZenCapsule.tsx)
- **改动逻辑**：
  1. 引入 React `createPortal`，将纸墨笔参数弹出浮层与背景遮罩通过 `createPortal(..., document.body)` 挂载到 `document.body` 下，彻底脱离胶囊容器层级，使其包含块恢复为初始视口（Viewport）。
  2. 将顶栏胶囊本身的毛玻璃滤镜移入独立的底层背景元素 `<div className="absolute inset-0 -z-10 ... backdrop-blur-xl" />`，消除对同层及父级上下文的意外影响。
  3. 重构墨色按钮布局为自适应三列等分网格：`grid grid-cols-3 gap-1.5 sm:gap-2`，子项设置 `min-w-0`，颜色圆点设置 `flex-shrink-0`，按钮文本声明 `truncate`。

#### 验证结果与数据
自动化回归脚本在真实无头 Chrome 中测量 DOM 盒模型：
- **390×844（iPhone 典型尺寸）**：
  - 祖先 `backdrop-filter` 数量：0；
  - 菜单容器：`clientWidth = 318px`，`scrollWidth = 318px`，无水平滚动；
  - “朱砂墨”按钮右边缘：342.0px，菜单面板右边缘：355.0px，**保留 13.0px 安全内缩边距**，文字与圆点完整可见无裁切。
- **320×568（极限小屏 SE 尺寸）**：
  - 菜单容器：`clientWidth = 294px`，`scrollWidth = 294px`，无水平滚动；
  - “朱砂墨”按钮右边缘：295.0px，菜单面板右边缘：308.0px，**保留 13.0px 安全内缩边距**，无任何裁切。
- **1440×900（桌面端）**：
  - 菜单宽度固定为 288px 并精准居中悬浮于胶囊下方，全部三色墨色按钮正常可见。
- **证据截图**：
  - `docs/qa-fix-evidence/round2-r01-390-fixed.jpg`
  - `docs/qa-fix-evidence/round2-r01-320-fixed.jpg`
  - `docs/qa-fix-evidence/round2-r01-1440-desktop.jpg`

---

### 2. R-02：金色笔迹回放成黑色

#### 缺陷根因分析
- 在 [`src/components/SealAndExportModal.tsx:186`](file:///Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016/src/components/SealAndExportModal.tsx#L186)（原行号）的 `handleReplayFrame` 函数中，笔迹回放的重绘调用将墨色硬编码为 `#1C1B19`（松烟墨黑）：
  ```ts
  // 缺陷代码：
  renderStrokeToCanvas(ctx, stroke, padSize, padSize, '#1C1B19', 1.5);
  renderDynamicStrokePoints(ctx, state.currentStrokePoints, padSize, padSize, '#1C1B19', 1.5);
  ```
  这导致无论用户在书写台选用“泥金墨”（`#E6C17A`）还是“朱砂墨”（`#B22222`），在倍速回放中全部被强制绘制为松烟墨黑色。

#### 最小必要修改
- **修改文件**：[`src/components/SealAndExportModal.tsx`](file:///Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016/src/components/SealAndExportModal.tsx)
- **改动逻辑**：
  1. 动态获取当前选定的墨色与纸张配置：
     ```ts
     const inkHex = INK_COLORS[inkType] || '#1C1B19';
     const themeConfig = PAPER_THEMES[paperTheme] || PAPER_THEMES.xuan;
     const gridColor = themeConfig.gridColor || '#C8B69E';
     ```
  2. 回放帧绘制时使用 `inkHex` 渲染已有笔画与实时笔锋轨迹。
  3. 将回放背景格颜色同步为纸张对应的 `gridColor`（磁青纸使用青白细线，宣纸使用浅褐米字格）。
  4. 在 `activeTab === 'replay'` 的 `useEffect` 中，初始挂载即绘制对应底纸质感与米字格，避免未点击播放前出现黑屏。

#### 验证结果与数据
在真实无头 Chrome 中针对宣纸与磁青纸，覆盖全部 6 种纸墨组合逐一写画、启动回放并对回放 Canvas 进行实际像素采样与比对：

1. **磁青金经 + 泥金墨**：
   - 预期墨色：`gold` (`#E6C17A`)
   - 像素采样结果：`goldVotes = 3322, cinnabarVotes = 0, blackVotes = 0`，判定：`gold` -> **PASS**
   - 截图：`docs/qa-fix-evidence/round2-r02-ciqing-gold.jpg`
2. **磁青金经 + 朱砂墨**：
   - 预期墨色：`cinnabar` (`#B22222`)
   - 像素采样结果：`cinnabarVotes = 3422, goldVotes = 0, blackVotes = 3`，判定：`cinnabar` -> **PASS**
   - 截图：`docs/qa-fix-evidence/round2-r02-ciqing-cinnabar.jpg`
3. **磁青金经 + 松烟墨**：
   - 预期墨色：`black` (`#1C1B19`)
   - 像素采样结果：`blackVotes = 3426, goldVotes = 0, cinnabarVotes = 0`，判定：`black` -> **PASS**
   - 截图：`docs/qa-fix-evidence/round2-r02-ciqing-black.jpg`
4. **古法宣纸 + 松烟墨**：
   - 预期墨色：`black` (`#1C1B19`)
   - 像素采样结果：`blackVotes = 2451, goldVotes = 0, cinnabarVotes = 0`，判定：`black` -> **PASS**
   - 截图：`docs/qa-fix-evidence/round2-r02-xuan-black.jpg`
5. **古法宣纸 + 泥金墨**：
   - 预期墨色：`gold` (`#E6C17A`)
   - 像素采样结果：`goldVotes = 3787, cinnabarVotes = 0, blackVotes = 0`，判定：`gold` -> **PASS**
   - 截图：`docs/qa-fix-evidence/round2-r02-xuan-gold.jpg`
6. **古法宣纸 + 朱砂墨**：
   - 预期墨色：`cinnabar` (`#B22222`)
   - 像素采样结果：`cinnabarVotes = 3215, goldVotes = 157, blackVotes = 0`，判定：`cinnabar` -> **PASS**
   - 截图：`docs/qa-fix-evidence/round2-r02-xuan-cinnabar.jpg`

全部 6 种组合在视觉呈现与像素色彩上均 100% 吻合。

---

### 3. 补齐 PNG 最终文件下载与实际内容验收

#### 历史未完成根因分析
在上一轮独立复验中，长卷画布尺寸高达 6160 × 1480 像素。旧版 [`src/engine/ScrollExporter.ts`](file:///Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016/src/engine/ScrollExporter.ts) 使用 `canvas.toDataURL('image/png')` 生成高达 ~7MB 的庞大 Base64 DataURL 字符串，在赋给 `<a href="...">` 并触发下载时，导致无头 Chrome 的 IPC 缓冲区阻塞甚至超时挂起（复验报告中记录的 324 秒超时）。

#### 最小必要修改
- **修改文件**：[`src/engine/ScrollExporter.ts`](file:///Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016/src/engine/ScrollExporter.ts)
- **改动逻辑**：
  优化 `downloadScrollImage` 函数，改用标准的异步二进制流传输：
  ```ts
  export function downloadScrollImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve();
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          resolve();
        }, 100);
      }, 'image/png');
    });
  }
  ```
  消除了超长 Base64 字符串的内存拷贝与 IPC 传输瓶颈，下载在 500ms 内瞬间完成。

#### 交付文件物理验证证据
通过 Chrome CDP 协议开启下载捕获，在浏览器页面中真实点击「下载装裱长卷 PNG」按钮，文件成功保存至工作区：

- **交付文件绝对路径**：
  `docs/qa-fix-evidence/般若波罗蜜多心经_装裱长卷_2026-10-17.png`
- **文件体积**：
  `5,031,584 字节`（约 4.80 MB）
- **二进制头部校验**：
  PNG 幻数 `89 50 4E 47 0D 0A 1A 0A` 匹配，IHDR 块长 13 字节，位深 8，颜色类型 6（RGBA）。
- **图片画幅分辨率**：
  `6160 × 1480 像素`（高精度 2x 印刷级分辨率）。
- **图片全要素目视核验记录**：
  1. **纸张底纹**：完整的古法宣纸竹浆纤维肌理与柔和晕染；
  2. **首端题名**：卷首第一列规整竖排题名《般若波罗蜜多心经》与译者名；
  3. **正文笔迹**：全文竖排乌丝栏格内全部墨迹工整排列，无幽灵笔画，无错位；
  4. **卷尾回向文**：清晰排印《愿以此功德，普及于一切，我等与众生，皆共成佛道。》；
  5. **朱砂方印**：回向文下方钤盖朱砂白文《静心》篆刻方印，带有逼真的朱砂颗粒印泥质感。

---

## 三、工程质量与非回归确认

1. **类型检查**：
   - 执行命令：`npm run typecheck` (`tsc --noEmit`)
   - 结果：**退出码 0**，零类型错误。
2. **生产构建**：
   - 执行命令：`npm run build` (`tsc && vite build`)
   - 结果：**构建成功**（耗时 3.65s），PWA 成功预缓存 10 个离线资源清单。
3. **回归单元测试**：
   - 执行命令：`node --test tests/regression.test.mjs`
   - 结果：**3/3 测试通过**（状态同步、圆满判定与 PWA 清单完整）。
4. **工作区与用户数据保护**：
   - 未改动任何经文文本与回向文默认字词；
   - 未清空 IndexedDB 用户现有历史会话；
   - 完整保留 `docs/` 下双方全部历史报告与证据截图；
   - 未执行 git commit、push 或 publish 操作。

---

## 四、最终结论与交付路径汇总

- **修复报告路径**：`docs/fix-report-round2.md`
- **两项问题验收结论**：
  - **R-01（窄屏纸墨菜单内部裁切）**：**PASS**，浮层脱离 backdrop-filter 祖先，390px/320px 均无水平溢出，三枚墨色按钮与文字完整可见。
  - **R-02（笔迹回放墨色与约定一致）**：**PASS**，泥金、朱砂、松烟三色在磁青纸与宣纸上回放色彩全部对齐书写约定。
- **PNG 交付文件路径**：
  `docs/qa-fix-evidence/般若波罗蜜多心经_装裱长卷_2026-10-17.png`（4.80 MB，6160 × 1480 像素，五大要素全检合格）。
