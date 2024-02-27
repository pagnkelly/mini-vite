import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from 'node:http'

export interface SendOptions {
  headers?: OutgoingHttpHeaders
}

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
  res.statusCode = 200
  res.end(content)
  return
}