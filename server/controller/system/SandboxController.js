import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'
import {summarizeSandboxChat} from '../../service/both/system/model/sandboxChat.js'

export class SandboxController extends ApiController {
  auditService = autowired('auditService')
  sandboxConversationService = autowired('sandboxConversationService')
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
    this.post('/code/run', this.runCode)
    this.post('/run', this.runCode)
    this.get('/conversations', this.queryConversations)
    this.post('/conversations', this.createConversation)
    this.get('/conversations/:id', this.getConversation)
    this.delete('/conversations/:id', this.deleteConversation)
    this.post('/conversations/:id/messages', this.sendConversationMessage)
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

  async queryConversations() {
    return Result.ok(await this.sandboxConversationService.queryConversations())
  }

  async createConversation(req) {
    const {chat = {}, environmentId = '', title = ''} = req.body || {}
    return await this.withAudit(req, 'sandbox.conversation.create', environmentId, {
      chat: summarizeSandboxChat(chat),
      environmentId,
      title,
    }, async () => {
      return await this.sandboxConversationService.createConversation({chat, environmentId, title})
    })
  }

  async getConversation(req) {
    const record = await this.sandboxConversationService.getConversation(req.params.id)
    if (!record) {
      return Result.error('沙盒会话不存在')
    }
    return Result.ok(record)
  }

  async deleteConversation(req) {
    const id = req.params.id
    return await this.withAudit(req, 'sandbox.conversation.delete', id, {id}, async () => {
      return await this.sandboxConversationService.deleteConversation(id)
    })
  }

  async sendConversationMessage(req) {
    const id = req.params.id
    const {chat = {}, environmentId = '', message = ''} = req.body || {}
    return await this.withAudit(req, 'sandbox.conversation.message', id, {
      chat: summarizeSandboxChat({...chat, message}),
      environmentId,
      messageLength: String(message || chat.message || '').length,
    }, async () => {
      return await this.sandboxConversationService.sendMessage(id, {chat, environmentId, message})
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
