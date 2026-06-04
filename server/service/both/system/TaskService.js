import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'

const MAX_TASKS = 200
const taskStatuses = new Set(['pending', 'running', 'success', 'failed'])

export class TaskService extends Service {
  constructor(app) {
    super(app)
    this.taskDir = path.join(_paths.data, 'guoba', 'tasks')
    this.taskFile = path.join(this.taskDir, 'recent.json')
    this.tasks = []
    this.loaded = false
    this.loadPromise = null
    this.saveQueue = Promise.resolve()
  }

  async create(input = {}) {
    await this.ensureLoaded()
    const now = new Date().toISOString()
    const task = {
      id: crypto.randomUUID(),
      type: String(input.type || 'system.task'),
      title: String(input.title || '系统任务'),
      status: 'pending',
      accountId: String(input.accountId || ''),
      targetType: String(input.targetType || ''),
      targetId: String(input.targetId || ''),
      summary: String(input.summary || ''),
      createdAt: now,
      updatedAt: now,
      startedAt: '',
      finishedAt: '',
      duration: 0,
      result: input.result || null,
      error: '',
    }
    this.tasks.unshift(task)
    this.trim()
    await this.save()
    return task
  }

  async run(task, executor) {
    await this.update(task.id, {
      startedAt: new Date().toISOString(),
      status: 'running',
    })
    const begin = Date.now()
    try {
      const result = await executor(task)
      return await this.update(task.id, {
        duration: Date.now() - begin,
        error: '',
        finishedAt: new Date().toISOString(),
        result: result || null,
        status: 'success',
      })
    } catch (error) {
      return await this.update(task.id, {
        duration: Date.now() - begin,
        error: this.getErrorMessage(error),
        finishedAt: new Date().toISOString(),
        result: null,
        status: 'failed',
      })
    }
  }

  async query(query = {}) {
    await this.ensureLoaded()
    const status = String(query.status || '').trim()
    const type = String(query.type || '').trim()
    const keyword = String(query.keyword || '').trim().toLowerCase()
    let items = [...this.tasks]
    if (status) {
      items = items.filter(item => item.status === status)
    }
    if (type) {
      items = items.filter(item => item.type === type)
    }
    if (keyword) {
      items = items.filter(item => this.matchKeyword(item, keyword))
    }
    return this.pageItems(items, query)
  }

  async get(id) {
    await this.ensureLoaded()
    return this.tasks.find(item => item.id === String(id || '')) || null
  }

  async update(id, patch = {}) {
    await this.ensureLoaded()
    const task = this.tasks.find(item => item.id === String(id || ''))
    if (!task) {
      return null
    }
    const nextStatus = String(patch.status || '')
    Object.assign(task, patch, {
      status: taskStatuses.has(nextStatus) ? nextStatus : task.status,
      updatedAt: new Date().toISOString(),
    })
    await this.save()
    return task
  }

  matchKeyword(item, keyword) {
    return [
      item.id,
      item.title,
      item.type,
      item.accountId,
      item.targetType,
      item.targetId,
      item.summary,
      item.error,
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

  trim() {
    if (this.tasks.length > MAX_TASKS) {
      this.tasks = this.tasks.slice(0, MAX_TASKS)
    }
  }

  async ensureLoaded() {
    if (this.loaded) {
      return
    }
    if (!this.loadPromise) {
      this.loadPromise = this.load()
    }
    await this.loadPromise
  }

  async load() {
    try {
      const text = await fs.promises.readFile(this.taskFile, 'utf8')
      const tasks = JSON.parse(text)
      this.tasks = Array.isArray(tasks) ? tasks.filter(item => item?.id) : []
      this.trim()
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        logger?.warn?.('[Guoba] 任务记录读取失败', error)
      }
      this.tasks = []
    } finally {
      this.loaded = true
    }
  }

  async save() {
    const data = JSON.stringify(this.tasks, null, 2)
    this.saveQueue = this.saveQueue.then(async () => {
      await fs.promises.mkdir(this.taskDir, {recursive: true})
      await fs.promises.writeFile(this.taskFile, data, 'utf8')
    }).catch(error => {
      logger?.warn?.('[Guoba] 任务记录写入失败', error)
    })
    await this.saveQueue
  }

  getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error || '任务执行失败')
  }
}
