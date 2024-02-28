import type { ResolvedConfig } from './config'
import { ERR_SYMLINK_IN_RECURSIVE_READDIR, recursiveReaddir } from './utils'
const publicFilesMap = new WeakMap<ResolvedConfig, Set<string>>()
export async function initPublicFiles(
  config: ResolvedConfig,
): Promise<Set<string> | undefined> {
  let fileNames: string[]
  try {
    fileNames = await recursiveReaddir(config.publicDir)
  } catch (e: any) {
    if (e.code === ERR_SYMLINK_IN_RECURSIVE_READDIR) {
      return
    }
    throw e
  }
  const publicFiles = new Set(
    fileNames.map((fileName) => fileName.slice(config.publicDir.length)),
  )
  publicFilesMap.set(config, publicFiles)
  return publicFiles
}