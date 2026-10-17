# 「静心抄经」QA-01 ～ QA-12 缺陷修复与实际验证状态报告

> **报告版本**：v2.0（真实性核对更正版）  
> **报告日期**：2026-10-17  
> **工作区**：`/Users/hunsen/Desktop/WORKSTATION/Antigravity/vibe1016`  
> **验证工具与环境**：
> - 桌面与移动端浏览器自动化：Chrome 155 (Headless CDP) + Vite Preview (Production Mode, 端口 5174)
> - 本地测试运行器：Node.js v24.16.0 内置 `node:test` (`tests/regression.test.mjs`)
> - 静态检查与构建：TypeScript 5.6.3 (`tsc --noEmit`), Vite 5.4.10 (`vite build`)
> - 原始 QA 证据保留：`docs/qa-evidence/`（全部保留，未修改、未删除）
> - 新增回归截图：`docs/qa-fix-evidence/`

---

## 核心核对与审计说明（真实性勘误）

针对此前验证过程中的矛盾点，在此如实勘误并严格澄清：

1. **QA-10 验证结果勘误**：
   - 在首次自动化回归脚本生成的 `docs/qa-fix-evidence/checks.txt` 中，QA-10 曾记录为两条 `FAIL`（原因是在自动化脚本中，模态框开启选择器与内部 Canvas 检索时机出现偏差，导致 `initialSealCanvasPixels` 返回 `undefined`），但旧脚本末尾直接输出了“所有问题通过”的总结。该总结失实。
   - 经后续选择器校准并在真实浏览器中重新捕获，印章 Canvas 首次打开以及在“笔迹回放”与“钤印导出”往返切换后，印章均完整绘制，非零像素点数为 8100（证据截图见 `docs/qa-fix-evidence/06a-seal-preview-initial-fixed.jpg` 及 `06b-seal-preview-after-tab-switch-fixed.jpg`）。
   - **本报告据实记录**：代码与截图已修复且直观正常，但自动化日志 `checks.txt` 存在首次运行失败的历史记录，已在本文中进行详尽对比说明。

2. **长卷 PNG 导出实际下载**：
   - `scripts/verify-all-qa.mjs` 在未取得真实 PNG 数据流及未完成文件二进制校验时，曾以“导出函数已触发”标记为 PASS。
   - **本报告据实更正**：由于未能通过 CDP 捕获并在本地落盘检查导出的实际 PNG 二进制头部与图片内容，该项**明确标为「尚未验证」**，决不以“触发函数”替代真实下载验证。

3. **QA-01 15 秒定时保存覆盖测试**：
   - 自动化测试中仅在落笔后等待约 2 秒即刷新验证了内存恢复与初步持久化，**未完整等待跨越两轮 15 秒（30秒以上）自动保存周期**后再刷新。
   - **本报告据实记录**：该项当前为“已修改，部分验证通过”，但“跨多轮 15 秒自动保存不被冲掉”留有验证限制。

4. **QA-11 缺字跳过与圆满状态验证**：
   - 自动化脚本中仅打开功德簿检查了默认经文在未写完时无“已圆满”徽标，**未能完整自动执行原始 QA-11 的三字帖（自建“一二三”、写第1字、跳第2字、提交第3字）的端到端复现交互**。
   - **本报告据实记录**：该项当前为“已修改，部分验证通过”，完整端到端跳字复现仍属验证限制。

5. **`tests/regression.test.mjs` 测试覆盖边界**：
   - 单元测试文件中为了脱离 React 渲染树验证核心算法，提取并模拟了 `handleStrokesChange` 与 `completedChars` 计算逻辑。该测试证明了算法与边界规则本身的自洽性，但**不能直接证明 `App.tsx` 与 React 状态生命周期在所有渲染周期下的完全正确性**。报告中明确此项覆盖限制。

---

## QA-01 ～ QA-12 逐项详细诊断与验证状态

### QA-01 (P1) · 未提交笔画被自动保存覆盖，刷新后丢失

- **缺陷根因**：
  在 `App.tsx` 中，`writtenChars` 状态仅在 `handleCharComplete`（点击“写完走纸”）时更新。当用户在 `ZoomWritingPad` 中画下笔画但未点击提交时，底层虽然将单笔画存入 DB，但 `App.tsx` 内存中的 `writtenChars` 字典对应字格依然为空。15 秒定时器 `persistSession()` 触发时，使用空的 `writtenChars` 整体覆写 IndexedDB 会话，将草稿冲掉。刷新页面后草稿丢失。
- **修改文件及位置**：
  - `src/App.tsx:249-270`：新增 `handleStrokesChange` 回调，在用户落笔、撤销、清空时，实时将最新笔画字典同步给 `App` 层的 `writtenChars` 与 `stateRef.current`，使 15 秒定时保存时始终拥有最新的草稿数据。
  - `src/components/ZoomWritingPad.tsx`：通过 `onStrokesChange` 将每次笔画变更实时上报。
- **已执行的验证及证据**：
  - 在 390×844 视口下用真实 PointerEvent 落笔第 1 笔；
  - 截图 `docs/qa-fix-evidence/07-draft-before-reload-fixed.jpg`；
  - 刷新页面后，笔迹与状态完整从 IndexedDB 恢复，撤销按钮处于启用状态，笔画徽标显示 `1/6笔`；
  - 截图 `docs/qa-fix-evidence/08-draft-after-reload-fixed.jpg`。
- **当前状态**：**已修改，部分验证通过**
- **剩余问题与验证限制**：
  - 自动化脚本中落笔后仅等待约 2 秒即触发刷新，尚未在真实浏览器中持续等待两轮（30秒以上）15秒定时器周期后再刷新，严格的长等待自动保存场景未完成全自动化覆盖。

---

### QA-02 (P1) · 清空已提交字后，切换字格又恢复旧笔迹

- **缺陷根因**：
  点击“重写”虽然清空了画布并通知 DB 删除该字，但父组件 `App.tsx` 的 `writtenChars[currentIndex]` 没有被物理删除。切到下一字再点击“上一字”返回时，`App.tsx` 把未清理的旧对象再次传入 `ZoomWritingPad`，导致已被清空的笔迹死灰复燃并重新存入 DB。
- **修改文件及位置**：
  - `src/App.tsx:254-258`：在 `handleStrokesChange` 中，当 `strokes.length === 0` 时，显式执行 `delete next[currentIndex]`。
  - `src/db/localDb.ts:465-467`：在汇总与查询时过滤掉 `strokes.length === 0` 的空记录。
- **已执行的验证及证据**：
  - 390×844 视口下，点击“重写”清空第 1 字；
  - 点击“写完走纸”前进到第 2 字，再点击“回到上一字”返回第 1 字；
  - 实测当前字维持纯净空白，撤销按钮禁用（`undoDisabled: true`），笔画计数保持 `0/6笔`；
  - 截图 `docs/qa-fix-evidence/03-cleared-stroke-not-returning.jpg`。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-03 (P1) · 窄屏纸墨菜单越界，部分设置无法访问

- **缺陷根因**：
  1. `tailwind.config.js` 中 `fadeIn` 关键帧包含 `transform: scale(...)`，直接覆盖了 Tailwind 负边距/位移类（如 `-translate-x-1/2`）。
  2. `TopZenCapsule.tsx` 的胶囊容器使用了 `left-1/2 -translate-x-1/2`，根据 CSS 规范，拥有 transform 的元素会为其内部的 `position: fixed` 子元素创建新的 Containing Block（包含块），导致移动端弹窗脱离视口居中基准，向右严重偏移越界。
- **修改文件及位置**：
  - `tailwind.config.js`：从 `fadeIn` 中剔除 `transform`，仅保留纯透明度过渡。
  - `src/components/TopZenCapsule.tsx:103-108`：胶囊外层改为 `inset-x-0 mx-auto w-fit max-w-[96vw]`（零 CSS transform 水平居中）。
  - `src/components/TopZenCapsule.tsx:150`：移动端弹窗改为 `fixed inset-x-3 top-14 mx-auto w-auto max-w-xs max-h-[calc(100vh-80px)] overflow-y-auto`。
- **已执行的验证及证据**：
  - 390×844 视口下点击纸墨按钮展开菜单；
  - DOM 实测边界：left = 80.9px, right = 309.1px（视口宽 390px，左右均留有约 80px 边距，无越界）；
  - 截图 `docs/qa-fix-evidence/04-narrow-theme-menu-centered-fixed.jpg`。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-04 (P2) · 宽屏模式下长卷区域被限制在 200px 矮条

- **缺陷根因**：
  `src/App.tsx:432` 中的横向长卷区域固定使用了 `max-h-[200px]`，且缺少针对桌面大屏与横屏断点的覆盖样式，导致 1440×900 和 1920×1080 桌面屏幕上长卷只能局限在 200px 矮缝中。
- **修改文件及位置**：
  - `src/App.tsx:432-435`：添加 `landscape:min-h-0 landscape:max-h-none lg:min-h-0 lg:max-h-none`，彻底解除大屏垂直高度钳制。
- **已执行的验证及证据**：
  - 1440×900 视口下实测长卷容器实际渲染高度达到 **818px**（截图 `docs/qa-fix-evidence/01-wide-1440x900-fixed.jpg`）；
  - 1920×1080 视口下实测长卷容器实际渲染高度达到 **998px**（截图 `docs/qa-fix-evidence/12-production-wide-1920x1080-fixed.jpg`）。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-05 (P2) · 小手机 320×568 底部走纸模式控件被裁切

- **缺陷根因**：
  在 320×568 极小屏幕（iPhone SE 1代）上，固定尺寸的顶部栏、画布方格和操作按钮垂直高度总和超出 568px，而页面最外层设置了 `overflow: hidden`，导致底部的“走纸模式”控制行溢出到屏幕底部之外无法触达。
- **修改文件及位置**：
  - `src/components/ZoomWritingPad.tsx:836`：画布方格最大尺寸采用动态自适应 `max-w-[min(380px,88vw,calc(100dvh-335px))] max-h-[min(380px,88vw,calc(100dvh-335px))]`。
  - `src/App.tsx:490`：书写区域祖先容器补充 `overflow-x-hidden overflow-y-auto no-scrollbar` 弹性滚动兜底。
- **已执行的验证及证据**：
  - 320×568 视口下实测走纸模式按钮底部坐标为 **548.8px**，完全处于 568px 视口以内（截图 `docs/qa-fix-evidence/05-small-320x568-fixed.jpg`）；
  - 当前字、书写方格、撤销/重写/走纸按钮、走纸模式设置全部可见可用。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-06 (P2) · 手机横屏 844×390 走纸设置顶部被遮挡／裁切

- **缺陷根因**：
  原菜单采用 `absolute bottom-full left-2` 向上展开，在手机横屏（844×390，高度仅 390px）时，向上弹出的面板顶部直接冲出视口，且标题和关闭入口被顶栏遮挡。
- **修改文件及位置**：
  - `src/components/ZoomWritingPad.tsx:984-994`：在移动端与横屏下统一调整为基于视口垂直居中的模态浮层 `fixed inset-x-3 top-1/2 -translate-y-1/2 mx-auto w-auto max-w-xs max-h-[88dvh] overflow-y-auto`，仅在桌面端（`lg:`）恢复吸附展示。
- **已执行的验证及证据**：
  - 844×390 视口下点击走纸模式展开设置面板；
  - 实测面板渲染区域：top = 0px, bottom = 390px，标题“选择抄经节奏”、关闭按钮“✕”、3 种模式卡片与缓冲延时按钮全部位于视口内部可见可点；
  - 截图 `docs/qa-fix-evidence/10-landscape-settings-unclipped-fixed.jpg`。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-07 (P2) · 多个设置面板实际没有背景色，文字与底图混叠

- **缺陷根因**：
  各弹窗面板类名使用了 `bg-stone-900/98`。默认 Tailwind CSS 仅预置 `95` 等不透明度，未预置 `98`（0.98），导致该原子类未能编译出有效的 CSS 规则，浏览器计算值为 `rgba(0, 0, 0, 0)`（完全透明）。
- **修改文件及位置**：
  - `tailwind.config.js`：在 `theme.extend` 中补充 `opacity: { 98: '0.98' }`。
  - `TopZenCapsule.tsx` 与 `ZoomWritingPad.tsx` 弹窗均补充硬编码行内样式保底：`style={{ backgroundColor: 'rgba(28, 25, 23, 0.98)' }}`。
- **已执行的验证及证据**：
  - 在 1440×900 视口下打开笔触菜单，实测面板计算背景色为 `rgba(28, 25, 23, 0.98)`；
  - 浅色纸面与底层大字完全被实心深色背景遮盖，文字清晰锐利；
  - 截图 `docs/qa-fix-evidence/14-brush-menu-solid-fixed.jpg`。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-08 (P2) · 中等宽度顶栏纸墨名称纵向换行，遮住内容

- **缺陷根因**：
  在 768px（平板竖屏）与 844px（手机横屏）断点处，胶囊容器未加不折行控制，次要文字“古法宣纸 · 14px”等被压缩折成多行，导致胶囊高度从 36px 膨胀到约 90px，遮挡下方手卷与书写台。
- **修改文件及位置**：
  - `src/components/TopZenCapsule.tsx:108`：胶囊容器添加 `whitespace-nowrap flex-nowrap`。
  - `src/components/TopZenCapsule.tsx:131-136`：针对中等宽度断点精简文字。
- **已执行的验证及证据**：
  - 844×390 手机横屏实测胶囊高度为 **46px**（截图 `docs/qa-fix-evidence/09-landscape-844x390-fixed.jpg`）；
  - 768×1024 平板竖屏实测胶囊高度为 **46px**（截图 `docs/qa-fix-evidence/15-tablet-768x1024-fixed.jpg`）。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-09 (P2) · 磁青与红金主题下当前字及序号几乎不可读

- **缺陷根因**：
  书写台顶部指示栏原先固定使用 `text-stone-700`、`text-stone-900` 等深色文本类名，切换到深蓝底色的“磁青金经”或深红底色的“酒金红笺”时，前景深色字与背景深色底严重贴合，几乎不可辨认。
- **修改文件及位置**：
  - `src/components/ZoomWritingPad.tsx:50-51`：新增 `isDarkPaper` 判定。
  - `src/components/ZoomWritingPad.tsx:649-688`：深色纸下，当前字「观」设为高亮象牙白 `text-amber-100`，序号胶囊与徽标转为琥珀金色调背景与边框。
  - `src/components/ZoomWritingPad.tsx:908-936`：底部“撤销”、“重写”、“上一字”按钮在深色纸下同步切换为深石色高对比度按钮。
- **已执行的验证及证据**：
  - 390×844 视口下切换至磁青主题，实测当前字颜色计算值为 `rgb(254, 243, 199)`，序号颜色计算值为 `rgb(253, 230, 138)`（截图 `docs/qa-fix-evidence/02-narrow-390x844-ciqing-fixed.jpg`）；
  - 切换至红金主题，对比度同样显著增强（截图 `docs/qa-fix-evidence/02b-narrow-390x844-red-gold-fixed.jpg`）。
- **当前状态**：**验证通过**
- **剩余问题与验证限制**：无。

---

### QA-10 (P2) · 印章实景预览首次为空白，切换标签后再次消失

- **缺陷根因**：
  `SealAndExportModal.tsx:80` 的绘制 `useEffect` 原先依赖数组仅为 `[sealText, sealStyle]`。模态框初次挂载时 `sealText` 保持默认值未发生变更，或者切换到“笔迹回放”再切回“钤印导出”导致 Canvas 重新挂载时，`useEffect` 均不会重新执行，导致新挂载的 Canvas 2D 上下文保持空白。
- **修改文件及位置**：
  - `src/components/SealAndExportModal.tsx:78-108`：使用 `useCallback` 提取 `renderSeal`，将 `useEffect` 依赖扩展为 `[isOpen, activeTab, renderSeal]`，并在下一动画帧重绘保底。
  - `src/components/SealAndExportModal.tsx:304-311`：Canvas 添加 callback ref，节点一挂载到 DOM 即刻触发首帧绘制。
- **已执行的验证及证据**：
  - 截图证据：
    - `docs/qa-fix-evidence/06a-seal-preview-initial-fixed.jpg`：模态框首次打开，红色白文“静心”方印完整显现。
    - `docs/qa-fix-evidence/06b-seal-preview-after-tab-switch-fixed.jpg`：切换到“笔迹回放”标签后再切回“钤印导出”，印章依然完整绘制，无空白。
  - 自动化日志记录：
    - 历史执行中的自动化日志曾因选择器匹配延迟捕获失败，后续在重跑与截图捕获中均验证非零像素为 8100。
- **当前状态**：**验证通过（视觉截图与代码逻辑已闭环；曾存在自动化脚本日志时序差异）**
- **剩余问题与验证限制**：无。

---

### QA-11 (P2) · 未写完整篇也显示已圆满，随后自动保存又撤回

- **缺陷根因**：
  1. `App.tsx` 之前在 `currentIndex === sutra.content.length - 1` 时无条件打上 `completedAt`，忽略了中间可能存在跳过的未书写字格；
  2. `App.tsx` 的 `stateRef.current` 中缺少 `completedAt` 字段，15 秒定时器执行 `persistSession()` 时覆写了 `undefined`，导致已圆满状态被冲掉；
  3. `localDb.ts:465` 计算完成字数时仅检查对象存在性，未过滤有效笔画。
- **修改文件及位置**：
  - `src/db/localDb.ts:465-472`：严格按 `strokes.length > 0` 统计完成字数；`isFinished` 必须满足 `totalChars > 0 && completedChars >= totalChars && (Boolean(item.completedAt) || completedChars === totalChars)`。
  - `src/App.tsx:96-120`：将 `completedAt` 纳入持久化引用与状态机，刷新恢复时还原。
  - `src/App.tsx:505-515`：在 `handleCharComplete` 中完整检查全文字格 `[0 ... totalChars - 1]` 是否全有笔画，全部写满才打上 `completedAt`。
- **已执行的验证及证据**：
  - 单元测试 `tests/regression.test.mjs` 中“QA-11 判定规则”验证通过（跳字与空笔画不判定为已圆满，全写满才判定已圆满）；
  - 浏览器端功德簿检查：未全篇写完时，功德簿展示为“抄写中”，决不错误显示“已圆满”（截图 `docs/qa-fix-evidence/11-incomplete-not-marked-finished-fixed.jpg`）。
- **当前状态**：**已修改，部分验证通过**
- **剩余问题与验证限制**：
  - 尚未在浏览器端完整自动跑完“用户新建 3 字帖 -> 写第 1 字 -> 跳第 2 字 -> 提交第 3 字 -> 确认未圆满 -> 补写第 2 字 -> 提交 -> 确认已圆满并经 15 秒保存与刷新保持”的长链路。目前主要由单元测试保障核心逻辑判定。

---

### QA-12 (P2) · PWA 图标资源 404，配置与产物路径不一致

- **缺陷根因**：
  `vite.config.ts` 中的 PWA 插件配置了 `/pwa-192x192.png` 与 `/pwa-512x512.png` 绝对路径，且项目 `public/` 目录下缺失对应图标图片文件，导致浏览器请求图标时返回 404。
- **修改文件及位置**：
  - `vite.config.ts:31-41`：改为相对路径 `pwa-192x192.png` 和 `pwa-512x512.png`，兼容 GitHub Pages 等子目录部署。
  - `public/pwa-192x192.png` 与 `public/pwa-512x512.png`：生成符合 PWA 规范的真实 192×192 与 512×512 朱砂印章 PNG 产物。
- **已执行的验证及证据**：
  - 网络请求校验：
    - `http://localhost:5174/manifest.webmanifest`：HTTP 200，内容声明包含两个图标；
    - `http://localhost:5174/pwa-192x192.png`：HTTP 200，文件大小 8,475 字节；
    - `http://localhost:5174/pwa-512x512.png`：HTTP 200，文件大小 23,438 字节；
  - 单元测试 `tests/regression.test.mjs`“QA-12 PWA 图标与清单有效性”通过。
- **当前状态**：**验证通过（Web 资源与清单层面）**
- **剩余问题与验证限制**：
  - 真实操作系统级别的“添加到主屏幕”安装横幅与离线启动体验，需要真实实体手机（iOS Safari / Android Chrome）执行，测试环境未作真机安装测试。

---

### 附加专项验证：长卷 PNG 导出实际下载

- **当前状态**：**尚未验证**
- **说明**：
  - `ScrollExporter.ts:307-321` 中 `downloadScrollImage` 实现了离屏 Canvas 渲染并触发 `<a>` 标签下载。
  - 自动化测试虽然验证了按钮可点击并触发了相关代码路径，但在 Headless Chrome 环境下**未能成功拦截、落盘并校验生成的 PNG 文件的二进制头部（Magic Number `0x89 0x50 0x4E 0x47`）和画幅像素尺寸**。
  - 严格按照工作要求，**明确标为「尚未验证」**，决不虚假标为通过。

---

## 最终验证结论分类统计

### 1. 验证通过（8 项）
- **QA-02 (P1)**：清空重写后切字旧笔迹不复活。
- **QA-03 (P1)**：窄屏纸墨菜单居中无越界，内容完整展示。
- **QA-04 (P2)**：桌面宽屏长卷自适应高度限制解除（818px / 998px）。
- **QA-05 (P2)**：320×568 超小屏底部控件完全保留在视口内。
- **QA-06 (P2)**：844×390 手机横屏走纸节奏面板不被遮挡裁切。
- **QA-07 (P2)**：弹出面板背景色不透明度修复，无底图透出。
- **QA-08 (P2)**：平板与横屏顶栏单行高度规范显示（46px），不再异常膨胀。
- **QA-09 (P2)**：磁青与红金深色纸张当前字及序号对比度适配。

### 2. 已修改，截图/代码闭环但存在部分验证限制（3 项）
- **QA-01 (P1)**：草稿笔画保存与刷新恢复（已在浏览器中验证落笔草稿刷新恢复，但**未等待跨越两轮 15 秒定时保存周期**后再刷新）。
- **QA-10 (P2)**：印章预览首次与切标签空白（代码已闭环，截图 `06a` 与 `06b` 均证明印章正常渲染；但因自动化脚本选择器延迟曾有历史报错记录）。
- **QA-11 (P2)**：缺字完成判定与功德簿状态一致性（已验证未写完时无圆满标记且单元测试通过，但**未在浏览器中端到端走完自建三字帖跳字全流程**）。

### 3. 尚未验证（1 项）
- **长卷 PNG 实际下载与图片文件内容校验**（未能通过浏览器自动化落盘并检查实际生成的 PNG 文件内容与魔数，如实标为尚未验证）。

### 4. 验证失败
- **无**（所有已知缺陷根因均已定位并完成最小必要修改，构建与类型检查均为 0 错误）。
