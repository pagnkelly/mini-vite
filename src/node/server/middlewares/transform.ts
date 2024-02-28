import type { ViteDevServer } from "..";
import { cleanUrl, isJSRequest } from "../../utils";
import path from 'node:path'
import fsp from 'node:fs/promises'
import { getFsUtils } from "../../fsUtils";
import { send } from "../../send";

const knownIgnoreList = new Set(['/', '/favicon.ico'])
export function transformMiddleware(server: ViteDevServer) {
  return async function viteTransformMiddleware(req: any, res: any, next: any) {
    if (req.method !== 'GET' || knownIgnoreList.has(req.url!)) {
      return next()
    }
    const fsUtils = getFsUtils(server.config)
    const url = req.url && cleanUrl(req.url)
    if (isJSRequest(url)) {
      const filePath = path.join(server.config.root, decodeURIComponent(url))
      if (fsUtils.existsSync(filePath)) {
        try {
          let code = await fsp.readFile(filePath, 'utf-8')
          return send(req, res, code, 'js', { headers: server.config.server.headers })
        } catch (e) {
          return next(e)
        }
      }
    }
  }
}
