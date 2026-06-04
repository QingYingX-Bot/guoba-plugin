import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'
import {summarizeSandboxChat} from '../../service/both/system/model/sandboxChat.js'

export class SandboxController extends ApiController {
  auditService = autowired('auditService')
  sandboxService = autowired('sandboxService')

  constructor(guobaApp) {
    super('/sandbox', guobaApp)
  }

  registerRouters() {
    this.get('/environments', this.queryEnvironments)
    this.post('/environments', this.createEnvironment)
    this.put('/environments/:id', this.updateEnvironment)
    this.delete('/environments/:id', this.deleteEnvironment)
    this.post('/environments/:id/toggle', this.toggleEnvironment)
    this.post('/run', this.runCode)
    this.get('/records', this.queryRecords)
    this.get('/records/:id', this.getRecord)
  }

  async queryEnvironments() {
    return Result.ok(await this.sandboxService.queryEnvironments())
  }

  async createEnvironment(req) {
    return await this.withAudit(req, 'sandbox.environment.create', '', req.body || {}, async () => {
      return await this.sandboxService.createEnvironment(req.body || {})
    })
  }

  async updateEnvironment(req) {
    const id = req.params.id
    return await this.withAudit(req, 'sandbox.environment.update', id, req.body || {}, async () => {
      return await this.sandboxService.updateEnvironment(id, req.body || {})
    })
  }

  async deleteEnvironment(req) {
    const id = req.params.id
    return await this.withAudit(req, 'sandbox.environment.delete', id, {id}, async () => {
      return await this.sandboxService.deleteEnvironment(id)
    })
  }

  async toggleEnvironment(req) {
    const id = req.params.id
    const {enabled} = req.body || {}
    return await this.withAudit(req, 'sandbox.environment.toggle', id, {enabled, id}, async () => {
      return await this.sandboxService.toggleEnvironment(id, Boolean(enabled))
    })
  }

  async runCode(req) {
    const {chat = {}, code = '', environmentId = ''} = req.body || {}
    const chatSummary = summarizeSandboxChat(chat)
    return await this.withAudit(req, 'sandbox.run', environmentId, {
      chat: chatSummary,
      codeLength: String(code || '').length,
      environmentId,
    }, async () => {
      return await this.sandboxService.run({chat, code, environmentId})
    })
  }

  async queryRecords(req) {
    return Result.ok(await this.sandboxService.queryRecords(req.query || {}))
  }

  async getRecord(req) {
    const record = await this.sandboxService.getRecord(req.params.id)
    if (!record) {
      return Result.error('运行记录不存在')
    }
    return Result.ok(record)
  }

  async withAudit(req, action, target, params, executor) {
    const begin = Date.now()
    try {
      const data = await executor()
      await this.auditService.record(req, action, target, {
        duration: Date.now() - begin,
        params,
        result: 'success',
      })
      return Result.ok(data)
    } catch (error) {
      await this.auditService.record(req, action, target, {
        duration: Date.now() - begin,
        params,
        result: 'failed',
      })
      return Result.error(error?.message || String(error))
    }
  }
}
