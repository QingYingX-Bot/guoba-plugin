export async function createStdinInputSender() {
  const sdk = globalThis.Bot?.stdin?.sdk
  if (sdk?.emit && hasListener(sdk, 'line')) {
    return command => sdk.emit('line', command)
  }

  const adapter = getStdinAdapter()
  if (adapter?.message) {
    await ensureStdinBot(adapter)
    return command => adapter.message(command)
  }

  if (process.stdin?.emit && hasListener(process.stdin, 'data')) {
    return command => process.stdin.emit('data', Buffer.from(`${command}\n`, 'utf8'))
  }

  return null
}

function getStdinAdapter() {
  const adapters = globalThis.Bot?.adapter
  if (!Array.isArray(adapters)) {
    return null
  }
  return adapters.find(adapter => adapter?.id === 'stdin') || null
}

async function ensureStdinBot(adapter) {
  const bot = globalThis.Bot
  if (!bot) {
    return
  }
  if (!bot.stdin?.pickFriend) {
    bot.stdin = createStdinBot(adapter)
  }
  if (adapter?.path && typeof bot.mkdir === 'function') {
    await bot.mkdir(adapter.path)
  }
}

function createStdinBot(adapter) {
  const id = 'stdin'
  const name = adapter?.name || '标准输入'
  const target = adapter?.pickFriend?.() || createStdinTarget(adapter, name)
  const bot = {
    adapter,
    fl: new Map().set(id, {
      group_id: id,
      group_name: name,
      nickname: name,
      user_id: id,
    }),
    get gl() {
      return this.fl
    },
    gml: new Map(),
    nickname: name,
    pickFriend: () => target,
    get pickGroup() {
      return this.pickFriend
    },
    get pickMember() {
      return this.pickFriend
    },
    get pickUser() {
      return this.pickFriend
    },
    get stat() {
      return globalThis.Bot?.stat
    },
    uin: id,
    version: {id, name},
  }
  bot.gml.set(id, bot.fl)
  return bot
}

function createStdinTarget(adapter, name) {
  return {
    group_id: 'stdin',
    group_name: name,
    nickname: name,
    pickMember() {
      return this
    },
    recallMsg: messageId => adapter?.recallMsg?.(messageId) || false,
    sendFile: (file, fileName) => adapter?.sendFile?.(file, fileName) || false,
    sendMsg: msg => adapter?.sendMsg?.(msg) || false,
    user_id: 'stdin',
  }
}

function hasListener(emitter, event) {
  return typeof emitter.listenerCount !== 'function' || emitter.listenerCount(event) > 0
}
