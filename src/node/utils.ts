import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { ViteDevServer } from './server'
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