import path from "node:path";
import { exports, imports } from 'resolve.exports'
import { PackageData, resolvePackageData } from "../packages";
import { bareImportRE, cleanUrl, isInNodeModules, isObject } from "../utils";
import { commonFsUtils } from "../fsUtils";
function splitFileAndPostfix(path: string) {
  const file = cleanUrl(path)
  return { file, postfix: path.slice(file.length) }
}

function resolveExportsOrImports (
  pkg: PackageData['data'],
  key: string,
  options: any,
  targetWeb: boolean,
  type: 'imports' | 'exports',
) {

  const additionalConditions = new Set([
      'production',
      'development',
      'module',
    ],
  )

  const conditions: any = [...additionalConditions].filter((condition) => {
    switch (condition) {
      case 'production':
        return options.isProduction
      case 'development':
        return !options.isProduction
    }
    return true
  })
  const fn = type === 'imports' ? imports : exports

  const result = fn(pkg, key, {
    browser: targetWeb && !additionalConditions.has('node'),
    require: options.isRequire && !additionalConditions.has('import'),
    conditions,
  })
  return result ? result[0] : undefined
}
function tryCleanFsResolve (file: string) {
  const fsUtils = commonFsUtils;
  // Optimization to get the real type or file type (directory, file, other)
  const fileResult = fsUtils.tryResolveRealFileOrType(file);

  if (fileResult?.path)
      return fileResult.path;
}
export function tryFsResolve(
  fsPath: string,
  options: any,
  tryIndex = true,
  targetWeb = true,
  skipPackageJson = false,
): string | undefined {
  // Dependencies like es5-ext use `#` in their paths. We don't support `#` in user
  // source code so we only need to perform the check for dependencies.
  // We don't support `?` in node_modules paths, so we only need to check in this branch.
  const hashIndex = fsPath.indexOf('#')
  if (hashIndex >= 0 && isInNodeModules(fsPath)) {
    const queryIndex = fsPath.indexOf('?')
    // We only need to check foo#bar?baz and foo#bar, ignore foo?bar#baz
    if (queryIndex < 0 || queryIndex > hashIndex) {
      const file = queryIndex > hashIndex ? fsPath.slice(0, queryIndex) : fsPath
      const res = tryCleanFsResolve(
        file
      )
      if (res) return res + fsPath.slice(file.length)
    }
  }
  const { file, postfix } = splitFileAndPostfix(fsPath)
  const res = tryCleanFsResolve(
    file
  )
  if (res) return res + postfix
}
function resolvePackageEntry (
  id: string,
  { dir, data, setResolvedCache, getResolvedCache }: PackageData,
  targetWeb: boolean,
  options: any,
) {
  const { file: idWithoutPostfix, postfix } = splitFileAndPostfix(id)

  const cached = getResolvedCache('.', targetWeb)
  if (cached) {
    return cached + postfix
  }
  try {
    let entryPoint
    if (data.exports) {
      entryPoint = resolveExportsOrImports(data, '.', options, targetWeb, 'exports');
    }
    entryPoint ||= data.main
  
    const entryPoints = entryPoint
        ? [entryPoint]
        : ['index.js', 'index.json', 'index.node']
    for (let entry of entryPoints) {
      const entryPointPath = path.join(dir, entry)

      const resolvedEntryPoint = tryFsResolve(
        entryPointPath,
        options,
        true,
        true,
        false,
      )
      if (resolvedEntryPoint) {
        setResolvedCache('.', resolvedEntryPoint, targetWeb)
        return resolvedEntryPoint + postfix
      }
    } 
  } catch {
  }
}

export function tryNodeResolve(
  id: string,
  importer: string | null | undefined,
  options: any
) {
  const { root } = options
  const pkgId = cleanUrl(id)
  const basedir = root
  const pkg = resolvePackageData(pkgId, basedir)
  if (!pkg) {
    return
  }
  const resolveId = resolvePackageEntry
  const unresolvedId = id
  let resolved: string | undefined
  try {
    resolved = resolveId(unresolvedId, pkg, true, options)
  } catch (err) {
    throw err
  }
  return { id: resolved }
}

export function resolvePlugin(resolveOptions: any) {
  return {
    name: 'vite:resolve',
    async resolveId(id: string, importer: string, resolveOpts: {}) {
      let res
      if (bareImportRE.test(id)) {
        if (
          (res = tryNodeResolve(
            id,
            importer,
            resolveOptions
          ))
        ) {
          return res
        }
      }
    }
  }
}

function mapWithBrowserField(
  relativePathInPkgDir: string,
  map: Record<string, string | false>,
): string | false | undefined {
  const normalizedPath = path.posix.normalize(relativePathInPkgDir)

  for (const key in map) {
    const normalizedKey = path.posix.normalize(key)
    if (
      normalizedPath === normalizedKey ||
      equalWithoutSuffix(normalizedPath, normalizedKey, '.js') ||
      equalWithoutSuffix(normalizedPath, normalizedKey, '/index.js')
    ) {
      return map[key]
    }
  }
}
function equalWithoutSuffix(path: string, key: string, suffix: string) {
  return key.endsWith(suffix) && key.slice(0, -suffix.length) === path
}
