import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {autowired, GuobaError, Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'
import PluginsLoader from '../../../../../../lib/plugins/loader.js'
import {normalizeSandboxChat} from './model/sandboxChat.js'
import {createSandboxConversationEvent} from './model/sandboxConversationEvent.js'
import {runSandboxConversationScope} from './model/sandboxConversationScope.js'
import {createSandboxMessage} from './model/sandboxValue.js'

const MAX_SESSIONS = 50
const MAX_MESSAGES = 300

export class SandboxConversationService extends Service {
  sandboxService = autowired('sandboxService')

  constructor(app) {
    super(app)
    this.sandboxDir = path.join(_paths.data, 'guoba', 'sandbox')
    this.sessionFile = path.join(this.sandboxDir, 'sessions.json')
    this.sessions = []
    this.loaded = false
    this.saveQueue = Promise.resolve()
  }

  async queryConversations() {
    await this.ensureLoaded()
    return this.sessions.map(item => ({...item, messages: item.messages.slice(-30)}))
  }

  async getConversation(id) {
    await this.ensureLoaded()
    return this.sessions.find(item => item.id === String(id || '')) || null
  }

  async createConversation(input = {}) {
    await this.ensureLoaded()
    const env = await this.resolveEnvironment(input.environmentId)
    const chat = normalizeSandboxChat(input.chat || {})
    const now = new Date().toISOString()
    const session = {
      chat,
      createdAt: now,
      environmentId: env.id,
      environmentName: env.name,
      id: crypto.randomUUID(),
      messages: [],
      title: String(input.title || `${chat.messageType === 'group' ? '群聊' : '私聊'}沙盒`).slice(0, 40),
      updatedAt: now,
    }
    this.sessions.unshift(session)
    this.trimSessions()
    await this.saveSessions()
    return session
  }

  async deleteConversation(id) {
    await this.ensureLoaded()
    this.sessions = this.sessions.filter(item => item.id !== String(id || ''))
    await this.saveSessions()
    return {id}
  }

  async sendMessage(id, input = {}) {
    await this.ensureLoaded()
    const session = await this.requireConversation(id || input.conversationId)
    const env = await this.resolveEnvironment(input.environmentId || session.environmentId)
    this.assertEnabled(env)
    const chat = normalizeSandboxChat({...session.chat, ...input.chat, message: input.message ?? input.chat?.message})
    if (!chat.message) throw new GuobaError('请输入沙盒消息')
    session.chat = chat
    session.environmentId = env.id
    session.environmentName = env.name
    const begin = Date.now()
    const appended = []
    this.append(session, createSandboxMessage({content: chat.message, role: 'user'}), appended)
    const event = createSandboxConversationEvent({
      appendMessage: item => this.append(session, item, appended),
      chat,
      conversationId: session.id,
    })
    const record = this.createRecord({chat, env, session, startedAt: new Date().toISOString()})
    await this.dispatchWithTimeout({appended, env, event, record, session})
    record.duration = Date.now() - begin
    record.finishedAt = new Date().toISOString()
    record.output = record.logs.map(item => item.content).join('\n')
    this.trimMessages(session)
    session.updatedAt = record.finishedAt
    await this.saveSessions()
    await this.sandboxService.appendRecord(record)
    return {conversation: session, messages: appended, record}
  }

  async dispatchWithTimeout({appended, env, event, record, session}) {
    try {
      await runSandboxConversationScope({
        appendMessage: item => this.append(session, item, appended),
      }, async () => {
        await Promise.race([
          PluginsLoader.deal(event),
          new Promise((_, reject) => setTimeout(() => reject(new GuobaError('沙盒对话执行超时')), env.timeoutMs)),
        ])
      })
      record.status = 'success'
      record.exitCode = 0
    } catch (error) {
      const message = error?.stack || error?.message || String(error)
      record.error = message
      record.status = message.includes('执行超时') ? 'timeout' : 'failed'
      record.exitCode = 1
      this.append(session, createSandboxMessage({content: message, level: 'error', role: 'log', type: 'log'}), appended)
    }
    record.logs = appended.filter(item => item.role === 'log')
    record.replies = appended.filter(item => item.role === 'bot').map(item => ({
      content: item.content,
      createdAt: item.createdAt,
      messageId: item.meta?.messageId || item.id,
      quote: Boolean(item.meta?.quote),
    }))
  }

  createRecord({chat, env, session, startedAt}) {
    return {
      chat,
      codePreview: chat.message.slice(0, 200),
      duration: 0,
      environmentId: env.id,
      environmentName: env.name,
      error: '',
      exitCode: null,
      finishedAt: '',
      id: crypto.randomUUID(),
      logs: [],
      mode: 'chat',
      output: '',
      replies: [],
      result: '',
      sessionId: session.id,
      startedAt,
      status: 'running',
    }
  }

  append(session, message, appended = []) {
    session.messages.push(message)
    appended.push(message)
    return message
  }

  async resolveEnvironment(id) {
    await this.sandboxService.ensureLoaded()
    const env = this.sandboxService.findEnvironment(id || this.sandboxService.environments[0]?.id)
    return env
  }

  assertEnabled(env) {
    if (!env.enabled) throw new GuobaError('沙盒环境已停用')
  }

  async requireConversation(id) {
    const session = this.sessions.find(item => item.id === String(id || ''))
    if (!session) throw new GuobaError('沙盒会话不存在')
    return session
  }

  trimSessions() {
    if (this.sessions.length > MAX_SESSIONS) this.sessions = this.sessions.slice(0, MAX_SESSIONS)
  }

  trimMessages(session) {
    if (session.messages.length > MAX_MESSAGES) session.messages = session.messages.slice(-MAX_MESSAGES)
  }

  async ensureLoaded() {
    if (this.loaded) return
    await fs.promises.mkdir(this.sandboxDir, {recursive: true})
    this.sessions = await this.readJson(this.sessionFile, [])
    this.trimSessions()
    this.loaded = true
  }

  async readJson(file, fallback) {
    try {
      const data = JSON.parse(await fs.promises.readFile(file, 'utf8'))
      return Array.isArray(data) ? data : fallback
    } catch {
      return fallback
    }
  }

  async saveSessions() {
    this.saveQueue = this.saveQueue.then(async () => {
      await fs.promises.mkdir(this.sandboxDir, {recursive: true})
      await fs.promises.writeFile(this.sessionFile, JSON.stringify(this.sessions, null, 2), 'utf8')
    }).catch(error => logger?.warn?.('[Guoba] 沙盒会话写入失败', error))
    await this.saveQueue
  }
}
