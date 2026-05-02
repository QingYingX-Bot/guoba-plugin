import fetch from 'node-fetch'
import fs from 'fs'
import http from 'http'
import https from 'https'
import path from 'path'
import {sleep} from '#guoba.utils'
import {_paths, cfg} from '#guoba.platform'
import {isTRSS} from '#guoba.adapter'

export function listen(app, port) {
  return new Promise((resolve, reject) => {
    let server
    try {
      server = createServer(app).listen(port)
    } catch (error) {
      reject(error)
      return
    }
    // 重试次数
    let left = 3, num = 1
    // 重试间隔
    let duration = 1000
    server.on('listening', () => {
      resolve(server)
    })
    server.on('error', async (error) => {
      // 系统非监听端口操作报错
      if (error.code !== 'EADDRINUSE') {
        throw error
      }
      if (num <= left) {
        logger.mark(`[Guoba] 端口号 ${port} 已被占用，正在进行第 ${num++} 次重试…`)
        try {
          await Promise.race([
            releasePort(port),
            sleep(8000),
          ]).catch(() => 0)
          await sleep(duration)
        } finally {
          server.listen(port)
        }
      } else {
        reject(`[Guoba] 启动失败，端口号 ${port} 被占用，请尝试关闭该端口或更换锅巴的端口号`)
      }
    })
  })
}

function createServer(app) {
  const ssl = cfg.get('server.ssl') || {}
  const enableSsl = !!ssl.enable

  if (!enableSsl) {
    return http.createServer(app)
  }

  if (isTRSS && cfg.get('server.helloTRSS')) {
    logger.warn('[Guoba] 当前与 TRSS 共享端口，server.ssl.enable 不会生效；请在 TRSS 或反向代理中配置 HTTPS。')
    return http.createServer(app)
  }

  const keyPath = normalizeCertPath(ssl.keyPath)
  const certPath = normalizeCertPath(ssl.certPath)
  if (!keyPath || !certPath) {
    throw new Error('[Guoba] 已启用 HTTPS，但 server.ssl.keyPath 或 server.ssl.certPath 未配置')
  }
  if (!fs.existsSync(keyPath)) {
    throw new Error(`[Guoba] SSL 私钥文件不存在：${keyPath}`)
  }
  if (!fs.existsSync(certPath)) {
    throw new Error(`[Guoba] SSL 证书文件不存在：${certPath}`)
  }

  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }
  const caPath = normalizeCertPath(ssl.caPath)
  if (caPath) {
    if (!fs.existsSync(caPath)) {
      throw new Error(`[Guoba] SSL CA 证书链文件不存在：${caPath}`)
    }
    options.ca = fs.readFileSync(caPath)
  }
  if (ssl.passphrase) {
    options.passphrase = ssl.passphrase
  }

  logger.mark('[Guoba] HTTPS/SSL 已启用')
  return https.createServer(options, app)
}

function normalizeCertPath(filePath) {
  filePath = String(filePath || '').trim()
  if (!filePath) {
    return ''
  }
  return path.isAbsolute(filePath) ? filePath : path.join(_paths.root, filePath)
}

async function releasePort(port) {
  const urlPath = `${_paths.server.realMountPrefix}/api/helper/release_port`
  const httpsAgent = new https.Agent({rejectUnauthorized: false})
  await Promise.any([
    fetch(`http://localhost:${port}${urlPath}`, {method: 'DELETE'}),
    fetch(`https://localhost:${port}${urlPath}`, {method: 'DELETE', agent: httpsAgent}),
  ])
}
