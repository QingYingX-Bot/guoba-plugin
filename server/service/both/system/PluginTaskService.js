import fs from 'fs'
import path from 'path'
import {Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'
import loader from '../../../../../../lib/plugins/loader.js'

export class PluginTaskService extends Service {
  query(query = {}) {
    const keyword = String(query.keyword || '').trim().toLowerCase()
    const status = String(query.status || '').trim()
    let items = this.getTasks()

    if (status) {
      items = items.filter(item => item.status === status)
    }
    if (keyword) {
      items = items.filter(item => this.matchKeyword(item, keyword))
    }

    return this.pageItems(items, query)
  }

  getTasks() {
    const tasks = Array.isArray(loader.task) ? loader.task : []
    return tasks.map((task, index) => this.toItem(task, index)).sort((a, b) => {
      const pluginCompare = a.pluginId.localeCompare(b.pluginId, 'zh-CN')
      if (pluginCompare !== 0) {
        return pluginCompare
      }
      return a.taskName.localeCompare(b.taskName, 'zh-CN') || a.cron.localeCompare(b.cron)
    })
  }

  toItem(task, index) {
    const pluginId = this.getPluginId(task)
    const meta = this.getPluginMeta(pluginId)
    return {
      id: `${pluginId}:${task?.name || 'task'}:${task?.cron || ''}:${index}`,
      cron: String(task?.cron || ''),
      functionName: this.getFunctionName(task?.fnc),
      log: task?.log !== false,
      nextRunAt: this.getNextRunAt(task?.job),
      pluginDescription: meta.description,
      pluginId,
      pluginName: meta.packageName,
      status: task?.job ? 'scheduled' : 'inactive',
      taskName: String(task?.name || '未命名任务'),
    }
  }

  getPluginId(task) {
    const pluginId = String(task?.pluginID || '').trim()
    if (pluginId) {
      return pluginId
    }
    const name = String(task?.name || '').replace(/\\/g, '/')
    return name.split('/').filter(Boolean)[0] || 'unknown'
  }

  getFunctionName(fnc) {
    if (typeof fnc === 'string') {
      return fnc
    }
    if (typeof fnc === 'function') {
      return fnc.name || ''
    }
    return ''
  }

  getNextRunAt(job) {
    try {
      const invocation = typeof job?.nextInvocation === 'function' ? job.nextInvocation() : null
      if (!invocation) {
        return ''
      }
      const date = typeof invocation.toDate === 'function' ? invocation.toDate() : new Date(invocation)
      return Number.isNaN(date.getTime()) ? '' : date.toISOString()
    } catch {
      return ''
    }
  }

  getPluginMeta(pluginId) {
    const fallback = {
      description: '',
      packageName: pluginId || 'unknown',
    }
    const packagePath = path.join(_paths.root, 'plugins', pluginId, 'package.json')
    if (!pluginId || !fs.existsSync(packagePath)) {
      return fallback
    }
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      return {
        description: String(pkg.description || ''),
        packageName: String(pkg.name || pluginId),
      }
    } catch {
      return fallback
    }
  }

  matchKeyword(item, keyword) {
    return [
      item.pluginId,
      item.pluginName,
      item.pluginDescription,
      item.taskName,
      item.cron,
      item.functionName,
      item.status,
    ].some(value => String(value || '').toLowerCase().includes(keyword))
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
