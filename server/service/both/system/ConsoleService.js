import fs from 'fs'
import path from 'path'
import {Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'
import {
  getConsoleStreamHub,
  installConsoleStreamHooks,
  writeConsoleStreamEvent,
} from './model/consoleStreamHub.js'

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g
const MAX_LOG_BYTES = 3 * 1024 * 1024
const MAX_INPUT_CHARS = 500
const LOG_TYPES = new Set(['command', 'error'])

export class ConsoleService extends Service {
  constructor(app) {
    super(app)
    this.hub = getConsoleStreamHub()
    installConsoleStreamHooks(this.hub)
  }

  queryLogs(query = {}) {
    const type = this.normalizeType(query.type)
    const keyword = String(query.keyword || '').trim().toLowerCase()
    const limit = this.normalizeInt(query.limit, 300, 50, 1000)
    const dates = this.getCommandDates()
    const date = type === 'command' ? this.normalizeDate(query.date, dates) : ''
    const filePath = this.getLogFile(type, date)
    const result = this.readLogTail(filePath)
    const lines = this.getVisibleLines(result)
    const items = lines
      .map((line, index) => this.toLineItem(line, index + 1))
      .filter(item => item.content || item.raw)
    const matched = keyword
      ? items.filter(item => this.matchKeyword(item, keyword))
      : items

    return {
      date,
      dates,
      exists: result.exists,
      file: filePath,
      items: matched.slice(-limit),
      limit,
      total: matched.length,
      truncated: result.truncated,
      type,
      updatedAt: result.updatedAt,
    }
  }

  stream(req, res) {
    installConsoleStreamHooks(this.hub)
    this.writeStreamHeaders(res)
    const client = {res}
    this.hub.clients.add(client)

    writeConsoleStreamEvent(res, 'hello', {
      connectedAt: new Date().toISOString(),
      replay: this.hub.buffer,
    })

    const heartbeat = setInterval(() => {
      this.safeWrite(res, ': ping\n\n')
    }, 15000)

    req.on('close', () => {
      clearInterval(heartbeat)
      this.hub.clients.delete(client)
    })
  }

  sendInput(input = {}) {
    const command = this.normalizeCommand(input.command ?? input.input)
    if (!this.isStdinReady()) {
      throw new Error('标准输入未连接')
    }
    process.stdin.emit('data', Buffer.from(`${command}\n`, 'utf8'))
    return {
      command,
      sentAt: new Date().toISOString(),
    }
  }

  writeStreamHeaders(res) {
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
  }

  safeWrite(res, chunk) {
    try {
      res.write(chunk)
    } catch {}
  }

  normalizeCommand(value) {
    const command = String(value ?? '').replace(/\r?\n/g, ' ').trim()
    if (!command) {
      throw new Error('命令不能为空')
    }
    if (command.length > MAX_INPUT_CHARS) {
      throw new Error(`命令不能超过 ${MAX_INPUT_CHARS} 字`)
    }
    return command
  }

  isStdinReady() {
    const bot = globalThis.Bot
    return Boolean(bot?.stdin?.sdk && typeof process.stdin?.emit === 'function')
  }

  normalizeType(type) {
    const value = String(type || 'command').trim()
    return LOG_TYPES.has(value) ? value : 'command'
  }

  normalizeDate(date, dates) {
    const value = String(date || '').trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value
    }
    return dates[0] || this.getLocalDate()
  }

  normalizeInt(value, fallback, min, max) {
    const number = Number.parseInt(value, 10)
    if (!Number.isFinite(number)) {
      return fallback
    }
    return Math.min(Math.max(number, min), max)
  }

  getLogFile(type, date) {
    const logDir = path.join(_paths.root, 'logs')
    if (type === 'error') {
      return path.join(logDir, 'error.log')
    }
    return path.join(logDir, `command.${date}.log`)
  }

  getCommandDates() {
    const logDir = path.join(_paths.root, 'logs')
    try {
      return fs.readdirSync(logDir)
        .map(name => name.match(/^command\.(\d{4}-\d{2}-\d{2})\.log$/)?.[1])
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))
    } catch {
      return []
    }
  }

  readLogTail(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return this.emptyResult(false)
      }
      const stat = fs.statSync(filePath)
      const start = Math.max(0, stat.size - MAX_LOG_BYTES)
      const buffer = Buffer.alloc(stat.size - start)
      const fd = fs.openSync(filePath, 'r')
      try {
        fs.readSync(fd, buffer, 0, buffer.length, start)
      } finally {
        fs.closeSync(fd)
      }
      return {
        content: buffer.toString('utf8'),
        exists: true,
        truncated: start > 0,
        updatedAt: stat.mtime.toISOString(),
      }
    } catch {
      return this.emptyResult(false)
    }
  }

  emptyResult(exists) {
    return {
      content: '',
      exists,
      truncated: false,
      updatedAt: '',
    }
  }

  getVisibleLines(result) {
    const lines = String(result.content || '').replace(ANSI_PATTERN, '').split(/\r?\n/)
    if (result.truncated && lines.length > 0) {
      lines.shift()
    }
    return lines
  }

  toLineItem(line, lineNo) {
    const raw = String(line || '')
    const match = raw.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\[(\w+)\]\s*(.*)$/)
    return {
      content: match ? match[3] : raw,
      id: `${lineNo}:${raw.slice(0, 64)}`,
      level: match ? match[2] : '',
      lineNo,
      raw,
      time: match ? match[1] : '',
    }
  }

  matchKeyword(item, keyword) {
    return [
      item.content,
      item.level,
      item.raw,
      item.time,
    ].some(value => String(value || '').toLowerCase().includes(keyword))
  }

  getLocalDate() {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
    return local.toISOString().slice(0, 10)
  }
}
