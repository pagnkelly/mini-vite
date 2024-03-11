import type { ViteDevServer } from "..";
import { cleanUrl, isImportRequest, isJSRequest, isCSSRequest, isDirectCSSRequest, removeImportQuery, unwrapId } from "../../utils";
import { send } from "../../send";
import { transformRequest } from "../transformRequest";

const knownIgnoreList = new Set(['/', '/favicon.ico'])
export function transformMiddleware(server: ViteDevServer) {
  return async function viteTransformMiddleware(req: any, res: any, next: any) {
    if (req.method !== 'GET' || knownIgnoreList.has(req.url!)) {
      return next()
    }
    let url = req.url && cleanUrl(req.url)

    if (isJSRequest(url) ||
        isImportRequest(url) ||
        isImportRequest(req.url) ||
        isCSSRequest(url) 
    ) {
      url = removeImportQuery(url)
      url = unwrapId(url);

      const result = await transformRequest(server, url)
      if (result) {
        const type = isDirectCSSRequest(url) ? 'css' : 'js'
        return send(req, res, result.code, type, {
            etag: result.etag,
            // allow browser to cache npm deps!
            cacheControl: 'no-cache',
            headers: server.config.server.headers,
            map: result.map,
        });
      }
    }
  }
}
