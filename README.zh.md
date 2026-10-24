# DeepSeek Harness · 开屏动画

[English](README.md) | 中文

用一张人像照片（仓库内附 `梁武峰.png` 作示例）做的一支约 3 秒开屏动画：黑场 → 人像从暗处推近（扫描线 / 光扫） →「DeepSeek Harness」逐字升起 → 闪光定格 → 停一秒收场。

它接在 DSH 的启动流程上：**DSH 窗口一打开，先看到这支开屏，界面挂载后自动淡出。**

![最终定格](poster.png)

## 文件

| 文件 | 用途 |
| --- | --- |
| `dsh-boot-splash/` | **接入 DSH 的插件源码**（`index.js` + `splash.css/html/js` + `portrait.webp`） |
| `DeepSeek-Harness-开屏动画.mp4` | 1920×1080 / 60fps / 3.0s，成片，可直接当视频用 |
| `DeepSeek-Harness-开屏.html` | 单文件网页版（图片已内嵌），双击即播 |
| `index.html` | 网页版源文件（引用同目录 `梁武峰.png`），方便继续调 |
| `preview/index.html` | 按 DSH 真实注入方式生成的预览页：双击即可看「进 DSH 之后」的效果 |
| `tools/` | 安装 / 卸载 / 出片 / 截图等脚本 |
| `poster.png`、`poster-reveal.png` | 定帧图 |

## 安装 / 卸载

要求：DSH 桌面版（在 0.2.1-rc.2 上验证过）、Node.js 20+。

```powershell
node tools/install-splash.mjs     # 安装（然后重启 DSH）
node tools/uninstall-splash.mjs   # 卸载
```

安装脚本会把 `dsh-boot-splash/` 复制到 profile 目录的 `plugins/boot-splash/`，并在 `cordis.patch.yml` 末尾追加一条 `insert`——原文件会自动备份成 `cordis.patch.yml.bak-…`。

- **桌面窗口**：注入行是 Host 启动时的一次性快照，所以装完要**重启 DSH**，刷新页面不够。
- **浏览器 GUI**：每次请求都会重新渲染 index，刷新即可。

## 装进去的是什么

profile 目录（`%USERPROFILE%\.dsh\profiles\desktop`）里多了：

1. `plugins/boot-splash/` —— 插件本体；
2. `cordis.patch.yml` 里的那条 `insert`。

### 接入原理（为什么是「启动流程」而不是「页面加载完再盖一层」）

DSH 的 web 壳由 `@deepseek-ai/dsh-host-webserver` 提供。浏览器请求 `/` 时：

```
dist/index.html
  → dsh-host-frontend-static 读文件
  → webServer.renderIndex(html)
      → 抛出 webserver/index-inject 事件，收集所有插件要插的行
      → 把行渲染进 HTML
  → 返回给浏览器
```

插件订阅了这个事件，每次都 push 三行：

| 行 | 内容 |
| --- | --- |
| `style` | 整段开屏样式（放在 `<head>` 里） |
| `html`（body） | 开屏 DOM：人像、标题、光效层 |
| `script`（body） | 一段 classic JS：决定什么时候撤掉开屏 |

于是 **浏览器拿到的第一份 HTML 里就已经有开屏画面**，它排在 `<div id="root">` 之前、SPA 的 module script 之后执行——所以第一次绘制就是开屏，不会先闪白屏或半成品界面。

人像图由插件自己的静态路由提供：`/x-boot-splash/portrait.webp`（142 KB WebP）。

### 桌面窗口和浏览器是两条路径

DSH 桌面版的窗口加载的是 `dsh-app://app/`，不是 `http://127.0.0.1:<port>`（GUI 端口每次启动都不一样）：

| 打开方式 | index 怎么来的 | 注入行怎么用上 |
| --- | --- | --- |
| 浏览器访问 `http://127.0.0.1:<port>` | 走 `webServer.renderIndex()` | 每次请求实时渲染进 HTML |
| 桌面窗口 `dsh-app://app/` | 直接读 `dist/index.html`（不经过 renderIndex） | Host 启动时把 `collectIndexInjections()` 的结果随 `ready` 消息交给主进程，页面启动时再把 `style / html / script` 三种行应用进 DOM，然后才启动插件树 |

两条路走的都是同一份注入行，所以插件不用改：桌面壳会在窗口内容启动前把开屏 DOM 和样式塞进去。

### 撤场时机

- 标题在 **1.92 秒**完整出现，再停 **1 秒**；
- 也就是说 **2.92 秒**开始收场：淡出 350ms 后移除，总时长约 3.0 秒；
- 万一界面还没挂载，最多再等 1.2 秒；CSS 里还有一层 `bs-autohide` 在 4.8s 兜底隐藏——**即使注入的 JS 出错，也不会挡住应用**；
- 点击任意处 / 按 Esc 可立即跳过；
- 系统开启「减少动态效果」时直接显示最终画面，1.0s 后撤。

### 看效果

- **桌面窗口：Host 启动时一次性把注入行快照交给页面**，之后刷新不会重新取。所以改完插件要重启 DSH 才生效。
- **浏览器访问当次启动的 GUI 地址**（`http://127.0.0.1:<port>`，端口每次不同）：每次请求都会重新渲染 index，刷新即可。

### 撤掉

```powershell
node tools/uninstall-splash.mjs
```

（会删掉 profile 里的 `plugins/boot-splash` 并移除 `cordis.patch.yml` 里的那条 insert，同样带备份。）

### 改

- 改动画：编辑 `dsh-boot-splash/splash.css`、`splash.html`、`splash.js`，然后
  `node tools/install-splash.mjs` 重新拷进 profile（profile 里是副本）。
- 想缩短/延长时间：改 `splash.js` 里的 `var min = 2920`，以及 `splash.css` 里各动画的 delay。
- 换图：替换 `dsh-boot-splash/portrait.webp` 后重新 install。

## 为什么现在更顺了

之前「DeepSeek Harness」出现时发卡，主要是动画在动 `filter`——这类属性不走合成器线程，要靠主线程重新栅格化，而那一刻正好是 DSH 启动、加载插件树最忙的时候：

- 标题逐字入场用了 `filter: blur(10px)`：15 个字母 = 15 层实时模糊；
- 人像显影用 `filter: brightness/contrast/saturate` 从暗到亮：全屏每帧重算；
- 光晕、光束、高光也都带 `blur()`，跟着一起动。

现在动画只动 `opacity` 和 `transform`（合成器线程就能跑），模糊全部改成静态滤镜或更软的渐变：

- 字母：只做位移 + 淡入；
- 人像：只做缩放 + 淡入，滤镜变静态（只栅格化一次）；
- 光束 / 雾 / 高光：去掉 `blur()`，改用更软的渐变；
- 加了 `will-change`、`contain: paint`；网页版还把粒子画布降成半分辨率，每帧上传量减到四分之一。

可以在浏览器里自查：`document.getAnimations()` 出来的属性现在只有 `opacity / transform`。


## 动画节奏（约 3.0s）

| 时间 | 画面 |
| --- | --- |
| 0.00–0.25s | 黑场，蓝色氛围光缓缓亮起 |
| 0.25–1.40s | 人像从暗部推近显影，轻微放大归位 |
| 0.45–1.45s | 扫描线自上而下掠过画面 |
| 0.85–1.80s | 一道高光斜向扫过人像 |
| 0.90–1.92s | 「DeepSeek Harness」逐字升起（每字错开 30ms） |
| 1.92s | 标题完整出现，同时一记闪光 + 轻微震动 |
| 1.92–2.92s | 停留 1 秒 |
| 2.92–3.27s | 淡出收场（DSH 里露出应用界面） |

## 网页版怎么播

- 双击 `DeepSeek-Harness-开屏.html` 自动播放，播完停在最终画面；点右下角小圆钮或按 `空格` / `R` 重播。
- 想停在某一帧截图：地址后加 `?t=2.6&shot=1`（单位：秒）。

## 重新生成

```powershell
# 逐帧渲染 + 合成视频（需要本机 Chrome）
node tools/capture.mjs frames 60 3.0
ffmpeg -y -framerate 60 -i frames/f_%05d.png -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart "DeepSeek-Harness-开屏动画.mp4"

# 网页版打包成单文件
node tools/build-single.mjs

# 按 DSH 注入方式生成预览页
node tools/preview-splash.mjs
```

## 许可与素材

- **代码**：MIT，见 [LICENSE](LICENSE)。
- **人像素材**：`梁武峰.png`、`dsh-boot-splash/portrait.webp` 以及由它生成的定帧图 / 视频，仅作演示用，**不在 MIT 许可范围内**。它们包含真实人物肖像；如果要转载、商用或公开发布，请先确认你有该图片的使用权，或者换成自己的图：把新的 1600px 宽 WebP 覆盖到 `dsh-boot-splash/portrait.webp` 即可。
- **商标**：「DeepSeek」「DeepSeek Harness」归其所有者，本项目只是用这个名字说明它挂在哪个产品的启动流程上，与官方无关。
