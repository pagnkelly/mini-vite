import { ViteDevServer } from "..";
import { Options } from 'sirv'
import sirv from 'sirv'
import { cleanUrl, normalizePath } from "../../utils";

const knownJavascriptExtensionRE = /\.[tj]sx?$/

const sirvOptions = ({
  getHeaders,
}: {
  getHeaders: () => any
}): Options => {
  return {
    dev: true,
    etag: true,
    extensions: [],
    setHeaders(res, pathname) {
      // Matches js, jsx, ts, tsx.
      // The reason this is done, is that the .ts file extension is reserved
      // for the MIME type video/mp2t. In almost all cases, we can expect
      // these files to be TypeScript files, and for Vite to serve them with
      // this Content-Type.
      if (knownJavascriptExtensionRE.test(pathname)) {
        res.setHeader('Content-Type', 'text/javascript')
      }
      const headers = getHeaders()
      if (headers) {
        for (const name in headers) {
          res.setHeader(name, headers[name]!)
        }
      }
    },
  }
}

export function servePublicMiddleware(
  server: ViteDevServer,
  publicFiles?: Set<string>,
) {
  const dir = server.config.publicDir
  const serve = sirv(
    dir,
    sirvOptions({
      getHeaders: () => server.config.server.headers,
    }),
  )
  const toFilePath = (url: string) => {
    let filePath = cleanUrl(url)
    if (filePath.indexOf('%') !== -1) {
      try {
        filePath = decodeURI(filePath)
      } catch (err) {
        /* malform uri */
      }
    }
    return normalizePath(filePath)
  }
  return function viteServePublicMiddleware(req: any, res: any, next: any) {
    if (
      (publicFiles && !publicFiles.has(toFilePath(req.url!)))
    ) {
      return next()
    }
    console.log(req.url, 'req.url')
    serve(req, res, next)
  }
}
