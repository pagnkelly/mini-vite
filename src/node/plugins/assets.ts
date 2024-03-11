import fsp from 'node:fs/promises'
import { ResolvedConfig } from "../config";
import { checkPublicFile } from "../publicDir";
import { FS_PREFIX, cleanUrl, joinUrlSegments, rawRE, removeLeadingSlash, removeUrlQuery, urlRE, withTrailingSlash } from "../utils";
import path from 'node:path';
const viteBuildPublicIdPrefix = '\0vite:asset:public'

function fileToDevUrl(id: string, config: ResolvedConfig) {
  let rtn: string
  if (checkPublicFile(id, config)) {
    // in public dir during dev, keep the url as-is
    rtn = id
  } else if (id.startsWith(withTrailingSlash(config.root))) {
    // in project root, infer short public path
    rtn = '/' + path.posix.relative(config.root, id)
  } else {
    // outside of project root, use absolute fs path
    // (this is special handled by the serve static middleware
    rtn = path.posix.join(FS_PREFIX, id)
  }
  const base = joinUrlSegments(config.server?.origin ?? '', config.base)
  return joinUrlSegments(base, removeLeadingSlash(rtn))
}
export async function fileToUrl(
  id: string,
  config: ResolvedConfig,
  ctx: any,
): Promise<string> {
  return fileToDevUrl(id, config)
}
export function assetPlugin(config: ResolvedConfig) {
  return {
    name: 'vite:asset',
    async load(id: string) {
      if (id.startsWith(viteBuildPublicIdPrefix)) {
        id = id.slice(viteBuildPublicIdPrefix.length)
      }
      if (id[0] === '\0') {
        // Rollup convention, this id should be handled by the
        // plugin that marked it with \0
        return
      }

      // raw requests, read from disk
      if (rawRE.test(id)) {
        const file = checkPublicFile(id, config) || cleanUrl(id)
        // raw query, read file and return as string
        return `export default ${JSON.stringify(
          await fsp.readFile(file, 'utf-8'),
        )}`
      }

      if (!urlRE.test(id) && !config.assetsInclude(cleanUrl(id))) {
        return
      }

      id = removeUrlQuery(id)
      let url = await fileToUrl(id, config, this)

      return `export default ${JSON.stringify(url)}`
    },
    resolveId(id: string) {
      // imports to absolute urls pointing to files in /public
      // will fail to resolve in the main resolver. handle them here.
      const publicFile = checkPublicFile(id, config)
      if (publicFile) {
        return id
      }
    },
  }
}


