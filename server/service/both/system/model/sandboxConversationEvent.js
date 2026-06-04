import {normalizeSandboxChat} from './sandboxChat.js'
import {createSandboxMessage} from './sandboxValue.js'

export function createSandboxConversationEvent({appendMessage, chat, conversationId}) {
  const data = normalizeSandboxChat(chat)
  const selfId = toEventId(data.selfId)
  const userId = toEventId(data.userId)
  const groupId = toEventId(data.groupId)
  const reply = async (content, quote = false, meta = {}) => {
    const message = createSandboxMessage({
      content,
      meta: {
        messageId: `sandbox-reply-${Date.now()}`,
        quote: Boolean(quote),
        ...meta,
      },
      role: 'bot',
    })
    appendMessage(message)
    return {message_id: message.meta.messageId, messageId: message.meta.messageId}
  }
  const bot = createMockBot({data, reply, selfId})
  const event = {
    atBot: data.atBot,
    bot,
    font: 0,
    isGroup: data.messageType === 'group',
    isMaster: data.isMaster,
    isPrivate: data.messageType === 'private',
    message: createMessageArray(data),
    message_id: `sandbox-input-${Date.now()}`,
    message_type: data.messageType,
    nickname: data.senderName,
    post_type: 'message',
    raw_message: data.rawMessage || data.message,
    reply,
    self_id: selfId,
    sender: {
      card: data.senderName,
      nickname: data.senderName,
      role: data.isMaster ? 'owner' : 'member',
      user_id: userId,
    },
    sub_type: data.messageType === 'group' ? 'normal' : 'friend',
    time: Math.floor(Date.now() / 1000),
    user_id: userId,
    _guobaSandbox: true,
    _guobaSandboxConversationId: conversationId,
  }
  if (data.messageType === 'group') {
    event.group_id = groupId
    event.group_name = data.groupName
    event.group = createGroup({data, groupId, reply, userId})
    event.member = createMember({data, groupId, reply, userId})
  } else {
    event.friend = createFriend({data, reply, userId})
  }
  return event
}

function createMessageArray(data) {
  const items = []
  if (data.atBot) items.push({qq: data.selfId, type: 'at'})
  items.push({text: data.message, type: 'text'})
  return items
}

function createMockBot({data, reply, selfId}) {
  return {
    adapter: {id: 'guoba-sandbox', name: 'Guoba Sandbox'},
    fl: new Map(),
    gl: new Map(),
    gml: new Map(),
    pickFriend: userId => createFriend({data, reply, userId: toEventId(userId)}),
    pickGroup: groupId => createGroup({data, groupId: toEventId(groupId), reply}),
    pickMember: (groupId, userId) => createMember({
      data,
      groupId: toEventId(groupId),
      reply,
      userId: toEventId(userId),
    }),
    self_id: selfId,
    uin: selfId,
  }
}

function createFriend({data, reply, userId}) {
  return {
    getInfo: () => ({nickname: data.senderName, user_id: userId}),
    name: data.senderName,
    nickname: data.senderName,
    sendMsg: reply,
    user_id: userId,
  }
}

function createGroup({data, groupId, reply}) {
  return {
    getInfo: () => ({group_id: groupId, group_name: data.groupName}),
    group_id: groupId,
    group_name: data.groupName,
    name: data.groupName,
    pickMember: userId => createMember({data, groupId, reply, userId: toEventId(userId)}),
    sendMsg: reply,
  }
}

function createMember({data, groupId, reply, userId}) {
  return {
    card: data.senderName,
    group_id: groupId,
    is_admin: data.isMaster,
    is_owner: data.isMaster,
    nickname: data.senderName,
    role: data.isMaster ? 'owner' : 'member',
    sendMsg: reply,
    user_id: userId,
  }
}

function toEventId(value) {
  const text = String(value || '')
  if (!/^\d+$/.test(text)) return text
  const number = Number(text)
  return Number.isSafeInteger(number) ? number : text
}
