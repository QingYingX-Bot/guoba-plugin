import fs from 'fs'
import path from 'path'
import {Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'
import loader from '../../../../../../lib/plugins/loader.js'

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g
const MAX_LOG_BYTES = 3 * 1024 * 1024

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

  queryRecords(query = {}) {
    const keyword = String(query.keyword || '').trim().toLowerCase()
    const status = String(query.status || '').trim()
    let items = this.getTaskRecords()

    if (status) {
      items = items.filter(item => item.status === status)
    }
    if (keyword) {
      items = items.filter(item => this.matchRecordKeyword(item, keyword))
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

  getTaskRecords() {
    return this.getCommandLogFiles()
      .flatMap(file => this.parseTaskLogFile(file))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getCommandLogFiles() {
    const logDir = path.join(_paths.root, 'logs')
    try {
      return fs.readdirSync(logDir)
        .filter(name => /^command\.\d{4}-\d{2}-\d{2}\.log$/.test(name))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 3)
        .map(name => path.join(logDir, name))
    } catch {
      return []
    }
  }

  parseTaskLogFile(filePath) {
    const date = path.basename(filePath).match(/^command\.(\d{4}-\d{2}-\d{2})\.log$/)?.[1] || ''
    if (!date) {
      return []
    }
    return this.readLogTail(filePath)
      .split(/\r?\n/)
      .map((line, index) => this.parseTaskLogLine(line, date, index))
      .filter(Boolean)
  }

  readLogTail(filePath) {
    try {
      const stat = fs.statSync(filePath)
      const start = Math.max(0, stat.size - MAX_LOG_BYTES)
      const buffer = Buffer.alloc(stat.size - start)
      const fd = fs.openSync(filePath, 'r')
      try {
        fs.readSync(fd, buffer, 0, buffer.length, start)
      } finally {
        fs.closeSync(fd)
      }
      return buffer.toString('utf8')
    } catch {
      return ''
    }
  }

  parseTaskLogLine(line, date, index) {
    const text = String(line || '').replace(ANSI_PATTERN, '')
    const match = text.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\].*?\[\s*TASK\s*\]\s+(.+)$/)
    if (!match) {
      return null
    }
    const fields = this.parseTaskLogFields(match[2])
    if (!fields.plugin || !fields.name || !fields.status) {
      return null
    }
    const status = this.getRecordStatus(fields.status)
    const createdAt = `${date}T${match[1]}`
    return {
      id: `${createdAt}:${fields.plugin}:${fields.name}:${index}`,
      cost: fields.cost || '',
      createdAt,
      cron: fields.cron || '',
      pluginId: fields.plugin,
      status,
      statusText: fields.status,
      taskName: fields.name,
    }
  }

  parseTaskLogFields(text) {
    return String(text || '').split(/\s+\|\s+/).reduce((fields, part) => {
      const match = part.match(/^([^:]+):\s*(.*)$/)
      if (match) {
        fields[String(match[1]).trim().toLowerCase()] = String(match[2] || '').trim()
      }
      return fields
    }, {})
  }

  getRecordStatus(statusText) {
    if (statusText === '完成') {
      return 'success'
    }
    if (statusText === '开始处理') {
      return 'running'
    }
    return 'unknown'
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

  matchRecordKeyword(item, keyword) {
    return [
      item.pluginId,
      item.taskName,
      item.cron,
      item.status,
      item.statusText,
      item.cost,
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
