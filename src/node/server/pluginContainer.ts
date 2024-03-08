import { SourceDescription, SourceMap } from "rollup";
import { ResolvedConfig } from "../config";
import { join } from 'node:path'
import { cleanUrl, combineSourcemaps } from "../utils";
import type { RawSourceMap } from "@ampproject/remapping";
import { createPluginHookUtils, getHookHandler } from "../plugins";

export async function createPluginContainer(
  config: ResolvedConfig,
): Promise<any> {
  const {
    plugins,
    root,
  } = config
  const { getSortedPluginHooks, getSortedPlugins } =
  createPluginHookUtils(plugins)
  class Context {
    constructor () {
  
    }
    async load(
      options: {
        id: string
        resolveDependencies?: boolean
      }
    ){
      const loadResult = await container.load(options.id, { ssr: false })
      const code =
      typeof loadResult === 'object' ? loadResult?.code : loadResult
      if (code != null) {
        await container.transform(code, options.id, { ssr: false })
      }
      return options
    }
    async resolve(
      id: string,
      importer?: string,
      options?: {
        attributes?: Record<string, string>
        custom?: any
        isEntry?: boolean
        skipSelf?: boolean
      },
    ) {
      let skip: Set<Plugin> | undefined
     
      let out = await container.resolveId(id, importer, {
        attributes: options?.attributes,
        custom: options?.custom,
        isEntry: !!options?.isEntry,
        skip,
        ssr: false,
        scan: false,
      })
      if (typeof out === 'string') out = { id: out }
      return out
    }
    warn(
      e: any,
      position?: number | { column: number; line: number },
    ) {
      const err = typeof e === 'function' ? e() : e
      const msg = `warning: ${err.message}`
      console.log(msg)
    }
  
    error(
      e: any
    ): never {
      // error thrown here is caught by the transform middleware and passed on
      // the the error middleware.
      throw e
    }
  }
  
  class TransformContext extends Context {
    filename: string
    originalCode: string
    combinedMap: SourceMap | { mappings: '' } | null = null
    sourcemapChain: NonNullable<SourceDescription['map']>[] = []
    constructor(id: string, code: string, inMap?: SourceMap | string) {
      super()
      this.filename = id
      this.originalCode = code
    }
    _getCombinedSourcemap() {
  
      let combinedMap = this.combinedMap
      // { mappings: '' }
      if (
        combinedMap &&
        !('version' in combinedMap) &&
        combinedMap.mappings === ''
      ) {
        this.sourcemapChain.length = 0
        return combinedMap
      }
  
      for (let m of this.sourcemapChain) {
        if (typeof m === 'string') m = JSON.parse(m)
        if (!('version' in (m as SourceMap))) {
          // { mappings: '' }
          if ((m as SourceMap).mappings === '') {
            combinedMap = { mappings: '' }
            break
          }
          // empty, nullified source map
          combinedMap = null
          break
        }
        if (!combinedMap) {
          const sm = m as SourceMap
          // sourcemap should not include `sources: [null]` (because `sources` should be string) nor
          // `sources: ['']` (because `''` means the path of sourcemap)
          // but MagicString generates this when `filename` option is not set.
          // Rollup supports these and therefore we support this as well
          if (sm.sources.length === 1 && !sm.sources[0]) {
            combinedMap = {
              ...sm,
              sources: [this.filename],
              sourcesContent: [this.originalCode],
            }
          } else {
            combinedMap = sm
          }
        } else {
          combinedMap = combineSourcemaps(cleanUrl(this.filename), [
            m as RawSourceMap,
            combinedMap as RawSourceMap,
          ]) as SourceMap
        }
      }
      if (combinedMap !== this.combinedMap) {
        this.combinedMap = combinedMap
        this.sourcemapChain.length = 0
      }
      return this.combinedMap
    }
  }
  const processesing = new Set<Promise<any>>()
  function handleHookPromise<T>(maybePromise: undefined | T | Promise<T>) {
    if (!(maybePromise as any)?.then) {
      return maybePromise
    }
    const promise = maybePromise as Promise<T>
    processesing.add(promise)
    return promise.finally(() => processesing.delete(promise))
  }
  async function hookParallel(
    hookName: any,
    context: any,
    args: any,
  ): Promise<void> {
    const parallelPromises: Promise<unknown>[] = []
    for (const plugin of getSortedPlugins(hookName)) {
      // Don't throw here if closed, so buildEnd and closeBundle hooks can finish running
      const hook = plugin[hookName]
      if (!hook) continue

      const handler: Function = getHookHandler(hook)
      if ((hook as { sequential?: boolean }).sequential) {
        await Promise.all(parallelPromises)
        parallelPromises.length = 0
        await handler.apply(context(plugin), args(plugin))
      } else {
        parallelPromises.push(handler.apply(context(plugin), args(plugin)))
      }
    }
    await Promise.all(parallelPromises)
  }
  const container = {
    async load(id:string, options: any) {
      const ssr = options?.ssr
      const ctx = new Context()
      for (const plugin of getSortedPlugins('load')) {
        if (!plugin.load) continue
        const handler = getHookHandler(plugin.load)
        const result = await handleHookPromise(
          handler.call(ctx as any, id, { ssr }),
        )
        if (result != null) {
          return result
        }
      }
      return null
    },
    async buildStart() {
      await handleHookPromise(
        hookParallel(
          'buildStart',
          (plugin: any) => new Context(),
          () => [],
        ),
      )
    },
    async transform(code: any, id: any, options: any) {
      const ctx = new TransformContext(id, code, options.inMap)

      for (const plugin of plugins) {
        let result
        const handler = plugin.transform
        if (!handler) continue
        try {
          result = await handler.call(ctx as any, code, id, { ssr: false })

        } catch (e) {
          ctx.error(e)
        }
        if (!result) continue
        code = typeof result === 'string'? result : result?.code
      }
      return {
        code,
        map: ctx._getCombinedSourcemap(),
      }
    },
    async resolveId(rawId: string, importer= join(root, 'index.html'), options: any) {
      const ctx = new Context()
      let id = null
      for (const plugin of plugins) {
        if (!plugin.resolveId) continue
        const handler = plugin.resolveId
        const result = await handler.call(ctx as any, rawId, importer, {
          attributes: options?.attributes ?? {},
            custom: options?.custom,
            isEntry: !!options?.isEntry,
            ssr: false,
            scan: false,
        })
        if (!result) continue

        id = typeof result === 'string' ? result : result?.id
      }
      return id ? { id } : id
    }
  }
  return container
}
