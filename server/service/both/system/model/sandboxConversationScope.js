import {AsyncLocalStorage} from 'node:async_hooks'
import {createSandboxMessage, stringifySandboxValue} from './sandboxValue.js'

const storage = new AsyncLocalStorage()
let botOriginals = null
const loggerOriginals = new Map()
const consoleOriginals = new Map()
const LOG_LEVELS = ['debug', 'error', 'fatal', 'info', 'mark', 'trace', 'warn']

export async function runSandboxConversationScope(store, executor) {
  installSandboxConversationHooks()
  return await storage.run(store, executor)
}

export function installSandboxConversationHooks() {
  installBotHooks()
  installLoggerHooks()
  installConsoleHooks()
}

function installBotHooks() {
  const bot = globalThis.Bot
  if (!bot || botOriginals) return
  botOriginals = {
    makeLog: bindOriginal(bot, 'makeLog'),
    pickFriend: bindOriginal(bot, 'pickFriend'),
    pickGroup: bindOriginal(bot, 'pickGroup'),
    pickMember: bindOriginal(bot, 'pickMember'),
    sendFriendMsg: bindOriginal(bot, 'sendFriendMsg'),
    sendGroupMsg: bindOriginal(bot, 'sendGroupMsg'),
    sendMasterMsg: bindOriginal(bot, 'sendMasterMsg'),
  }
  bot.makeLog = (level, message, id, force) => {
    const store = storage.getStore()
    if (!store) return botOriginals.makeLog?.(level, message, id, force)
    appendLog(store, level, message, {force, id})
  }
  bot.sendGroupMsg = (botId, groupId, ...args) => {
    const store = storage.getStore()
    if (!store) return botOriginals.sendGroupMsg?.(botId, groupId, ...args)
    return appendBotSend('group', groupId, args.length > 1 ? args : args[0])
  }
  bot.sendFriendMsg = (botId, userId, ...args) => {
    const store = storage.getStore()
    if (!store) return botOriginals.sendFriendMsg?.(botId, userId, ...args)
    return appendBotSend('private', userId, args.length > 1 ? args : args[0])
  }
  bot.sendMasterMsg = (message, ...args) => {
    const store = storage.getStore()
    if (!store) return botOriginals.sendMasterMsg?.(message, ...args)
    return appendBotSend('master', '', message)
  }
  bot.pickGroup = (groupId, strict) => {
    const store = storage.getStore()
    if (!store) return botOriginals.pickGroup?.(groupId, strict)
    return pickChannel('group', groupId)
  }
  bot.pickFriend = (userId, strict) => {
    const store = storage.getStore()
    if (!store) return botOriginals.pickFriend?.(userId, strict)
    return pickChannel('private', userId)
  }
  bot.pickMember = (groupId, userId) => {
    const store = storage.getStore()
    if (!store) return botOriginals.pickMember?.(groupId, userId)
    return {
      ...pickChannel('private', userId),
      group_id: groupId,
      is_admin: true,
      is_owner: true,
    }
  }
}

function installLoggerHooks() {
  const logger = globalThis.logger
  if (!logger || loggerOriginals.size) return
  for (const level of LOG_LEVELS) {
    wrapLoggerMethod(logger, level)
    if (logger.logger) wrapLoggerMethod(logger.logger, level)
  }
}

function installConsoleHooks() {
  if (consoleOriginals.size) return
  for (const level of ['debug', 'error', 'info', 'log', 'warn']) {
    const original = console[level]?.bind(console)
    if (!original) continue
    consoleOriginals.set(level, original)
    console[level] = (...args) => {
      const store = storage.getStore()
      if (!store) return original(...args)
      appendLog(store, level, args)
    }
  }
}

function bindOriginal(target, key) {
  return typeof target[key] === 'function' ? target[key].bind(target) : null
}

function wrapLoggerMethod(target, level) {
  if (typeof target[level] !== 'function') return
  const key = `${level}:${loggerOriginals.size}`
  const original = target[level].bind(target)
  loggerOriginals.set(key, original)
  target[level] = (...args) => {
    const store = storage.getStore()
    if (!store) return original(...args)
    appendLog(store, level, args)
  }
}

function appendBotSend(kind, targetId, message) {
  const store = storage.getStore()
  if (!store) {
    if (kind === 'group') return botOriginals.sendGroupMsg?.('', targetId, message)
    if (kind === 'private') return botOriginals.sendFriendMsg?.('', targetId, message)
    return botOriginals.sendMasterMsg?.(message)
  }
  const item = createSandboxMessage({
    content: message,
    meta: {kind, targetId},
    role: 'bot',
  })
  store.appendMessage(item)
  return {message_id: item.id, messageId: item.id}
}

function pickChannel(kind, targetId) {
  const store = storage.getStore()
  if (!store) {
    if (kind === 'group') return botOriginals.pickGroup?.(targetId)
    return botOriginals.pickFriend?.(targetId)
  }
  return {
    getInfo: () => ({id: targetId, name: `sandbox-${targetId}`}),
    group_id: kind === 'group' ? targetId : undefined,
    name: `sandbox-${targetId}`,
    nickname: `sandbox-${targetId}`,
    pickMember: userId => pickChannel('private', userId),
    sendMsg: message => appendBotSend(kind, targetId, message),
    user_id: kind === 'private' ? targetId : undefined,
  }
}

function appendLog(store, level, message, meta = {}) {
  store.appendMessage(createSandboxMessage({
    content: stringifySandboxValue(message),
    level: String(level || 'info'),
    meta,
    role: 'log',
    type: 'log',
  }))
}
