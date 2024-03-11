
import { createFilter, normalizePath } from './utils'
import path from 'node:path'
import fs from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { importAnalysisPlugin } from './plugins/importAnalysis'
import { resolvePlugin } from './plugins/resolve'
import { createPluginHookUtils, getHookHandler, getSortedPluginsByHook, Plugin } from './plugins'
import { assetPlugin } from './plugins/assets'
import { clientInjectionsPlugin } from './plugins/clientInjections'
export interface ResolvedConfig {
  base: string
  root: string
  server: any
  plugins?: any
  publicDir: string
  getSortedPluginHooks: any
  assetsInclude: (file: string) => boolean
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
  assetsInclude?: (file: string) => boolean
}
export interface ConfigEnv {
  command: 'build' | 'serve'
  mode: string
  isSsrBuild?: boolean
  isPreview?: boolean
}
async function runConfigHook(
  config: InlineConfig,
  plugins: Plugin[],
  configEnv: ConfigEnv,
): Promise<InlineConfig> {
  let conf = config

  for (const p of getSortedPluginsByHook('config', plugins)) {
    const hook = p.config
    const handler = getHookHandler(hook)
    if (handler) {
      const res = await handler(conf, configEnv)
      if (res) {
        conf = mergeConfig(conf, res)
      }
    }
  }

  return conf
}
export const KNOWN_ASSET_TYPES = [
  // images
  'apng',
  'png',
  'jpe?g',
  'jfif',
  'pjpeg',
  'pjp',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',

  // media
  'mp4',
  'webm',
  'ogg',
  'mp3',
  'wav',
  'flac',
  'aac',
  'opus',
  'mov',
  'm4a',
  'vtt',

  // fonts
  'woff2?',
  'eot',
  'ttf',
  'otf',

  // other
  'webmanifest',
  'pdf',
  'txt',
]
export const DEFAULT_ASSETS_RE = new RegExp(
  `\\.(` + KNOWN_ASSET_TYPES.join('|') + `)(\\?.*)?$`,
)

export async function resolveConfig(inlineConfig: InlineConfig): Promise<ResolvedConfig> {
  let config = inlineConfig
  const isNodeEnvSet = !!process.env.NODE_ENV

  // some dependencies e.g. @vue/compiler-* relies on NODE_ENV for getting
  // production-specific behavior, so set it early on
  if (!isNodeEnvSet) {
    process.env.NODE_ENV = 'development'
  }
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
  const configEnv: ConfigEnv = {
    mode: 'development',
    command:'serve',
    isSsrBuild: false,
    isPreview: false,
  }
  const assetsFilter =
  config.assetsInclude &&
  (!Array.isArray(config.assetsInclude) || config.assetsInclude.length)
    ? createFilter(config.assetsInclude)
    : () => false
  const userPlugins: any = [ vue()]
  config = await runConfigHook(config, userPlugins, configEnv)
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
  let resolved: any = {
    ...config,
    base: '/',
    root: resolvedRoot,
    server: config.server,
    publicDir: resolvedPublicDir,
    plugins: userPlugins,
    getSortedPluginHooks: undefined!,
    assetsInclude(file: string) {
      return DEFAULT_ASSETS_RE.test(file) || assetsFilter(file)
    },
  }
  resolved.plugins = [
    ...resolved.plugins,
    assetPlugin(resolved),
    resolvePlugin(resolved),
    clientInjectionsPlugin(resolved),
    importAnalysisPlugin(resolved)
  ]

  Object.assign(resolved, createPluginHookUtils(resolved.plugins))
  await Promise.all(
    resolved
      .getSortedPluginHooks('configResolved')
      .map((hook: any) => {
        hook(resolved)
      }),
  )
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

export function mergeConfig (lconfig: any, config: InlineConfig) {
  return {...lconfig, ...config }
}