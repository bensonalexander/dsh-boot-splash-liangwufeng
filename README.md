# dsh-boot-splash

A ~3-second boot splash for **DeepSeek Harness** (DSH): the portrait fades up out of the dark, the wordmark rises letter by letter, a flash lands, and the screen hands over to the app.

It is a host-side plugin: it injects a self-contained splash (style + DOM + a small script) into the app's boot HTML, so the very first paint is the splash — no white flash, no half-rendered UI.

[中文说明](README.zh.md)

![poster](poster.png)

> **Unofficial.** This is a community project, not affiliated with or endorsed by DeepSeek.

## How it works

DSH serves its web shell through `@deepseek-ai/dsh-host-webserver`. Every index render fires `webserver/index-inject`; plugins push rows (`style`, `html`, `script`) that are rendered into the page before the SPA mounts.

The plugin pushes three rows and registers one static route:

| Row | Content |
| --- | --- |
| `style` | the whole splash stylesheet |
| `html` (body) | splash DOM: portrait, wordmark, light layers |
| `script` (body) | dismiss logic (waits for `#root`, click/Esc to skip, CSS auto-hide fallback) |

The portrait is served from `/x-boot-splash/portrait.webp` (a route the plugin registers).

Two boot paths are covered:

- **Browser GUI** (`http://127.0.0.1:<port>`) — injections are rendered into every index response.
- **Desktop window** (`dsh-app://app/`) — the shell serves the raw `dist/index.html`, and receives the same injection rows through the boot IPC, applying them before the plugin tree starts.

## Install

Requirements: DSH desktop (tested with 0.2.1-rc.2), Node.js 20+.

```powershell
node tools/install-splash.mjs
```

The script copies `dsh-boot-splash/` into `%USERPROFILE%\.dsh\profiles\desktop\plugins\boot-splash` and appends an `insert` entry to `cordis.patch.yml` (with a timestamped backup). Restart DSH — the desktop shell captures boot injections once at host start, so a page refresh is not enough.

Uninstall:

```powershell
node tools/uninstall-splash.mjs
```

## Try it without installing

| File | What it is |
| --- | --- |
| `preview/index.html` | the exact injected markup, standalone (open it in a browser) |
| `index.html` | the 1920×1080 web version — plays once, `Space` / `R` replays |
| `DeepSeek-Harness-开屏动画.mp4` | the rendered 3.0 s / 60 fps video |
| `poster.png`, `poster-reveal.png` | stills |

## Structure

```
dsh-boot-splash/        the plugin (index.js + splash.css/html/js + portrait.webp)
tools/                  install / uninstall / preview / record / screenshot scripts
index.html              standalone web version (references 梁武峰.png)
preview/index.html      composed from the plugin's real injection rows
```

## Performance

The animation only animates `opacity` and `transform`, which run on the compositor thread. Earlier versions animated `filter: blur()` on 15 letters plus a full-screen brightness filter — that re-rasterizes on the main thread and stutters exactly while DSH is loading its plugin tree. All blur effects were replaced with static filters or soft gradients.

## Assets and license

- **Code** — MIT, see [LICENSE](LICENSE).
- **Portrait asset** — `梁武峰.png`, `dsh-boot-splash/portrait.webp` and the derived posters/video are **demo material** and are **not** covered by the MIT license. They contain the likeness of a person. If you fork this and publish, make sure you have the rights to the image, or replace it with your own (`dsh-boot-splash/portrait.webp`, 1600 px wide WebP).
- **Trademarks** — “DeepSeek” and “DeepSeek Harness” belong to their owners; the plugin only uses the name to describe what it hooks into.
