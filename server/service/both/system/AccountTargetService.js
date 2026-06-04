import {autowired, Service} from '#guoba.framework'

export class AccountTargetService extends Service {
  accountService = autowired('accountService')

  async listFriends(uin, query = {}) {
    const bot = this.accountService.getBotByUin(uin)
    const items = await this.collectFriends(bot)
    return this.pageItems(this.filterItems(items.map(item => this.normalizeFriend(item)), query), query)
  }

  async listGroups(uin, query = {}) {
    const bot = this.accountService.getBotByUin(uin)
    const items = await this.collectGroups(bot)
    return this.pageItems(this.filterItems(items.map(item => this.normalizeGroup(item)), query), query)
  }

  async collectFriends(bot) {
    if (!bot) {
      return []
    }
    try {
      if (typeof bot.getFriendArray === 'function') {
        const list = await bot.getFriendArray()
        if (Array.isArray(list)) {
          return list
        }
      }
    } catch {}
    if (bot.fl instanceof Map) {
      return [...bot.fl.values()]
    }
    return this.toArray(bot.fl || bot.friendList)
  }

  async collectGroups(bot) {
    if (!bot) {
      return []
    }
    try {
      if (typeof bot.getGroupArray === 'function') {
        const list = await bot.getGroupArray()
        if (Array.isArray(list)) {
          return list
        }
      }
    } catch {}
    if (bot.gl instanceof Map) {
      return [...bot.gl.values()]
    }
    return this.toArray(bot.gl || bot.groupList)
  }

  toArray(value) {
    if (!value) {
      return []
    }
    if (Array.isArray(value)) {
      return value
    }
    if (value instanceof Map) {
      return [...value.values()]
    }
    if (typeof value === 'object') {
      return Object.values(value)
    }
    return []
  }

  normalizeFriend(item) {
    const userId = item?.user_id ?? item?.userId ?? item?.uin ?? item?.id ?? ''
    return {
      id: String(userId),
      name: String(item?.nickname || item?.remark || item?.name || userId || ''),
      remark: String(item?.remark || ''),
    }
  }

  normalizeGroup(item) {
    const groupId = item?.group_id ?? item?.groupId ?? item?.guild_id ?? item?.id ?? ''
    return {
      id: String(groupId),
      name: String(item?.group_name || item?.name || groupId || ''),
      memberCount: Number(item?.member_count || item?.memberCount || 0),
    }
  }

  filterItems(items, query = {}) {
    const keyword = String(query.keyword || query.query || '').trim().toLowerCase()
    if (!keyword) {
      return items
    }
    return items.filter(item => {
      return String(item.id || '').toLowerCase().includes(keyword)
        || String(item.name || '').toLowerCase().includes(keyword)
        || String(item.remark || '').toLowerCase().includes(keyword)
    })
  }

  pageItems(items, query = {}) {
    const page = this.normalizeInt(query.page || query.pageNo, 1, 1, 999999)
    const pageSize = this.normalizeInt(query.pageSize, 20, 1, 200)
    const total = items.length
    const start = (page - 1) * pageSize
    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    }
  }

  normalizeInt(value, fallback, min, max) {
    const number = Number.parseInt(value, 10)
    if (!Number.isFinite(number)) {
      return fallback
    }
    return Math.min(Math.max(number, min), max)
  }
}
