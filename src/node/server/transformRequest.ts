import { SourceDescription } from "rollup";
import { ViteDevServer } from ".";
import fsp from 'node:fs/promises'
import getEtag from 'etag'
import path from 'node:path'
import convertSourceMap from 'convert-source-map'
import { blankReplacer, isObject } from "../utils";

export async function transformRequest(
  server: ViteDevServer,
  filePath: string
) {
  const { pluginContainer } = server
  let code = await fsp.readFile(filePath, 'utf-8')
  let map: SourceDescription['map'] = null
  const loadResult = await pluginContainer.load(filePath)
  if (!loadResult) {
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
  } else {
    if (isObject(loadResult)) {
      code = loadResult.code
      map = loadResult.map
    } else {
      code = loadResult
    }
  }
  
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