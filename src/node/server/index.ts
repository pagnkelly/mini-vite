import connect from 'connect'
import { resolveHttpServer, httpServerStart } from '../http'
interface InlineConfig {
  root?: string;
  server?: {
    host: string;
    port: number;
    open: boolean;
  };
}

interface ViteDevServer {
  config: InlineConfig
  httpServer: any
  listen(port?: number, isRestart?: boolean): Promise<ViteDevServer>
  _currentServerPort?: number | undefined
}

export async function createServer(inlineConfig: InlineConfig = {}) {
  const middlewares = connect()
  const httpServer = await resolveHttpServer(middlewares)
  const server: ViteDevServer = {
    config: inlineConfig,
    httpServer,
    async listen (port?: number, isRestart?: boolean) {
      await startServer(server, port)
      return server
    }
  }
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