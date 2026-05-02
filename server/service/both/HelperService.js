import fetch from 'node-fetch'
import {Result, Service} from '#guoba.framework';

export default class HelperService extends Service {
  constructor(app) {
    super(app)
  }

  /** 转发请求 */
  async transitRequest(req, res) {
    let {url} = req.query
    if (!url) {
      return Result.error('url不能为空', 400)
    }
    url = decodeURIComponent(url)
    url = new URL(url)
    for (const [name, value] of Object.entries(req.query)) {
      if (name === 'url') {
        continue
      }
      url.searchParams.append(name, value)
    }
    let response = await fetch(url.toString(), {
      method: req.method,
      body: req.method === 'GET' ? undefined : req.body,
    })
    if (!response.ok) {
      return Result.error('请求失败', response.status)
    }
    for (const [key, value] of response.headers.entries()) {
      // 去掉压缩头
      if (key.toLowerCase() === 'content-encoding') {
        continue
      }
      res.setHeader(key, value)
    }
    let buffer = await response.arrayBuffer()
    buffer = Buffer.from(buffer)
    return buffer
  }

}
