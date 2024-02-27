import fs from 'node:fs'
import type { ResolvedConfig } from './config'

export interface FsUtils {
  existsSync: (path: string) => boolean
}

export const commonFsUtils: FsUtils = {
  existsSync: fs.existsSync
}
const cachedFsUtilsMap = new WeakMap<ResolvedConfig, FsUtils>()
export function getFsUtils(config: ResolvedConfig) {
  let fsUtils = cachedFsUtilsMap.get(config)
  if (!fsUtils) {
    fsUtils = commonFsUtils
    cachedFsUtilsMap.set(config, fsUtils)
  }
  return fsUtils
}