import type {
  CustomPluginOptions,
  LoadResult,
  ObjectHook,
  PluginContext,
  ResolveIdResult,
  Plugin as RollupPlugin,
  TransformPluginContext,
  TransformResult,
} from 'rollup'
export interface Plugin<A = any> extends RollupPlugin<A> {
  /**
   * Enforce plugin invocation tier similar to webpack loaders.
   *
   * Plugin invocation order:
   * - alias resolution
   * - `enforce: 'pre'` plugins
   * - vite core plugins
   * - normal plugins
   * - vite build plugins
   * - `enforce: 'post'` plugins
   * - vite build post plugins
   */
  enforce?: 'pre' | 'post'
  /**
   * Apply the plugin only for serve or build, or on certain conditions.
   */
  apply?:
    | 'serve'
    | 'build'
    | ((this: void, config: any, env: any) => boolean)
  /**
   * Modify vite config before it's resolved. The hook can either mutate the
   * passed-in config directly, or return a partial config object that will be
   * deeply merged into existing config.
   *
   * Note: User plugins are resolved before running this hook so injecting other
   * plugins inside  the `config` hook will have no effect.
   */
  config?: ObjectHook<
    (
      this: void,
      config: any,
      env: any,
    ) =>
      | Omit<any, 'plugins'>
      | null
      | void
      | Promise<Omit<any, 'plugins'> | null | void>
  >
  /**
   * Use this hook to read and store the final resolved vite config.
   */
  configResolved?: ObjectHook<
    (this: void, config: any) => void | Promise<void>
  >
  /**
   * Configure the vite server. The hook receives the {@link ViteDevServer}
   * instance. This can also be used to store a reference to the server
   * for use in other hooks.
   *
   * The hooks will be called before internal middlewares are applied. A hook
   * can return a post hook that will be called after internal middlewares
   * are applied. Hook can be async functions and will be called in series.
   */
  configureServer?: ObjectHook<any>
  /**
   * Configure the preview server. The hook receives the {@link PreviewServer}
   * instance. This can also be used to store a reference to the server
   * for use in other hooks.
   *
   * The hooks are called before other middlewares are applied. A hook can
   * return a post hook that will be called after other middlewares are
   * applied. Hooks can be async functions and will be called in series.
   */
  configurePreviewServer?: ObjectHook<any>
  /**
   * Transform index.html.
   * The hook receives the following arguments:
   *
   * - html: string
   * - ctx?: vite.ServerContext (only present during serve)
   * - bundle?: rollup.OutputBundle (only present during build)
   *
   * It can either return a transformed string, or a list of html tag
   * descriptors that will be injected into the `<head>` or `<body>`.
   *
   * By default the transform is applied **after** vite's internal html
   * transform. If you need to apply the transform before vite, use an object:
   * `{ order: 'pre', handler: hook }`
   */
  transformIndexHtml?: any
  /**
   * Perform custom handling of HMR updates.
   * The handler receives a context containing changed filename, timestamp, a
   * list of modules affected by the file change, and the dev server instance.
   *
   * - The hook can return a filtered list of modules to narrow down the update.
   *   e.g. for a Vue SFC, we can narrow down the part to update by comparing
   *   the descriptors.
   *
   * - The hook can also return an empty array and then perform custom updates
   *   by sending a custom hmr payload via server.hot.send().
   *
   * - If the hook doesn't return a value, the hmr update will be performed as
   *   normal.
   */
  handleHotUpdate?: ObjectHook<
    (
      this: void,
      ctx: any,
    ) => Array<any> | void | Promise<Array<any> | void>
  >

  /**
   * extend hooks with ssr flag
   */
  resolveId?: ObjectHook<
    (
      this: PluginContext,
      source: string,
      importer: string | undefined,
      options: {
        attributes: Record<string, string>
        custom?: CustomPluginOptions
        ssr?: boolean
        /**
         * @internal
         */
        scan?: boolean
        isEntry: boolean
      },
    ) => Promise<ResolveIdResult> | ResolveIdResult
  >
  load?: ObjectHook<
    (
      this: PluginContext,
      id: string,
      options?: { ssr?: boolean },
    ) => Promise<LoadResult> | LoadResult
  >
  transform?: ObjectHook<
    (
      this: TransformPluginContext,
      code: string,
      id: string,
      options?: { ssr?: boolean },
    ) => Promise<TransformResult> | TransformResult
  >
}
export interface PluginHookUtils {
  getSortedPlugins: <K extends keyof Plugin>(
    hookName: K,
  ) => PluginWithRequiredHook<K>[]
  getSortedPluginHooks: <K extends keyof Plugin>(
    hookName: K,
  ) => NonNullable<HookHandler<Plugin[K]>>[]
}
export function createPluginHookUtils(
  plugins: readonly Plugin[],
): PluginHookUtils {
  // sort plugins per hook
  const sortedPluginsCache = new Map<keyof Plugin, Plugin[]>()
  function getSortedPlugins<K extends keyof Plugin>(
    hookName: K,
  ): PluginWithRequiredHook<K>[] {
    if (sortedPluginsCache.has(hookName))
      return sortedPluginsCache.get(hookName) as PluginWithRequiredHook<K>[]
    const sorted = getSortedPluginsByHook(hookName, plugins)
    sortedPluginsCache.set(hookName, sorted)
    return sorted
  }
  function getSortedPluginHooks<K extends keyof Plugin>(
    hookName: K,
  ): NonNullable<HookHandler<Plugin[K]>>[] {
    const plugins = getSortedPlugins(hookName)
    return plugins.map((p) => getHookHandler(p[hookName])).filter(Boolean)
  }

  return {
    getSortedPlugins,
    getSortedPluginHooks,
  }
}

export function getSortedPluginsByHook<K extends keyof Plugin>(
  hookName: K,
  plugins: readonly Plugin[],
): PluginWithRequiredHook<K>[] {
  const sortedPlugins: Plugin[] = []
  // Use indexes to track and insert the ordered plugins directly in the
  // resulting array to avoid creating 3 extra temporary arrays per hook
  let pre = 0,
    normal = 0,
    post = 0
  for (const plugin of plugins) {
    const hook = plugin[hookName]
    if (hook) {
      if (typeof hook === 'object') {
        if (hook.order === 'pre') {
          sortedPlugins.splice(pre++, 0, plugin)
          continue
        }
        if (hook.order === 'post') {
          sortedPlugins.splice(pre + normal + post++, 0, plugin)
          continue
        }
      }
      sortedPlugins.splice(pre + normal++, 0, plugin)
    }
  }

  return sortedPlugins as PluginWithRequiredHook<K>[]
}

export function getHookHandler<T extends ObjectHook<Function>>(
  hook: T,
): HookHandler<T> {
  return (typeof hook === 'object' ? hook.handler : hook) as HookHandler<T>
}
export type HookHandler<T> = T extends ObjectHook<infer H> ? H : T
export type PluginWithRequiredHook<K extends keyof Plugin> = Plugin & {
  [P in K]: NonNullable<Plugin[P]>
}