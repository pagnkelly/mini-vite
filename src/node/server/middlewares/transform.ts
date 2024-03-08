import type { ViteDevServer } from "..";
import { cleanUrl, isImportRequest, isJSRequest, isCSSRequest } from "../../utils";
import path from 'node:path'
import { getFsUtils } from "../../fsUtils";
import { send } from "../../send";
import { transformRequest } from "../transformRequest";

const knownIgnoreList = new Set(['/', '/favicon.ico'])
export function transformMiddleware(server: ViteDevServer) {
  return async function viteTransformMiddleware(req: any, res: any, next: any) {
    if (req.method !== 'GET' || knownIgnoreList.has(req.url!)) {
      return next()
    }
    const fsUtils = getFsUtils(server.config)
    const url = req.url && cleanUrl(req.url)
    if (isJSRequest(url) ||
        isImportRequest(url) ||
        isCSSRequest(url) 
    ) {
      const filePath = path.join(server.config.root, decodeURIComponent(url))
      if (fsUtils.existsSync(filePath)) {
        try {
          const result = await transformRequest(server, filePath)
          if (result) {
            const type = isCSSRequest(url) ? 'css' : 'js'
            return send(req, res, result.code, type, {
                etag: result.etag,
                // allow browser to cache npm deps!
                cacheControl: 'no-cache',
                headers: server.config.server.headers,
                map: result.map,
            });
          }
        } catch (e) {
          return next(e)
        }
      }
    }
  }
}
