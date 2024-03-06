import path from "path"
import fs from 'node:fs'
import { safeRealpathSync } from "./utils"
export interface PackageData {
  nodeResolvedImports: any
  webResolvedImports: any
  dir: string
  setResolvedCache: (key: string, entry: string, targetWeb: boolean) => void
  getResolvedCache: (key: string, targetWeb: boolean) => string | undefined
  data: {
    [field: string]: any
    name: string
    type: string
    version: string
    main: string
    module: string
    browser: string | Record<string, string | false>
    exports: string | Record<string, any> | string[]
    imports: Record<string, any>
    dependencies: Record<string, string>
  }
}

export function loadPackageData(pkgPath: string): PackageData {
  const data = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const pkgDir = path.dirname(pkgPath)
  const pkg: PackageData = {
    dir: pkgDir,
    data,
    webResolvedImports: {},
    nodeResolvedImports: {},
    setResolvedCache(key: string, entry: string, targetWeb: boolean) {
      if (targetWeb) {
        pkg.webResolvedImports[key] = entry
      } else {
        pkg.nodeResolvedImports[key] = entry
      }
    },
    getResolvedCache(key: string, targetWeb: boolean) {
      if (targetWeb) {
        return pkg.webResolvedImports[key]
      } else {
        return pkg.nodeResolvedImports[key]
      }
    },
  }

  return pkg
}
export function resolvePackageData(
  pkgName: string,
  basedir: string,
): PackageData | null {
  while (basedir) {
    const pkg = path.join(basedir, 'node_modules', pkgName, 'package.json')
    try {
      if (fs.existsSync(pkg)) {
        const pkgPath = safeRealpathSync(pkg)
        const pkgData = loadPackageData(pkgPath)
        return pkgData
      }
    } catch {}
  }
  return null
}