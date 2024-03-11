import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { ViteDevServer } from './server'
import remapping from '@ampproject/remapping'
import type { DecodedSourceMap, RawSourceMap } from '@ampproject/remapping'
import { createFilter as _createFilter } from '@rollup/pluginutils'
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
const importQueryRE = /(\?|&)import=?(?:&|$)/
export const isImportRequest = (url: string): boolean => importQueryRE.test(url)
export const CSS_LANGS_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
export const isCSSRequest = (request: string): boolean =>
  CSS_LANGS_RE.test(request)
  const directRequestRE = /[?&]direct\b/
export const isDirectCSSRequest = (request: string): boolean =>
CSS_LANGS_RE.test(request) && directRequestRE.test(request)
const knownJsSrcRE =
  /\.(?:[jt]sx?|m[jt]s|vue|marko|svelte|astro|imba|mdx)(?:$|\?)/
export const isJSRequest = (url: string): boolean => {
  url = cleanUrl(url)
  if (knownJsSrcRE.test(url)) {
    return true
  }
  if (!path.extname(url) && url[url.length - 1] !== '/') {
    return true
  }
  return false
}

export const ERR_SYMLINK_IN_RECURSIVE_READDIR =
  'ERR_SYMLINK_IN_RECURSIVE_READDIR'
export async function recursiveReaddir(dir: string): Promise<string[]> {
  if (!fs.existsSync(dir)) {
    return []
  }
  let dirents: fs.Dirent[]
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true })
  } catch (e: any) {
    if (e.code === 'EACCES') {
      // Ignore permission errors
      return []
    }
    throw e
  }
  if (dirents.some((dirent) => dirent.isSymbolicLink())) {
    const err: any = new Error(
      'Symbolic links are not supported in recursiveReaddir',
    )
    err.code = ERR_SYMLINK_IN_RECURSIVE_READDIR
    throw err
  }
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? recursiveReaddir(res) : normalizePath(res)
    }),
  )
  return files.flat(1)
}

export const blankReplacer = (match: string): string => ' '.repeat(match.length)
const nullSourceMap: RawSourceMap = {
  names: [],
  sources: [],
  mappings: '',
  version: 3,
}
export function combineSourcemaps(
  filename: string,
  sourcemapList: Array<DecodedSourceMap | RawSourceMap>,
): RawSourceMap {
  if (
    sourcemapList.length === 0 ||
    sourcemapList.every((m) => m.sources.length === 0)
  ) {
    return { ...nullSourceMap }
  }

  // hack for parse broken with normalized absolute paths on windows (C:/path/to/something).
  // escape them to linux like paths
  // also avoid mutation here to prevent breaking plugin's using cache to generate sourcemaps like vue (see #7442)
  sourcemapList = sourcemapList.map((sourcemap) => {
    const newSourcemaps = { ...sourcemap }
    newSourcemaps.sources = sourcemap.sources.map((source) =>
      source ? escapeToLinuxLikePath(source) : null,
    )
    if (sourcemap.sourceRoot) {
      newSourcemaps.sourceRoot = escapeToLinuxLikePath(sourcemap.sourceRoot)
    }
    return newSourcemaps
  })
  const escapedFilename = escapeToLinuxLikePath(filename)

  // We don't declare type here so we can convert/fake/map as RawSourceMap
  let map //: SourceMap
  let mapIndex = 1
  const useArrayInterface =
    sourcemapList.slice(0, -1).find((m) => m.sources.length !== 1) === undefined
  if (useArrayInterface) {
    map = remapping(sourcemapList, () => null)
  } else {
    map = remapping(sourcemapList[0], function loader(sourcefile) {
      if (sourcefile === escapedFilename && sourcemapList[mapIndex]) {
        return sourcemapList[mapIndex++]
      } else {
        return null
      }
    })
  }
  if (!map.file) {
    delete map.file
  }

  // unescape the previous hack
  map.sources = map.sources.map((source) =>
    source ? unescapeToLinuxLikePath(source) : source,
  )
  map.file = filename

  return map as RawSourceMap
}

const windowsDriveRE = /^[A-Z]:/
const replaceWindowsDriveRE = /^([A-Z]):\//
const linuxAbsolutePathRE = /^\/[^/]/
function escapeToLinuxLikePath(path: string) {
  if (windowsDriveRE.test(path)) {
    return path.replace(replaceWindowsDriveRE, '/windows/$1/')
  }
  if (linuxAbsolutePathRE.test(path)) {
    return `/linux${path}`
  }
  return path
}

const revertWindowsDriveRE = /^\/windows\/([A-Z])\//
function unescapeToLinuxLikePath(path: string) {
  if (path.startsWith('/linux/')) {
    return path.slice('/linux'.length)
  }
  if (path.startsWith('/windows/')) {
    return path.replace(revertWindowsDriveRE, '$1:/')
  }
  return path
}
export function stripBase(path: string, base: string): string {
  if (path === base) {
    return '/'
  }
  const devBase = withTrailingSlash(base)
  return path.startsWith(devBase) ? path.slice(devBase.length - 1) : path
}
export function withTrailingSlash(path: string): string {
  if (path[path.length - 1] !== '/') {
    return `${path}/`
  }
  return path
}
export function isInNodeModules(id: string): boolean {
  return id.includes('node_modules')
}
export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}
export const bareImportRE = /^(?![a-zA-Z]:)[\w@](?!.*:\/\/)/
import os from 'node:os'
import MagicString from 'magic-string'
import { ResolvedConfig } from './config'
import { TransformResult } from 'rollup'
export const isWindows = os.platform() === 'win32'
let firstSafeRealPathSyncRun = false
function optimizeSafeRealPathSync() {
  // Skip if using Node <18.10 due to MAX_PATH issue: https://github.com/vitejs/vite/issues/12931
  const nodeVersion = process.versions.node.split('.').map(Number)
  if (nodeVersion[0] < 18 || (nodeVersion[0] === 18 && nodeVersion[1] < 10)) {
    safeRealpathSync = fs.realpathSync
    return
  }
}
function windowsSafeRealPathSync(path: string): string {
  if (!firstSafeRealPathSyncRun) {
    optimizeSafeRealPathSync()
    firstSafeRealPathSyncRun = true
  }
  return fs.realpathSync(path)
}
export let safeRealpathSync = isWindows
? windowsSafeRealPathSync
: fs.realpathSync.native
const VOLUME_RE = /^[A-Z]:/i
export const FS_PREFIX = `/@fs/`
export const startsWithWordCharRE = /^\w/
export function fsPathFromId(id: string): string {
  const fsPath = normalizePath(
    id.startsWith(FS_PREFIX) ? id.slice(FS_PREFIX.length) : id,
  )
  return fsPath[0] === '/' || VOLUME_RE.test(fsPath) ? fsPath : `/${fsPath}`
}
export const isNonDriveRelativeAbsolutePath = (p: string): boolean => {
  if (!isWindows) return p[0] === '/'
  return windowsDrivePathPrefixRE.test(p)
}
const windowsDrivePathPrefixRE = /^[A-Za-z]:[/\\]/

export function transformStableResult(
 s: MagicString,
): TransformResult {
 return {
   code: s.toString(),
   map: null
 }
}
export const VALID_ID_PREFIX = `/@id/`
const NULL_BYTE_PLACEHOLDER = `__x00__`;
export function wrapId(id: string): string {
  return id.startsWith(VALID_ID_PREFIX)
    ? id
    : VALID_ID_PREFIX + id.replace('\0', NULL_BYTE_PLACEHOLDER)
}
export function unwrapId(id: string): string {
  return id.startsWith(VALID_ID_PREFIX)
    ? id.slice(VALID_ID_PREFIX.length).replace(NULL_BYTE_PLACEHOLDER, '\0')
    : id
}

const trailingSeparatorRE = /[?&]$/
export function removeImportQuery(url: string): string {
  return url.replace(importQueryRE, '$1').replace(trailingSeparatorRE, '')
}
const replacePercentageRE = /%/g
export function injectQuery(url: string, queryToInject: string): string {
  // encode percents for consistent behavior with pathToFileURL
  // see #2614 for details
  const resolvedUrl = new URL(
    url.replace(replacePercentageRE, '%25'),
    'relative:///',
  )
  const { search, hash } = resolvedUrl
  let pathname = cleanUrl(url)
  
  pathname = isWindows ? slash(pathname) : pathname
  return `${pathname}?${queryToInject}${search ? `&` + search.slice(1) : ''}${
    hash ?? ''
  }`
}
const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}
export const rawRE = /(\?|&)raw(?:&|$)/
export const urlRE = /(\?|&)url(?:&|$)/
export function removeUrlQuery(url: string): string {
  return url.replace(urlRE, '$1').replace(trailingSeparatorRE, '')
}
export function joinUrlSegments(a: string, b: string): string {
  if (!a || !b) {
    return a || b || ''
  }
  if (a[a.length - 1] === '/') {
    a = a.substring(0, a.length - 1)
  }
  if (b[0] !== '/') {
    b = '/' + b
  }
  return a + b
}

export function removeLeadingSlash(str: string): string {
  return str[0] === '/' ? str.slice(1) : str
}
export const createFilter = _createFilter as (
  include?: any,
  exclude?: any,
  options?: { resolve?: string | false | null },
) => (id: string | unknown) => boolean
