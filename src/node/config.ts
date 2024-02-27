
import { normalizePath } from './utils'
import path from 'node:path'
export interface ResolvedConfig {
  root: string
  server: any
}
export interface InlineConfig {
  /**
   * Project root directory. Can be an absolute path, or a path relative from
   * the location of the config file itself.
   * @default process.cwd()
   */
  root?: string;
  server?: {
    host: string;
    port: number;
    open: boolean;
  };
}

export async function resolveConfig(inlineConfig: InlineConfig) {
  let config = inlineConfig

  // resolve root
  const resolvedRoot = normalizePath(
    config.root ? path.resolve(config.root) : process.cwd(),
  )

  let resolved = {
    root: resolvedRoot,
    server: config.server
  }
  return resolved
}