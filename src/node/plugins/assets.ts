import path from "path";
import { ResolvedConfig } from "../config";
import { checkPublicFile } from "../publicDir";

export function assetPlugin(config: ResolvedConfig) {
  return {
    name: 'vite:asset',
    resolveId(id: string) {
      // imports to absolute urls pointing to files in /public
      // will fail to resolve in the main resolver. handle them here.
      const publicFile = checkPublicFile(id, config)
      if (publicFile) {
        return id
      }
    },
  }
}


