import { FsUtils, commonFsUtils } from "../../fsUtils";
import { cleanUrl } from "../../utils";
import path from 'node:path'

export function htmlFallbackMiddleware (root: string,fsUtils: FsUtils = commonFsUtils,) {
  
  return function viteHtmlFallbackMiddleware(req: any, res: any, next: any) {
    const url = cleanUrl(req.url!)
    const pathname = decodeURIComponent(url)
    let newUrl = url
    
    if (pathname[pathname.length - 1] === '/') {
      const filePath = path.join(root, pathname, 'index.html')
      if (fsUtils.existsSync(filePath)) {
        newUrl = newUrl + 'index.html'
      }
    }
    
    else if (!pathname.endsWith('.html')) {
      const filePath = path.join(root, pathname + '.html')
      if (fsUtils.existsSync(filePath)) {
        newUrl = newUrl + '.html'
      }
    }
    req.url = newUrl
    next()
  }
}
