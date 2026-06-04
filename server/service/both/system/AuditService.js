import fs from 'fs'
import path from 'path'
import {Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'

export class AuditService extends Service {
  constructor(app) {
    super(app)
    this.auditDir = path.join(_paths.data, 'guoba', 'audit')
  }

  async record(req, action, target, payload = {}) {
    if (!action) {
      return
    }
    const item = {
      time: new Date().toISOString(),
      actor: this.getActor(req),
      ip: this.getIp(req),
      action,
      target: String(target || ''),
      botUin: String(payload.botUin || ''),
      paramsDigest: this.digest(payload.params),
      result: payload.result || 'unknown',
      duration: Number(payload.duration || 0),
      taskId: String(payload.taskId || ''),
    }
    try {
      await this.append(item)
    } catch (error) {
      logger?.warn?.('[Guoba] 审计日志写入失败', error)
    }
  }

  getActor(req) {
    try {
      const user = req?.decodeToken?.()
      return String(user?.username || user?.sourceBotUin || 'admin')
    } catch {
      return 'admin'
    }
  }

  getIp(req) {
    return String(req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || '')
  }

  digest(params) {
    if (!params || typeof params !== 'object') {
      return params ?? null
    }
    const picked = {}
    for (const key of Object.keys(params)) {
      const value = params[key]
      if (typeof value === 'string') {
        picked[key] = value.length > 200 ? `${value.slice(0, 200)}...` : value
      } else if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
        picked[key] = value
      } else if (Array.isArray(value)) {
        picked[key] = `[array:${value.length}]`
      } else {
        picked[key] = '[object]'
      }
    }
    return picked
  }

  async append(item) {
    await fs.promises.mkdir(this.auditDir, {recursive: true})
    const file = path.join(this.auditDir, `${item.time.slice(0, 10)}.jsonl`)
    await fs.promises.appendFile(file, `${JSON.stringify(item)}\n`, 'utf8')
  }
}
