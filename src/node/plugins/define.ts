import { ResolvedConfig } from "../config";
import { getHash } from "../utils";
import { transform } from 'esbuild'
function canJsonParse(value: any): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export async function replaceDefine(
  code: string,
  id: string,
  define: Record<string, string>,
  config: ResolvedConfig,
): Promise<{ code: string; map: string | null }> {
  // Because esbuild only allows JSON-serializable values, and `import.meta.env`
  // may contain values with raw identifiers, making it non-JSON-serializable,
  // we replace it with a temporary marker and then replace it back after to
  // workaround it. This means that esbuild is unable to optimize the `import.meta.env`
  // access, but that's a tradeoff for now.
  const replacementMarkers: Record<string, string> = {}
  const env = define['import.meta.env']
  if (env && !canJsonParse(env)) {
    const marker = `_${getHash(env, env.length - 2)}_`
    replacementMarkers[marker] = env
    define = { ...define, 'import.meta.env': marker }
  }

  const result = await transform(code, {
    loader: 'js',
    charset: 'utf8',
    platform: 'neutral',
    define,
    sourcefile: id,
    sourcemap: true,
  })

  for (const marker in replacementMarkers) {
    result.code = result.code.replaceAll(marker, replacementMarkers[marker])
  }

  return {
    code: result.code,
    map: result.map || null,
  }
}
