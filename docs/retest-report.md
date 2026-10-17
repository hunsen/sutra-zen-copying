# 独立复验报告

日期：2026-10-17（Asia/Shanghai）。对象：`e8209cd` 基础上的当前未提交修复。

**结论：原 12 项中，11 项在本轮列明范围内通过，QA-03 部分修复，仍有菜单内部裁切；另发现 1 项回放墨色问题。PNG 最终下载文件仍未验收，不能宣布全部通过。**

原三个 P1 的核心故障已解除：未提交笔画跨多轮保存后不再丢失，清空后的旧笔迹不再复活，原先位于屏幕外的设置已经可以点击。QA-03 剩余问题按 P2 记录。

本轮没有修改应用代码、配置、测试或图标，没有覆盖对方的修复报告和原始证据。受检文件的 SHA-256 在开始与结束一致，清单见 [baseline-sha256.json](qa-retest-evidence/baseline-sha256.json)。

## 验证方式与范围

- 独立重新构建到 `/private/tmp/sutra-independent-retest-20261017`，用新端口 `127.0.0.1:5180` 打开生产页面，避免直接复用对方测试会话或既有 `dist`。
- 通过 Codex 内置浏览器实际点击、拖动落笔、填写、导航、刷新、截图和只读 DOM 测量进行复验，没有通过注入应用状态来跳过操作。
- 视口：1440×900、1920×1080、390×844、320×568、844×390、768×1024，均为 CSS 像素。尺寸调整后检查稳定页面。
- `npm run typecheck`、独立 Vite 构建、`node --test tests/regression.test.mjs` 均退出 0，现有测试 3/3 通过。前两项测试使用了复制的状态逻辑，不能替代真实页面测试；PWA 测试读取原有 `dist`，因此另行校验了独立构建产物。
- 详细命令、步骤与边界见 [checks.txt](qa-retest-evidence/checks.txt)；原始页面快照、测量及等待时长见 [browser-observations.json](qa-retest-evidence/browser-observations.json)。

## 原 12 项复验结果

| 编号 | 本轮结果 | 实际验证与证据 |
| --- | --- | --- |
| QA-01 未提交笔画丢失 | **通过** | 心经第一字手动写两笔，不提交；等待 **46.963 秒**，跨越至少两轮 15 秒保存后刷新，仍为 2/6 笔，两笔及全景镜像均保留。[等待前](qa-retest-evidence/02-draft-before-35s.jpg)、[刷新后](qa-retest-evidence/05-draft-after-refresh.jpg)。 |
| QA-02 清空后旧笔迹恢复 | **通过** | 先提交两笔，返回撤销一笔，再提交返回仍为一笔；清空后前后切字保持零笔，刷新也保持零笔，功德簿心经显示 0/260。[导航后](qa-retest-evidence/06-cleared-submitted-char-after-navigation.jpg)、[刷新后](qa-retest-evidence/11-clear-after-refresh.jpg)。 |
| QA-03 窄屏菜单越界 | **部分修复** | 390 和 320 宽度下面板及关闭按钮已在屏幕内，古籍竹纸、朱砂墨、榜书可以实际点击；但朱砂墨右侧仍被面板自身裁切，详见下文 R-01。[390 截图](qa-retest-evidence/09-theme390-inner-overflow.jpg)、[320 截图](qa-retest-evidence/20-theme320.jpg)。 |
| QA-04 宽屏长卷仅 200 高 | **通过** | 1440×900 左 section 高 836，1920×1080 高 1016，计算最大高度均为 none。这里测量的是 section，和对方报告内层滚动区的 818/998 并不矛盾。[1440](qa-retest-evidence/01-wide1440.jpg)、[1920](qa-retest-evidence/24-wide1920.jpg)。 |
| QA-05 小手机底部控件裁切 | **通过** | 320×568 模式按钮底部 y=549.84，小于 568；撤销、重写、走纸与模式按钮均可见。[截图](qa-retest-evidence/19-small320.jpg)。 |
| QA-06 横屏走纸设置裁切 | **通过** | 844×390 实际设置面板 y=43～347；标题、关闭、三种模式、四个等待时长均在视口内，实际点击 3 秒及手动模式成功。此处测量面板自身，未把全屏遮罩误当面板。[截图](qa-retest-evidence/22-advance844.jpg)。 |
| QA-07 菜单背景透明 | **通过** | 书写台笔触菜单、纸墨菜单、走纸菜单计算背景均为 rgba(28,25,23,0.98)，可遮盖底图。[笔触菜单](qa-retest-evidence/03-brush-wide.jpg)、[纸墨菜单](qa-retest-evidence/07-theme390.jpg)。 |
| QA-08 顶栏折成多行 | **通过** | 844 横屏与 768 平板竖屏顶栏均高 46，保持单行。[横屏](qa-retest-evidence/21-landscape844.jpg)、[平板](qa-retest-evidence/23-tablet768.jpg)。 |
| QA-09 深色主题状态文字不可读 | **通过** | 磁青与红笺当前字、序号、笔画状态可辨识；原先的深色前景字问题已修复。[磁青](qa-retest-evidence/08-ciqing390.jpg)、[红笺](qa-retest-evidence/10-red390.jpg)。 |
| QA-10 印章预览空白 | **通过** | 第一次打开、切到回放再返回、关闭后重新打开，均能看到“静心”印章。[首次](qa-retest-evidence/14-seal-first-open.jpg)、[标签返回](qa-retest-evidence/16-seal-after-tab.jpg)、[重新打开](qa-retest-evidence/25-seal-reopened.jpg)。 |
| QA-11 完成状态错误／不稳定 | **通过** | 实际新建“一二三”，写第一字、跳过第二字、提交末字，功德簿为 2/3、未圆满、0 部；补写第二字并再次结卷后，等待 **357.236 秒**再查，仍为 3/3、已圆满、1 部，刷新后也保持。[缺字](qa-retest-evidence/13-incomplete-history.jpg)、[保存多轮后](qa-retest-evidence/17-complete-history-after-wait.jpg)、[刷新后](qa-retest-evidence/18-complete-history-after-refresh.jpg)。此项验证的是应用按字格有笔画判定完成的规则，不代表识别了真实汉字是否写对。 |
| QA-12 PWA 图标缺失 | **通过，限构建资源层** | 独立产物包含两个真实 PNG，签名正确，IHDR 尺寸分别为 192×192 和 512×512；manifest 使用相对路径。详见 [产物校验](qa-retest-evidence/pwa-build-check.json)。未进行真机安装验收。 |

## 仍需处理的问题

### R-01 · P2 · QA-03 残留：菜单位于屏幕内，但内部朱砂墨仍被裁切

**复现：** 390×844 或 320×568，打开顶栏纸墨菜单，直接查看第三个墨色选项。

**实际：** 面板整体已居中，关闭按钮可用，但“朱砂墨”的文字和按钮右缘越出面板可视区域。可以点到按钮中部，不等于它已经完整显示。

**测量依据：** 初次 390 宽度心经会话中，面板 x=80.92～309.07，朱砂墨按钮 x=251.92～321.92，右缘超出面板约 12.85 像素；面板 `clientWidth=226`、`scrollWidth=240`。改为三字帖后面板随胶囊宽度进一步变窄，问题仍存在。[390 截图](qa-retest-evidence/09-theme390-inner-overflow.jpg)、[320 截图](qa-retest-evidence/20-theme320.jpg)。

**原因定位：** `src/components/TopZenCapsule.tsx:108` 内层胶囊仍有 `backdrop-filter: blur(24px)`，它成为内部 fixed 浮层的包含块；`:150` 的移动面板实际按胶囊宽度收缩，而不是按视口取得充足宽度。`:198`、`:213` 的三枚墨色按钮还存在最小内容宽度，合计超过可用内容区。DOM 祖先计算样式保存在 `browser-observations.json`。

**修复验收：** 把浮层放到不受胶囊滤镜包含块影响的位置，或采用等效的正确布局；保证 320、390 宽度及不同标题／进度下，所有按钮和文字都在面板可视内容区内。不能只检查面板是否超出视口，也不能只依赖自动化点击成功。

### R-02 · P2 · 本轮新发现：金色笔迹回放成黑色，磁青纸上几乎不可见

**复现：** 选择磁青金经，使用默认泥金墨书写并提交，打开“笔迹回放”，点击播放。

**实际：** 书写台与长卷中的金色笔迹，在回放中变为近黑色。播放可到 100%，但深蓝背景上的笔迹难以辨认。

**依据：** [书写台金色笔迹](qa-retest-evidence/19-small320.jpg)与[同一会话的回放](qa-retest-evidence/15-replay-dark-paper.jpg)。`src/components/SealAndExportModal.tsx:186` 将回放颜色固定为 `#1C1B19`，没有使用传入的 `inkType`。

该固定颜色行不在本次修复 diff 内，**本报告不将其归因于本次修复引入**。

**修复验收：** 回放使用与当前书写／导出约定一致的墨色；实际回归松烟、泥金、朱砂三色，并在浅色纸和磁青纸上检查可见性。

## PNG 与离线验证的边界

**PNG 最终文件：尚未验证。** 本轮点击真实下载按钮并等待下载事件，但工具返回 `Timed out after 8000ms waiting for download`；该次工具调用还出现约 324 秒的异常耗时。没有拿到可检查的最终 PNG，因此未判通过，也不把工具失败直接当成应用导出失败。下一步仍需在可正常下载的目标浏览器取得文件，检查尺寸、纸张、全部笔迹、题名、回向文及印章。印章预览通过不等于导出图片已经验收。

**浏览器缓存离线刷新：通过有限场景。** 本轮明确停止自己启动的 5180 预览服务，进程退出后再刷新，页面仍可载入当前三字帖；点击上一字仍恢复第二字的两笔。[证据](qa-retest-evidence/26-offline-reload-and-prev-char.jpg)。这说明已缓存会话可在源站服务停止后刷新和切字，不能替代系统断网、真机冷启动或安装到主屏幕的测试。

## 交付与后续

- 本轮新增 `docs/retest-report.md` 和 `docs/qa-retest-evidence/`，保留 `docs/tofix.md`、`docs/fix-report.md` 及双方旧证据。
- 对方修复报告正文已承认关键验证限制，但其总结没有逐项完整统计 QA-12；本报告重新严格按原 QA-01～QA-12 统计，PNG 作为附加专项单列。
- 本轮没有执行真机触摸／触控笔、多指、软键盘、OS 安装、Android 打包、完整长篇抄写和音频听感验收。
- 建议 Antigravity 下一轮只修 R-01、R-02，并补交真实 PNG 文件；已通过项不需要无差别重复全套测试，涉及共享布局、保存或回放逻辑的改动再做对应回归。
