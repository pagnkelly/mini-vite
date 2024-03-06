import fs from 'node:fs'
import type { ResolvedConfig } from './config'
import { normalizePath } from './utils';

export interface FsUtils {
  existsSync: (path: string) => boolean
  tryResolveRealFileOrType: (
    path: string,
  ) => { path?: string; type: 'directory' | 'file' } | undefined
}
export function tryStatSync(file: string): fs.Stats | undefined {
  try {
    // The "throwIfNoEntry" is a performance optimization for cases where the file does not exist
    return fs.statSync(file, { throwIfNoEntry: false })
  } catch {
    // Ignore errors
  }
}
function tryResolveRealFileOrType(
  file: string,
): { path?: string; type: 'directory' | 'file' } | undefined {
  const fileStat = tryStatSync(file)
  if (fileStat?.isFile()) {
    return { path: normalizePath(file), type: 'file' }
  }
  if (fileStat?.isDirectory()) {
    return { type: 'directory' }
  }
  return
}
export const commonFsUtils: FsUtils = {
  existsSync: fs.existsSync,
  tryResolveRealFileOrType
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