import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class MessageController extends ApiController {
  auditService = autowired('auditService')
  messageService = autowired('messageService')

  constructor(guobaApp) {
    super('/messages', guobaApp)
  }

  registerRouters() {
    this.post('/send', this.sendText)
  }

  async sendText(req) {
    const begin = Date.now()
    const params = this.getAuditParams(req.body || {})
    try {
      const data = await this.messageService.sendText(req.body || {})
      await this.auditService.record(req, 'message.send', this.getTarget(data, params), {
        botUin: data.accountId || params.accountId,
        duration: Date.now() - begin,
        params,
        result: data.status === 'success' ? 'success' : 'failed',
        taskId: data.taskId,
      })
      if (data.status === 'failed') {
        return Result.error(`消息发送失败：${data.error || '发送失败'}`, data)
      }
      return Result.ok(data, '消息已发送')
    } catch (error) {
      await this.auditService.record(req, 'message.send', this.getTarget(null, params), {
        botUin: params.accountId,
        duration: Date.now() - begin,
        params,
        result: 'failed',
      })
      return Result.error(`消息发送失败：${error?.message || error}`)
    }
  }

  getAuditParams(body) {
    const content = String(body.content ?? '')
    return {
      accountId: String(body.accountId || body.userId || body.uin || '').trim(),
      contentLength: content.length,
      dryRun: body.dryRun === true || body.dryRun === 'true',
      targetId: String(body.targetId || body.userId || body.groupId || '').trim(),
      targetType: String(body.targetType || '').trim(),
    }
  }

  getTarget(data, params) {
    const targetType = data?.targetType || params.targetType || ''
    const targetId = data?.targetId || params.targetId || ''
    return targetType || targetId ? `${targetType}:${targetId}` : ''
  }
}
