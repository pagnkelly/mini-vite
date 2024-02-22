export async function resolveHttpServer (app: any) {
  const { createServer } = await import('node:http')
  return createServer(app)
}

export async function httpServerStart (httpServer: any, serverOptions: { port: number; host: string }): Promise<number> {
  let { port, host } = serverOptions

  return new Promise((resolve, reject) => {
    const onError = (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.info(`Port ${port} is in use, trying another one...`);
        httpServer.listen(++port, host, () => {
          console.info(`port use ${port}`);
          resolve(port);
        });
      }
      else {
          httpServer.removeListener('error', onError);
          reject(e);
      }
    }
    httpServer.on('error', onError);
    httpServer.listen(port, host, () => {
        httpServer.removeListener('error', onError);
        resolve(port);
    });
  })
}
