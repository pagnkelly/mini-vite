import { ResolvedConfig } from "../config";
import { replaceDefine } from "./define";

export function clientInjectionsPlugin(config: ResolvedConfig) {
  return {
    name: 'vite:client-inject',
    async transform(code: string, id: string, options: any) {
      if (code.includes('process.env.NODE_ENV')) {
        const nodeEnv = JSON.stringify(process.env.NODE_ENV)
        return await replaceDefine(
          code,
          id,
          {
            'process.env.NODE_ENV': nodeEnv,
            'global.process.env.NODE_ENV': nodeEnv,
            'globalThis.process.env.NODE_ENV': nodeEnv,
          },
          config,
        )
      }
    }
  }
}