import net from 'net'
import fetch from 'node-fetch'
import {Result, Service} from '#guoba.framework';

const MAX_TRANSIT_SIZE = 20 * 1024 * 1024
const TRANSIT_TIMEOUT_MS = 10000
const transitContentTypes = new Map([
  ['.bmp', 'image/bmp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.icon', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
])
const allowedTransitExtensions = new Set(transitContentTypes.keys())
const allowedTransitResponseHeaders = new Set([
  'cache-control',
  'etag',
  'expires',
  'last-modified',
])

export default class HelperService extends Service {
  constructor(app) {
    super(app)
  }

  /** 转发请求 */
  async transitRequest(req, res) {
    if (req.method !== 'GET') {
      return Result.error('中转请求仅支持GET', 405)
    }
    let {url} = req.query
    if (!url) {
      return Result.error('url不能为空', 400)
    }
    url = parseTransitUrl(url)
    if (!url) {
      return Result.error('url不合法', 400)
    }
    const rejectReason = getTransitRejectReason(url)
    if (rejectReason) {
      return Result.error(rejectReason, 403)
    }
    for (const [name, value] of Object.entries(req.query)) {
      if (name === 'url') {
        continue
      }
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) {
        url.searchParams.append(name, item)
      }
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TRANSIT_TIMEOUT_MS)
    let response
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      })
    } catch (error) {
      return Result.error(error?.name === 'AbortError' ? '请求超时' : '请求失败', 502)
    } finally {
      clearTimeout(timeout)
    }
    if (response.status >= 300 && response.status < 400) {
      return Result.error('不允许重定向', 403)
    }
    if (!response.ok) {
      return Result.error('请求失败', response.status)
    }
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_TRANSIT_SIZE) {
      return Result.error('资源过大', 413)
    }
    let buffer = await response.arrayBuffer()
    buffer = Buffer.from(buffer)
    if (buffer.length > MAX_TRANSIT_SIZE) {
      return Result.error('资源过大', 413)
    }
    setTransitResponseHeaders(res, url, response)
    return buffer
  }

}

function parseTransitUrl(value) {
  const text = String(Array.isArray(value) ? value[0] : value || '').trim()
  if (!text) {
    return null
  }
  try {
    return new URL(text)
  } catch {
    try {
      return new URL(decodeURIComponent(text))
    } catch {
      return null
    }
  }
}

function getTransitRejectReason(url) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return '仅支持http或https地址'
  }
  if (isBlockedTransitHost(url.hostname)) {
    return '不允许访问本地或内网地址'
  }
  if (!isAllowedTransitHost(url.hostname)) {
    return '仅支持Gitee媒体资源中转'
  }
  if (!allowedTransitExtensions.has(getUrlExtension(url))) {
    return '仅支持安全图片或媒体资源中转'
  }
  return ''
}

function setTransitResponseHeaders(res, url, response) {
  res.setHeader('Content-Type', transitContentTypes.get(getUrlExtension(url)) || 'application/octet-stream')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', 'sandbox')
  for (const [key, value] of response.headers.entries()) {
    if (allowedTransitResponseHeaders.has(key.toLowerCase())) {
      res.setHeader(key, value)
    }
  }
}

function isAllowedTransitHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  return host === 'gitee.com' || host.endsWith('.gitee.com')
}

function isBlockedTransitHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') {
    return true
  }
  if (net.isIP(host) === 4) {
    return isBlockedIpv4(host)
  }
  if (net.isIP(host) === 6) {
    return isBlockedIpv6(host)
  }
  return false
}

function isBlockedIpv4(ip) {
  const parts = ip.split('.').map(Number)
  const [a, b] = parts
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
}

function isBlockedIpv6(ip) {
  const normalized = ip.toLowerCase()
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
}

function getUrlExtension(url) {
  let pathname = url.pathname || ''
  try {
    pathname = decodeURIComponent(pathname)
  } catch {
  }
  pathname = pathname.toLowerCase()
  const index = pathname.lastIndexOf('.')
  return index > -1 ? pathname.slice(index) : ''
}
