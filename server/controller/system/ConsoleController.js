import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class ConsoleController extends ApiController {
  auditService = autowired('auditService')
  consoleService = autowired('consoleService')

  constructor(guobaApp) {
    super('/console', guobaApp)
  }

  registerRouters() {
    this.get('/logs', this.queryLogs)
    this.get('/stream', this.stream)
    this.post('/input', this.sendInput)
  }

  queryLogs(req) {
    return Result.ok(this.consoleService.queryLogs(req.query || {}))
  }

  stream(req, res) {
    this.consoleService.stream(req, res)
    return Result.VOID
  }

  async sendInput(req) {
    const begin = Date.now()
    const params = this.getInputAuditParams(req.body || {})
    try {
      const data = this.consoleService.sendInput(req.body || {})
      await this.auditService.record(req, 'console.input', 'stdin', {
        duration: Date.now() - begin,
        params,
        result: 'success',
      })
      return Result.ok(data, '命令已发送')
    } catch (error) {
      await this.auditService.record(req, 'console.input', 'stdin', {
        duration: Date.now() - begin,
        params,
        result: 'failed',
      })
      return Result.error(`命令发送失败：${error?.message || error}`)
    }
  }

  getInputAuditParams(body) {
    const command = String(body.command ?? body.input ?? '')
    return {
      commandLength: command.length,
    }
  }
}
