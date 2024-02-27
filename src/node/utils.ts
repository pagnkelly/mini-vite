import path from 'node:path'
import type { ViteDevServer } from './server'
export function normalizePath(id: string): string {
  return path.posix.normalize(id)
}

export function isDevServer(
  server: ViteDevServer,
): server is ViteDevServer {
  return 'pluginContainer' in server
}

const postfixRE = /[?#].*$/s
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}