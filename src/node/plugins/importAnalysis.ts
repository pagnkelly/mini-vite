import type {
  ParseError as EsModuleLexerParseError,
  ExportSpecifier,
  ImportSpecifier,
} from 'es-module-lexer'
import MagicString from 'magic-string'
import { init, parse as parseImports } from 'es-module-lexer'
import { ResolvedConfig } from "../config";
import { isCSSRequest, stripBase } from "../utils";


const skipRE = /\.(?:map|json)(?:$|\?)/
export const canSkipImportAnalysis = (id: string): boolean =>
  skipRE.test(id) || isCSSRequest(id)

export function importAnalysisPlugin(config: ResolvedConfig) {
  const { root, base } = config
  return {
    name: 'vite:import-analysis',
    async transform(source: string, importer: string, options: any) {

      if (canSkipImportAnalysis(importer)) {
        return null
      }
      let imports!: readonly ImportSpecifier[]
      let exports!: readonly ExportSpecifier[]
      await init
      try {
        ;[imports, exports] = parseImports(source)
      } catch (_e: unknown) {
        console.log(_e)
      }
      if (!imports.length) {
        return source
      }
      let s: MagicString | undefined
      const str = () => s || (s = new MagicString(source))

      const normalizeUrl = async (
        url: string,
        pos: number,
        forceSkipImportAnalysis: boolean = false,
      ): Promise<[string, string]> => {
        url = stripBase(url, base)
        let importerFile = importer
        const resolved = await (this as any).resolve(url, importerFile)
        return [url, resolved.id]
      }
      await Promise.all(
        imports.map(async (importSpecifier, index) => {
          const { s: start, e: end, ss: expStart, se: expEnd, d: dynamicIndex, a: attributeIndex, } = importSpecifier;
          let specifier = importSpecifier.n;
          if (specifier) {
            // normalize
            const [url, resolvedId] = await normalizeUrl(specifier, start)
            console.log(url, resolvedId)
          }
        })
      )
    }
  }
}
