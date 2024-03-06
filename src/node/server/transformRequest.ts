import { SourceDescription } from "rollup";
import { ViteDevServer } from ".";
import fsp from 'node:fs/promises'
import getEtag from 'etag'
import path from 'node:path'
import convertSourceMap from 'convert-source-map'
import { blankReplacer } from "../utils";

export async function transformRequest(
  server: ViteDevServer,
  filePath: string
) {

  let code = await fsp.readFile(filePath, 'utf-8')

  let map: SourceDescription['map'] = null

  if (code) {
    try {
      map = (
        convertSourceMap.fromSource(code) ||
        (await convertSourceMap.fromMapFileSource(
          code,
          createConvertSourceMapReadMap(filePath),
        ))
      )?.toObject()

      code = code.replace(convertSourceMap.mapFileCommentRegex, blankReplacer)
    } catch (e) {
      console.log(e)
    }
  }
  const { pluginContainer } = server
  const transformResult = await pluginContainer.transform(code, filePath, {
      inMap: map
  });
  if (transformResult) {
    code = transformResult.code
    map = transformResult.map
  }
  const etag = getEtag(code, { weak: true })
  return {
    code,
    map,
    etag
  }
}

function createConvertSourceMapReadMap(originalFileName: string) {
  return (filename: string) => {
    return fsp.readFile(
      path.resolve(path.dirname(originalFileName), filename),
      'utf-8',
    )
  }
}