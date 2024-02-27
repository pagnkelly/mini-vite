import type { ViteDevServer } from '..'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { cleanUrl, normalizePath } from '../../utils'
import { applyHtmlTransforms } from '../../plugins/html'
import { getFsUtils } from '../../fsUtils'
import { send } from '../../send'
export function indexHtmlMiddleware(
  root: string,
  server: ViteDevServer,
) {
  const fsUtils = getFsUtils(server.config)
  return async function viteIndexHtmlMiddleware(req: any, res: any, next: any) {
    const url = req.url && cleanUrl(req.url)
    if (url?.endsWith('.html')) {
      const filePath = path.join(root, decodeURIComponent(url))

      if (fsUtils.existsSync(filePath)) {
        const headers = server.config.server.headers
        try {
          let html = await fsp.readFile(filePath, 'utf-8')
          return send(req, res, html, 'html', { headers })
        } catch (e) {
          return next(e)
        }
      }
    }
    next()
  }
}

function getHtmlFilename(url: string, server: ViteDevServer) {
  return decodeURIComponent(
    normalizePath(path.join(server.config.root, url.slice(1))),
  )
}

export function createDevHtmlTransformFn(
  config: any,
): (
  server: ViteDevServer,
  url: string,
  html: string,
  originalUrl?: string,
) => Promise<string> {
  const transformHooks: any = []
  return (
    server: ViteDevServer,
    url: string,
    html: string,
    originalUrl?: string,
  ): Promise<string> => {
    return applyHtmlTransforms(html, transformHooks, {
      path: url,
      filename: getHtmlFilename(url, server),
      server,
      originalUrl,
    })
  }
}