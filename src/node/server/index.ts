import connect from 'connect'
import { resolveHttpServer, httpServerStart } from '../http'
import { resolveConfig } from '../config'
import type { InlineConfig, ResolvedConfig } from '../config'
import {
  createDevHtmlTransformFn,
  indexHtmlMiddleware,
} from './middlewares/indexHtml'
import {
  htmlFallbackMiddleware
} from './middlewares/htmlFallback'
import { getFsUtils } from '../fsUtils'
export interface ViteDevServer {
  config: ResolvedConfig
  httpServer: any
  listen(port?: number, isRestart?: boolean): Promise<ViteDevServer>
  transformIndexHtml(
    url: string,
    html: string,
    originalUrl?: string,
  ): Promise<string>
  _currentServerPort?: number | undefined
}

export async function createServer(inlineConfig: InlineConfig = {}) {
  
  const config = await resolveConfig(inlineConfig)
  const { root } = config

  const middlewares = connect()
  const httpServer = await resolveHttpServer(middlewares)

  const devHtmlTransformFn = createDevHtmlTransformFn(config)
  const server: ViteDevServer = {
    config,
    httpServer,
    async listen (port?: number, isRestart?: boolean) {
      await startServer(server, port)
      return server
    },
    transformIndexHtml(url, html, originalUrl) {
      return devHtmlTransformFn(server, url, html, originalUrl)
    },
  }
  middlewares.use(htmlFallbackMiddleware(root, getFsUtils(config)));
  middlewares.use(indexHtmlMiddleware(root, server))
  return server
}

async function startServer(
  server: ViteDevServer,
  inlinePort?: number,
): Promise<void> {
  const httpServer = server.httpServer
  const options = server.config.server || { host: undefined, port: 5173 }
  const host = await resolveHostname(options.host)
  const serverPort = await httpServerStart(httpServer, {
    port: inlinePort || options.port,
    host: host
  })
  server._currentServerPort = serverPort
}

function resolveHostname(host: string | undefined) {
  return host || 'localhost'
}