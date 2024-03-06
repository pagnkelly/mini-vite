
import { normalizePath } from './utils'
import path from 'node:path'
import fs from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { importAnalysisPlugin } from './plugins/importAnalysis'
import { resolvePlugin } from './plugins/resolve'
export interface ResolvedConfig {
  base: string
  root: string
  server: any
  plugins?: any
  publicDir: string
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
  configFile?: string | false
  publicDir?: string | false
}

export async function resolveConfig(inlineConfig: InlineConfig) {
  let config = inlineConfig

  // resolve root
  const resolvedRoot = normalizePath(
    config.root ? path.resolve(config.root) : process.cwd(),
  )

  let { configFile } = config
  if (configFile !== false) {
    const loadResult = await loadConfigFromFile(
      configFile,
      resolvedRoot
    )
    if (loadResult) {
      // config = mergeConfig(loadResult.config, config)
      // configFile = loadResult.path
    }
  }
  
  const userPlugins: any = [vue()]

  const { publicDir } = config
  const resolvedPublicDir =
    publicDir !== false && publicDir !== ''
      ? normalizePath(
          path.resolve(
            resolvedRoot,
            typeof publicDir === 'string' ? publicDir : 'template/public',
          ),
        )
      : ''
  let resolved = {
    base: '/',
    root: resolvedRoot,
    server: config.server,
    publicDir: resolvedPublicDir,
    plugins: userPlugins
  }
  resolved.plugins = [...resolved.plugins, resolvePlugin(resolved), importAnalysisPlugin(resolved)]
  return resolved
}

export function defineConfig(config: InlineConfig): InlineConfig {
  return config
}
export const DEFAULT_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts',
]
export async function loadConfigFromFile(configFile: string | undefined, configRoot: string) {
  let resolvedPath: string | undefined

  if (configFile) {
    // explicit config path is always resolved from cwd
    resolvedPath = path.resolve(configFile)
  } else {
    // implicit config file loaded from inline root (if present)
    // otherwise from cwd
    for (const filename of DEFAULT_CONFIG_FILES) {
      const filePath = path.resolve(configRoot, filename)
      if (!fs.existsSync(filePath)) continue

      resolvedPath = filePath
      break
    }
  }
  const load = (path: string | undefined) => path
  let config = load(resolvedPath)
  return {
    config,
    path: resolvedPath
  }
}

export function mergeConfig (lconfig: string | undefined, config: InlineConfig) {
  if (lconfig && config) {

  }
  return {
    
  }
}