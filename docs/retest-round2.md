# 第二轮修复的独立复核

日期：2026-10-17。只新增本报告及 `docs/qa-round2-retest-evidence/`，没有修改源码、测试、配置或对方报告。

**结论：R-01、R-02 通过本轮针对性复核。交付 PNG 真实、可解码，尺寸和体积正确；但“全文 260 字手写笔迹已全检”的说法不成立。需要更正验收表述并补充多字多笔样本对照，不应把这件事直接认定为应用导出缺字。**

## R-01：通过

重新执行类型检查并将生产构建输出到 `/private/tmp/sutra-round2-independent-check-20261017`，用独立端口 `127.0.0.1:5186` 打开页面，实际检查菜单及按钮文字。

| 视口 | 面板宽度 | clientWidth / scrollWidth | 朱砂墨右缘 / 面板右缘 | 三枚墨色文字 |
| --- | --- | --- | --- | --- |
| 390×844 | 320 | 318 / 318 | 342 / 355 | 各自 clientWidth=scrollWidth=36，无省略裁切 |
| 320×568 | 296 | 294 / 294 | 295 / 308 | 各自 clientWidth=scrollWidth=36，无省略裁切 |
| 1440×900 | 288 | 286 / 286 | 848.99 / 864 | 各自 clientWidth=scrollWidth=36，无省略裁切 |

实际点击朱砂墨及关闭按钮成功。证据：[320](qa-round2-retest-evidence/menu-320.jpg)、[390](qa-round2-retest-evidence/menu-390.jpg)、[1440](qa-round2-retest-evidence/menu-1440.jpg)。详细测量见 [observations.json](qa-round2-retest-evidence/observations.json)。Portal 与三列网格已经解决上一轮的内部裁切。

## R-02：通过

在独立会话中实际拖动写一笔、提交并返回，再通过界面逐次选择纸张与墨色、打开回放、点击播放。六组均保存了回放画布截图并逐张查看：

| 纸张 | 松烟墨 | 泥金墨 | 朱砂墨 |
| --- | --- | --- | --- |
| 磁青 | [黑色，符合所选墨色](qa-round2-retest-evidence/canvas-ciqing-black.jpg) | [金色，原问题已消失](qa-round2-retest-evidence/canvas-ciqing-gold.jpg) | [红色](qa-round2-retest-evidence/canvas-ciqing-cinnabar.jpg) |
| 宣纸 | [黑色](qa-round2-retest-evidence/canvas-xuan-black.jpg) | [金色](qa-round2-retest-evidence/canvas-xuan-gold.jpg) | [红色](qa-round2-retest-evidence/canvas-xuan-cinnabar.jpg) |

源码中回放已使用 `INK_COLORS[inkType]`。本次结论针对笔迹是否使用所选墨色，未声称 JPEG 截图像素与指定 Hex 逐像素全等；透明度、底纸和 JPEG 压缩会改变截图像素。磁青上主动选择黑墨仍然不醒目，但不再是“选择金墨却被画成黑墨”的故障。

## PNG 实物：文件与样本通过，完整笔迹验收证据不足

核查文件：[般若波罗蜜多心经_装裱长卷_2026-10-17.png](qa-fix-evidence/般若波罗蜜多心经_装裱长卷_2026-10-17.png)。

- 实际体积：5,031,584 字节。
- PNG 签名正确，图像可解码；分辨率为 6160×1480。
- SHA-256：`ff9bfd769c305956435e01ec4a404c9c4c377ef6fc4da7ffd4c5acd46e6e0745`。
- 实际查看了整张图片：纸张、题名、译者、回向文、“静心”印章均存在。
- 正文绝大部分是浅灰楷体底稿；第一字格有一笔很短的深色测试笔迹，并非 260 字全部已经手写。
- 按当前导出引擎的 2x 字格坐标读取全部 260 格内框，RGB 最大通道低于 90 的像素只出现在第 0 格，115 个像素。这仅是辅助本张宣纸黑墨样本的目视判断，不是通用笔迹识别。记录见 [delivered-png-cell-check.json](qa-round2-retest-evidence/delivered-png-cell-check.json)。

`ScrollExporter.ts:244` 附近会把有记录的字格绘制为笔迹，把没有记录的字格绘制为浅灰底稿。交付图的外观与“一格测试笔画、其余未写”的样本一致。**不能据此声称软件漏导出其余 259 字，也不能声称这些字的手写笔迹已经验证。**

建议将报告改为：“已取得真实 PNG，尺寸正确；题名、纸张、回向文、印章和单字测试笔画已查看。多字、多笔迹完整性仍需样本对照。”

## 自动化日志仍需修正的地方

1. `scripts/verify-round2.mjs:548` 附近只要证据目录有任意 PNG 就取第一张；前面记录的 `filesBefore` 没有参与筛选。重跑时可能读取旧文件，不能可靠证明本次点击产生了新下载。
2. `scripts/verify-round2.mjs:591` 的“要素完整性”直接使用固定 `PASS`，没有针对图像内容的检查。
3. PNG 签名检查变量没有参与该脚本的 PASS 判定；本次由独立读取确认文件签名正确。
4. 报告中的 `downloadScrollImage` 示例签名为返回 Promise，实际源码仍为 `void`，用 `toBlob` 回调，并在 60 秒后撤销 URL。报告应与实际实现一致。
5. “旧超时由 Base64 导致 IPC 阻塞”和“500ms 内完成”没有在现有日志中提供对照诊断或计时依据。改为 Blob 是合理实现改动，但不应把未证实的原因与耗时写成已验证事实。

以上是验证与报告问题，不等于新增了应用运行故障。本轮没有重新使用此前会异常长时间等待的下载工具，也未声称自己再次完成了新文件下载；实际文件来自本轮交付物，已经独立读取与查看。

## 最小补验建议

创建一个短字帖，给每个字格写不同、可辨认的多笔图案，包含跨列以及清空／撤销后的结果；保留书写台、全景或原始笔画记录，实际下载到新的专用目录，再逐格对照 PNG。这样可以验证“实际保存的全部笔迹是否正确导出”，不需要手写完整 260 字。

后续仅需修正报告和测试断言、补交这个对照样本；目前没有证据要求继续重构已通过的菜单与回放实现。

本轮类型检查及独立生产构建均退出 0，构建为 Vite 5.4.21，资产 `index-BFx3kms6.css`、`index-5tUnczzi.js`。未重新执行上一轮全部 12 项、真机安装或软键盘测试。
