const CHAT_TYPES = new Set(['group', 'private'])

export function normalizeSandboxChat(input = {}) {
  const messageType = CHAT_TYPES.has(input.messageType) ? input.messageType : 'group'
  const message = trimText(input.message ?? input.msg ?? '#锅巴沙盒测试', 2000)
  return {
    atBot: Boolean(input.atBot),
    groupId: messageType === 'group' ? trimText(input.groupId ?? input.group_id ?? '10000', 40) : '',
    groupName: trimText(input.groupName ?? input.group_name ?? '锅巴测试群', 40),
    isMaster: Boolean(input.isMaster),
    message,
    messageType,
    rawMessage: trimText(input.rawMessage ?? input.raw_message ?? message, 2000),
    selfId: trimText(input.selfId ?? input.self_id ?? '10000', 40),
    senderName: trimText(input.senderName ?? input.nickname ?? '测试用户', 40),
    userId: trimText(input.userId ?? input.user_id ?? '10001', 40),
  }
}

export function summarizeSandboxChat(input = {}) {
  const chat = normalizeSandboxChat(input)
  return {
    groupId: chat.groupId,
    messageLength: chat.message.length,
    messageType: chat.messageType,
    selfId: chat.selfId,
    userId: chat.userId,
  }
}

function trimText(value, limit) {
  return String(value ?? '').trim().slice(0, limit)
}
