import {autowired, Service} from '#guoba.framework'

const targetTypeMap = {
  friend: 'private',
  group: 'group',
  private: 'private',
  user: 'private',
}

export class MessageService extends Service {
  accountService = autowired('accountService')
  taskService = autowired('taskService')

  async sendText(input = {}) {
    const payload = this.normalizePayload(input)
    const task = await this.taskService.create({
      accountId: payload.accountId,
      summary: this.getSummary(payload),
      targetId: payload.targetId,
      targetType: payload.targetType,
      title: '代发消息',
      type: 'message.send',
    })
    const done = await this.taskService.run(task, async () => {
      const sendResult = await this.dispatchText(payload)
      return {
        dryRun: payload.dryRun,
        messageId: this.extractMessageId(sendResult),
      }
    })
    return this.toSendResult(done)
  }

  normalizePayload(input) {
    const accountId = String(input.accountId || input.userId || input.uin || '').trim()
    const targetType = targetTypeMap[String(input.targetType || '').trim()] || ''
    const targetId = String(input.targetId || input.userId || input.groupId || '').trim()
    const content = String(input.content ?? '')
    if (!accountId) {
      throw new Error('账号不能为空')
    }
    if (!targetType) {
      throw new Error('目标类型必须是 private 或 group')
    }
    if (!targetId) {
      throw new Error('目标ID不能为空')
    }
    if (!content.trim()) {
      throw new Error('消息内容不能为空')
    }
    if (content.length > 2000) {
      throw new Error('消息内容不能超过 2000 字')
    }
    return {
      accountId,
      content,
      dryRun: input.dryRun === true || input.dryRun === 'true',
      targetId,
      targetType,
    }
  }

  async dispatchText(payload) {
    const bot = this.accountService.getBotByUin(payload.accountId)
    if (!bot) {
      throw new Error('账号不在线或不存在')
    }
    if (payload.dryRun) {
      return {dryRun: true}
    }
    const target = this.pickTarget(bot, payload)
    if (typeof target?.sendMsg === 'function') {
      return await target.sendMsg(payload.content)
    }
    return await this.sendByGlobalBot(payload)
  }

  pickTarget(bot, payload) {
    const targetId = this.toAdapterTargetId(payload.targetId)
    if (payload.targetType === 'group') {
      return this.callPicker(bot.pickGroup, bot, targetId)
    }
    return this.callPicker(bot.pickUser, bot, targetId)
      || this.callPicker(bot.pickFriend, bot, targetId)
  }

  callPicker(picker, thisArg, targetId) {
    if (typeof picker !== 'function') {
      return null
    }
    try {
      return picker.call(thisArg, targetId)
    } catch {
      return null
    }
  }

  async sendByGlobalBot(payload) {
    const targetId = this.toAdapterTargetId(payload.targetId)
    if (payload.targetType === 'group') {
      if (typeof Bot?.sendGroupMsg === 'function') {
        return await Bot.sendGroupMsg(payload.accountId, targetId, payload.content)
      }
      throw new Error('当前账号不支持群聊发送')
    }
    if (typeof Bot?.sendFriendMsg === 'function') {
      return await Bot.sendFriendMsg(payload.accountId, targetId, payload.content)
    }
    if (typeof Bot?.sendPrivateMsg === 'function') {
      return await Bot.sendPrivateMsg(payload.accountId, targetId, payload.content)
    }
    throw new Error('当前账号不支持私聊发送')
  }

  toAdapterTargetId(targetId) {
    const value = String(targetId || '').trim()
    if (/^\d{1,15}$/.test(value)) {
      return Number(value)
    }
    return value
  }

  extractMessageId(result) {
    if (Array.isArray(result)) {
      return result.map(item => this.extractMessageId(item)).find(Boolean) || ''
    }
    if (!result || typeof result !== 'object') {
      return typeof result === 'number' || typeof result === 'string' ? String(result) : ''
    }
    const id = result.message_id ?? result.messageId ?? result.id
    if (id) {
      return String(id)
    }
    return this.extractMessageId(result.data || result.result)
  }

  getSummary(payload) {
    const label = payload.targetType === 'group' ? '群聊' : '私聊'
    return `${label} ${payload.targetId}，文本 ${payload.content.length} 字`
  }

  toSendResult(task) {
    return {
      accountId: task.accountId,
      error: task.error || '',
      messageId: task.result?.messageId || '',
      status: task.status,
      targetId: task.targetId,
      targetType: task.targetType,
      taskId: task.id,
    }
  }
}
