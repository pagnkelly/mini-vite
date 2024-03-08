import { SourceDescription } from "rollup";
import { ViteDevServer } from ".";
import fsp from 'node:fs/promises'
import getEtag from 'etag'
import path from 'node:path'
import convertSourceMap from 'convert-source-map'
import { blankReplacer, isObject } from "../utils";
import { getFsUtils } from "../fsUtils";

export async function transformRequest(
  server: ViteDevServer,
  id: string
) {
  const { pluginContainer } = server
  let code = null
  let map: SourceDescription['map'] = null
  const loadResult = await pluginContainer.load(id)
  const fsUtils = getFsUtils(server.config)
  const filePath = path.join(server.config.root, decodeURIComponent(id))
  if (!loadResult) {
    if (fsUtils.existsSync(filePath)) {
      code = await fsp.readFile(filePath, 'utf-8')
    }
    if (code) {
      try {
        map = (
          convertSourceMap.fromSource(code) ||
          (await convertSourceMap.fromMapFileSource(
            code,
            createConvertSourceMapReadMap(id),
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
  if (code == null) {
    return 
  }

  id = fsUtils.existsSync(filePath) ? filePath : id
    
  const transformResult = await pluginContainer.transform(code, id, {
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