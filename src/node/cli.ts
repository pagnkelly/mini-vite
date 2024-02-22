import { cac } from 'cac'

import { readFileSync } from 'node:fs'

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url)).toString(),
)

const cli = cac('minivite')
cli
  .option('-c, --config <file>', `[string] use specified config file`)

cli
  .command('[root]', 'start dev server')
  .alias('serve')
  .alias('dev')
  .option('--host [host]', `[string] specify hostname`, { type: [(s: any) => String(s)] })
  .option('--port <port>', `[number] specify port`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .action(async (root, options) => {
    const { createServer } = await import('./server')
    try {
      const server = await createServer({
        root,
        server: options
      })

      await server.listen()
    } catch (error) {
      
    }
  })
cli.help()
cli.version(version)
cli.parse()