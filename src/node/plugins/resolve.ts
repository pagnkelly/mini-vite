import path from "node:path";
import fs from 'node:fs'
import { exports, imports } from 'resolve.exports'
import { PackageData, resolvePackageData } from "../packages";
import { FS_PREFIX, bareImportRE, cleanUrl, fsPathFromId, isInNodeModules, isNonDriveRelativeAbsolutePath, isObject, startsWithWordCharRE, withTrailingSlash } from "../utils";
import { commonFsUtils, tryStatSync } from "../fsUtils";
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
  let basedir = root;
  if (importer &&
    path.isAbsolute(importer) &&
    // css processing appends `*` for importer
    (importer[importer.length - 1] === '*' || fs.existsSync(cleanUrl(importer)))) {
    basedir = path.dirname(importer);
  }
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
  const { root } = resolveOptions
  const rootInRoot = tryStatSync(path.join(root, root))?.isDirectory() ?? false;

  return { 
    name: 'vite:resolve',
    async resolveId(id: string, importer: string, resolveOpts: {}) {
      let res
      if (id.startsWith(FS_PREFIX)) {
        res = fsPathFromId(id);
        return res
      }
      if (
        id[0] === '/' &&
        (rootInRoot || !id.startsWith(withTrailingSlash(root)))
      ) {
        const fsPath = path.resolve(root, id.slice(1))
        console.log(fsPath, 'aaaa')
        if ((res = tryFsResolve(fsPath))) {
          console.log(res, 'bbb')
          return res
        }
      }
      if (id[0] === '.' || (importer?.endsWith('.html') && startsWithWordCharRE.test(id))) {
        const basedir = importer ? path.dirname(importer) : process.cwd()
        const fsPath = path.resolve(basedir, id)
        if ((res = tryFsResolve(fsPath))) {
          return res
        }
      }

      if (isNonDriveRelativeAbsolutePath(id) &&
      (res = tryFsResolve(id))) {
        return res
      }
      
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

