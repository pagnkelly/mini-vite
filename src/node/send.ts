import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from 'node:http'

export interface SendOptions {
  headers?: OutgoingHttpHeaders
}
const alias: Record<string, string | undefined> = {
  js: 'text/javascript',
  css: 'text/css',
  html: 'text/html',
  json: 'application/json',
};
export function send(
  req: IncomingMessage,
  res: ServerResponse,
  content: string | Buffer,
  type: string,
  options: SendOptions,
): void {
  const {
    headers,
  } = options
  if (headers) {
    for (const name in headers) {
      res.setHeader(name, headers[name]!)
    }
  }

  res.setHeader('Content-Type', alias[type] || type);
  res.statusCode = 200
  res.end(content)
  return
}