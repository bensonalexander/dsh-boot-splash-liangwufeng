/**
 * dsh-boot-splash
 *
 * 启动开屏动画插件。
 *
 * 注册一个静态图片路由，并通过 DSH web 服务器的 `webserver/index-inject`
 * 接口，把一段自包含的 HTML / CSS / JS 注入到每次返回的 index.html 中：
 * 浏览器在 SPA 脚本执行之前就已经画好开屏，等界面挂载后再淡出。
 */
import { createReadStream, statSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-boot-splash';
export const inject = ['webServer'];

/** 图片路由；CSS 里的背景图指向它。 */
const ASSET_ROUTE = '/x-boot-splash/portrait.webp';

const here = (file) => fileURLToPath(new URL(file, import.meta.url));

function read(file, fallback) {
  try {
    return readFileSync(here(file), 'utf8');
  } catch {
    return fallback;
  }
}

const CSS = read('./splash.css', '');
const HTML = read('./splash.html', '');
const SCRIPT = read('./splash.js', '');

export function apply(ctx) {
  const assetPath = here('./portrait.webp');
  let assetSize = 0;
  try {
    assetSize = statSync(assetPath).size;
  } catch {
    assetSize = 0;
  }

  try {
    ctx.effect(() => {
      const dispose = ctx.webServer.register({
      kind: 'exact',
      path: ASSET_ROUTE,
      handler(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { Allow: 'GET, HEAD' });
          res.end();
          return;
        }
        if (assetSize === 0) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'image/webp',
          'Content-Length': String(assetSize),
          'Cache-Control': 'public, max-age=86400'
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = createReadStream(assetPath);
        stream.once('error', () => res.destroy());
        stream.pipe(res);
      }
      });
      return dispose;
    }, 'boot-splash: portrait route');
  } catch (error) {
    console.warn('[dsh-boot-splash] 图片路由注册失败，开屏将只显示纯色底:', error);
  }

  ctx.on('webserver/index-inject', (table) => {
    try {
      if (CSS) table.push({ kind: 'style', text: CSS });
      if (HTML) table.push({ kind: 'html', placement: 'body', html: HTML });
      if (SCRIPT) table.push({ kind: 'script', placement: 'body', text: SCRIPT });
    } catch (error) {
      console.warn('[dsh-boot-splash] 注入失败，已跳过开屏:', error);
    }
  });
}
