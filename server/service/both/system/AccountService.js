import jwt from 'jsonwebtoken'
import chalk from 'chalk'
import {Service} from '#guoba.framework'
import {cfg, Constant} from '#guoba.platform'

const forcedOfflineAccounts = new Set()

export class AccountService extends Service {
  async queryAccounts(req) {
    const preferredUin = this.getPreferredUinFromReq(req)
    const list = await this.listAccounts(preferredUin)
    return this.pageItems(this.filterAccounts(list, req?.query || {}), req?.query || {})
  }

  async listAccounts(preferredUin = '') {
    const uinList = this.getUinList()
    const currentUin = this.resolveCurrentUin(preferredUin, uinList)
    return Promise.all(uinList.map((uin, index) => this.resolveAccountItem(uin, index, currentUin)))
  }

  async getCurrentAccount(preferredUin = '') {
    const uinList = this.getUinList()
    const currentUin = this.resolveCurrentUin(preferredUin, uinList) || uinList[0]
    if (!currentUin) {
      return {userId: '-', username: '-', realName: '-', platform: ''}
    }
    const bot = this.getBotByUin(currentUin)
    const displayName = String(cfg.get('login.displayName') || '').trim()
    return {
      userId: currentUin,
      username: currentUin,
      realName: displayName || this.getNickname(bot, currentUin),
      platform: this.getPlatformLabel(currentUin, bot?.adapter || {}),
    }
  }

  async getAccount(uin) {
    const account = await this.resolveAccountItem(uin, 0, this.getCurrentUin())
    return {
      ...account,
      capabilities: this.getCapabilities(uin),
      diagnostics: this.getDiagnostics(uin),
    }
  }

  async resolveAccountItem(uin, index, currentUin) {
    const bot = this.getBotByUin(uin)
    const adapter = bot?.adapter || {}
    const status = this.resolveBotStatus(uin, bot)
    return {
      index: index + 1,
      userId: String(uin || ''),
      username: String(uin || ''),
      realName: this.getNickname(bot, uin),
      current: String(uin) === String(currentUin),
      adapterId: adapter?.id ? String(adapter.id) : '',
      adapterName: adapter?.name ? String(adapter.name) : '',
      platform: this.getPlatformLabel(uin, adapter),
      onlineDuration: this.getOnlineDuration(bot),
      friendCount: await this.getFriendCount(bot),
      groupCount: await this.getGroupCount(bot),
      homePath: '/home',
      status,
      canEnable: this.canEnable(bot, status),
      canDisable: this.canDisable(bot, status),
    }
  }

  async setAccountStatus(userId, action) {
    const uin = String(userId || '').trim()
    const nextAction = String(action || '').trim()
    logger.mark(`[Guoba] 账号状态切换请求: ${chalk.cyan(uin || '-')} -> ${nextAction}`)
    if (!uin) {
      throw new Error('userId不能为空')
    }
    if (!['enable', 'disable'].includes(nextAction)) {
      throw new Error('action必须是 enable 或 disable')
    }
    const bot = this.getBotByUin(uin)
    if (!bot) {
      if (nextAction === 'disable') {
        forcedOfflineAccounts.add(uin)
        return {userId: uin, status: 'offline'}
      }
      throw new Error('账号不在线或暂不支持上线操作')
    }
    if (nextAction === 'enable') {
      await this.enableBot(uin, bot)
    } else {
      await this.disableBot(uin, bot)
    }
    return {userId: uin, status: this.resolveBotStatus(uin, bot)}
  }

  async enableBot(uin, bot) {
    if (typeof bot.login === 'function') {
      await bot.login()
      forcedOfflineAccounts.delete(uin)
      return
    }
    if (typeof bot?.adapter?.connectWebSocket === 'function') {
      await bot.adapter.connectWebSocket()
      forcedOfflineAccounts.delete(uin)
      return
    }
    throw new Error('该账号暂不支持上线操作')
  }

  async disableBot(uin, bot) {
    if (typeof bot.logout === 'function') {
      await bot.logout()
      forcedOfflineAccounts.add(uin)
      return
    }
    if (typeof bot.ws?.close === 'function') {
      bot.ws.close()
      forcedOfflineAccounts.add(uin)
      return
    }
    throw new Error('该账号暂不支持下线操作')
  }

  getCapabilities(uin) {
    const bot = this.getBotByUin(uin)
    return {
      canManageStatus: !!bot,
      canReconnect: typeof bot?.adapter?.connectWebSocket === 'function',
      canSendPrivate: typeof bot?.pickUser === 'function' || !!bot?.fl,
      canSendGroup: typeof bot?.pickGroup === 'function' || !!bot?.gl,
      canReadContacts: !!bot,
    }
  }

  getDiagnostics(uin) {
    const bot = this.getBotByUin(uin)
    const adapter = bot?.adapter || {}
    return {
      exists: !!bot,
      wsReadyState: bot?.ws?.readyState ?? null,
      hasLogin: typeof bot?.login === 'function',
      hasLogout: typeof bot?.logout === 'function',
      hasReconnect: typeof adapter?.connectWebSocket === 'function',
      adapterId: adapter?.id ? String(adapter.id) : '',
      adapterName: adapter?.name ? String(adapter.name) : '',
    }
  }

  getPreferredUinFromReq(req) {
    return String(this.getTokenPayload(req)?.sourceBotUin || '').trim()
  }

  getTokenPayload(req) {
    try {
      const token = this.getTokenFromReq(req)
      if (!token) {
        return {}
      }
      try {
        return jwt.verify(token, cfg.getJwtSecret()) || {}
      } catch {
        return jwt.decode(token) || {}
      }
    } catch {
      return {}
    }
  }

  getTokenFromReq(req) {
    const tokenHeader = req?.headers?.[Constant.TOKEN_KEY]
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader
    return String(token || req?.query?.token || '').replace(/^Bearer\s+/i, '').trim()
  }

  getCurrentUin() {
    try {
      if (typeof Bot?.uin?.toJSON === 'function') {
        return String(Bot.uin.toJSON() || '')
      }
      return String(Bot?.uin || '')
    } catch {
      return ''
    }
  }

  getUinList() {
    const raw = Array.isArray(Bot?.uin) ? [...Bot.uin] : (Bot?.uin ? [Bot.uin] : [])
    return raw.map(item => String(item || '').trim()).filter(Boolean)
  }

  resolveCurrentUin(preferredUin, uinList) {
    const preferred = String(preferredUin || '')
    return preferred && uinList.some(item => String(item) === preferred)
      ? preferred
      : this.getCurrentUin()
  }

  getBotByUin(uin) {
    return Bot?.bots?.[uin] || Bot?.[uin]
  }

  resolveBotStatus(uin, bot) {
    if (forcedOfflineAccounts.has(String(uin || '')) || !bot) {
      return 'offline'
    }
    const wsReadyState = bot?.ws?.readyState
    if (typeof wsReadyState === 'number') {
      return wsReadyState === 1 ? 'online' : 'offline'
    }
    if (typeof bot?.isOnline === 'function') {
      try {
        return bot.isOnline() ? 'online' : 'offline'
      } catch {}
    }
    return bot?.isOnline === false ? 'offline' : 'online'
  }

  canEnable(bot, status) {
    return status === 'offline' && (typeof bot?.login === 'function' || typeof bot?.adapter?.connectWebSocket === 'function')
  }

  canDisable(bot, status) {
    return status === 'online' && (typeof bot?.logout === 'function' || typeof bot?.ws?.close === 'function')
  }

  getNickname(bot, fallbackUin) {
    return String(bot?.nickname || bot?.info?.nickname || bot?.name || fallbackUin || '')
  }

  getPlatformLabel(uin, adapter) {
    const adapterId = String(adapter?.id || '').toLowerCase()
    if (String(uin).startsWith('dc_') || adapterId === 'discord') {
      return 'Discord'
    }
    return String(adapter?.name || adapter?.id || '未知')
  }

  getOnlineDuration(bot) {
    const startTime = bot?.stat?.start_time
    if (!startTime) {
      return ''
    }
    const ms = startTime > 1e12 ? startTime : startTime * 1000
    return typeof Bot?.getTimeDiff === 'function' ? Bot.getTimeDiff(ms) : ''
  }

  async getFriendCount(bot) {
    if (!bot) {
      return 0
    }
    try {
      if (typeof bot.getFriendArray === 'function') {
        const arr = await bot.getFriendArray()
        return Array.isArray(arr) ? arr.length : 0
      }
    } catch {}
    return bot.fl instanceof Map ? bot.fl.size : 0
  }

  async getGroupCount(bot) {
    if (!bot) {
      return 0
    }
    try {
      if (typeof bot.getGroupArray === 'function') {
        const arr = await bot.getGroupArray()
        return Array.isArray(arr) ? arr.length : 0
      }
    } catch {}
    return bot.gl instanceof Map ? bot.gl.size : 0
  }

  filterAccounts(items, query) {
    const keyword = String(query.keyword || '').trim().toLowerCase()
    if (!keyword) {
      return items
    }
    return items.filter(item => [item.userId, item.realName, item.platform]
      .some(value => String(value || '').toLowerCase().includes(keyword)))
  }

  pageItems(items, query = {}) {
    const page = this.normalizeInt(query.page || query.pageNo, 1, 1, 999999)
    const pageSize = this.normalizeInt(query.pageSize, 20, 1, 200)
    return {items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize}
  }

  normalizeInt(value, fallback, min, max) {
    const number = Number.parseInt(value, 10)
    return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback
  }

}
