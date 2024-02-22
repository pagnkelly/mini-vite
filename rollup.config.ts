import type { RollupOptions } from 'rollup'
import { defineConfig } from 'rollup'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import typescript from '@rollup/plugin-typescript'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function createNodeConfig(isProduction: boolean) {
  const declarationDir = isProduction ? false : './dist/node'
  return defineConfig({
    input: {
      cli: path.resolve(__dirname, 'src/node/cli.ts'),
    },
    output: {
      dir: './dist',
      entryFileNames: `node/[name].js`,
      exports: 'named',
      sourcemap: !isProduction,
      format: 'esm',
    },
    plugins: [
      typescript({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: !isProduction,
        declaration: declarationDir !== false,
        declarationDir: declarationDir !== false ? declarationDir : undefined,
      }),
    ]
  })
}

function createCjsConfig(isProduction: boolean) {
  const declarationDir = isProduction ? false : './dist/node'
  return defineConfig({
    input: {
      cli: path.resolve(__dirname, 'src/node/cli.ts'),
    },
    output: {
      dir: './dist',
      sourcemap: !isProduction,
      entryFileNames: `node-cjs/[name].cjs`,
      exports: 'named',
      format: 'cjs',
    },
    plugins: [
      typescript({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: !isProduction,
        declaration: declarationDir !== false,
        declarationDir: declarationDir !== false ? declarationDir : undefined,
      }),
    ]
  })
}

export default (commandLineArgs: any): RollupOptions[] => {
  const isDev = commandLineArgs.watch
  const isProduction = !isDev

  return defineConfig([
    createNodeConfig(isProduction),
    // createCjsConfig(isProduction),
  ])
}

