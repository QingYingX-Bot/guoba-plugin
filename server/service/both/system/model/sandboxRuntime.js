import fs from 'fs'
import path from 'path'
import {spawnSync} from 'child_process'
import vm from 'vm'
import GuobaError from '../../../../../framework/src/components/GuobaError.js'
import {normalizeSandboxChat} from './sandboxChat.js'

export function runSandboxCode({chat = {}, code, env, rootPath, rootRealPath}) {
  const begin = Date.now()
  const output = []
  const replies = []
  const event = createMockEvent(normalizeSandboxChat(chat), replies)
  const appendOutput = (...args) => {
    output.push(stringifyLog(args))
    while (output.join('\n').length > env.maxOutputLength) {
      output.shift()
    }
  }

  try {
    const context = vm.createContext(createContext({
      appendOutput,
      env,
      event,
      rootPath,
      rootRealPath,
    }))
    const script = new vm.Script(`(function () {\n${code}\n})()`, {
      displayErrors: true,
      filename: `guoba-sandbox-${env.id}.js`,
    })
    const result = script.runInContext(context, {
      displayErrors: true,
      timeout: env.timeoutMs,
    })
    return {
      duration: Date.now() - begin,
      error: '',
      finishedAt: new Date().toISOString(),
      output: output.join('\n'),
      replies,
      result: stringifyResult(result),
      status: 'success',
    }
  } catch (error) {
    return {
      duration: Date.now() - begin,
      error: error?.stack || error?.message || String(error),
      finishedAt: new Date().toISOString(),
      output: output.join('\n'),
      replies,
      result: '',
      status: 'failed',
    }
  }
}

function createContext({appendOutput, env, event, rootPath, rootRealPath}) {
  return {
    console: {
      debug: appendOutput,
      error: appendOutput,
      info: appendOutput,
      log: appendOutput,
      warn: appendOutput,
    },
    e: event,
    sandbox: {
      env: publicEnvironment(env),
      event,
      exec: (command, args = []) => execCommand({args, command, env, rootPath}),
      fs: {
        list: dirPath => listSandboxPath({dirPath, env, rootPath, rootRealPath}),
        readText: filePath => readSandboxText({env, filePath, rootPath, rootRealPath}),
      },
      log: appendOutput,
    },
  }
}

function execCommand({args = [], command, env, rootPath}) {
  const cmd = String(command || '').trim()
  if (!env.allowedCommands.includes(cmd)) {
    throw new GuobaError(`命令未加入 allowlist：${cmd}`)
  }
  if (!/^[\w.-]+$/.test(cmd)) {
    throw new GuobaError('命令名称不合法')
  }
  const normalizedArgs = normalizeArgs(args)
  const result = spawnSync(cmd, normalizedArgs, {
    cwd: rootPath,
    encoding: 'utf8',
    maxBuffer: env.maxOutputLength,
    shell: false,
    timeout: env.timeoutMs,
  })
  return {
    args: normalizedArgs,
    command: cmd,
    error: result.error?.message || '',
    signal: result.signal || '',
    status: result.status ?? null,
    stderr: truncate(result.stderr || '', env.maxOutputLength),
    stdout: truncate(result.stdout || '', env.maxOutputLength),
  }
}

function listSandboxPath({dirPath = '.', env, rootPath, rootRealPath}) {
  const resolved = resolveAllowedPath({env, rootPath, rootRealPath, value: dirPath})
  const stat = fs.statSync(resolved)
  if (!stat.isDirectory()) {
    throw new GuobaError('路径不是目录')
  }
  return fs.readdirSync(resolved).map(name => {
    const itemPath = path.join(resolved, name)
    const itemStat = fs.statSync(itemPath)
    return {
      isDirectory: itemStat.isDirectory(),
      name,
      relativePath: path.relative(rootPath, itemPath).replaceAll('\\', '/'),
      size: itemStat.size,
    }
  })
}

function readSandboxText({env, filePath, rootPath, rootRealPath}) {
  const resolved = resolveAllowedPath({env, rootPath, rootRealPath, value: filePath})
  const stat = fs.statSync(resolved)
  if (!stat.isFile()) {
    throw new GuobaError('只能读取文件')
  }
  if (stat.size > 1024 * 1024) {
    throw new GuobaError('文件超过 1MB')
  }
  return fs.readFileSync(resolved, 'utf8')
}

function resolveAllowedPath({env, rootPath, rootRealPath, value}) {
  const target = path.resolve(rootPath, String(value || '.'))
  const realTarget = fs.realpathSync(target)
  const allowed = env.allowedDirs.some(dir => {
    const realDir = resolveExistingDir({dir, rootPath, rootRealPath})
    const relative = path.relative(realDir, realTarget)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
  })
  if (!allowed) {
    throw new GuobaError('路径超出沙盒允许目录')
  }
  return realTarget
}

function resolveExistingDir({dir, rootPath, rootRealPath}) {
  const resolved = path.resolve(rootPath, dir)
  const real = fs.realpathSync(resolved)
  const relative = path.relative(rootRealPath, real)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new GuobaError('路径超出云崽根目录')
  }
  return real
}

function normalizeArgs(value) {
  const args = Array.isArray(value) ? value : []
  return args.slice(0, 20).map(item => String(item).slice(0, 200))
}

function createMockEvent(chat, replies) {
  const selfId = toEventId(chat.selfId)
  const userId = toEventId(chat.userId)
  const groupId = toEventId(chat.groupId)
  const event = {
    atBot: chat.atBot,
    bot: {self_id: selfId, uin: selfId},
    isGroup: chat.messageType === 'group',
    isMaster: chat.isMaster,
    isPrivate: chat.messageType === 'private',
    message: chat.message,
    message_type: chat.messageType,
    msg: chat.message,
    nickname: chat.senderName,
    post_type: 'message',
    raw_message: chat.rawMessage,
    reply: (content, quote = false) => {
      if (replies.length >= 100) {
        throw new GuobaError('模拟回复超过 100 条')
      }
      const item = {
        content: truncate(stringifyResult(content), 2000),
        createdAt: new Date().toISOString(),
        messageId: `sandbox-reply-${replies.length + 1}`,
        quote: Boolean(quote),
      }
      replies.push(item)
      return {message_id: item.messageId, messageId: item.messageId}
    },
    self_id: selfId,
    sender: {
      card: chat.senderName,
      nickname: chat.senderName,
      role: 'member',
      user_id: userId,
    },
    sub_type: chat.messageType === 'group' ? 'normal' : 'friend',
    time: Math.floor(Date.now() / 1000),
    user_id: userId,
  }
  if (chat.messageType === 'group') {
    event.group_id = groupId
    event.group_name = chat.groupName
    event.group = {group_id: groupId, name: chat.groupName, sendMsg: event.reply}
  } else {
    event.friend = {nickname: chat.senderName, sendMsg: event.reply, user_id: userId}
  }
  return event
}

function toEventId(value) {
  const text = String(value || '')
  if (!/^\d+$/.test(text)) {
    return text
  }
  const number = Number(text)
  return Number.isSafeInteger(number) ? number : text
}

function publicEnvironment(env) {
  const {id, name, allowedDirs, allowedCommands, timeoutMs, maxOutputLength} = env
  return {id, name, allowedDirs, allowedCommands, timeoutMs, maxOutputLength}
}

function stringifyLog(args) {
  return args.map(item => stringifyResult(item)).join(' ')
}

function stringifyResult(value) {
  if (value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function truncate(value, limit) {
  const text = String(value || '')
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}
