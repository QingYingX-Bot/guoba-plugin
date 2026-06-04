import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {GuobaError, Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'
import {runSandboxCode} from './model/sandboxRuntime.js'

const CODE_LIMIT = 50 * 1024
const DEFAULT_DIRS = ['plugins/example', 'data/guoba/sandbox']
const MAX_RECORDS = 200

export class SandboxService extends Service {
  constructor(app) {
    super(app)
    this.rootPath = path.resolve(_paths.root)
    this.rootRealPath = fs.realpathSync(this.rootPath)
    this.sandboxDir = path.join(_paths.data, 'guoba', 'sandbox')
    this.envFile = path.join(this.sandboxDir, 'environments.json')
    this.recordFile = path.join(this.sandboxDir, 'records.json')
    this.environments = []
    this.records = []
    this.loaded = false
    this.saveQueue = Promise.resolve()
  }

  async queryEnvironments() {
    await this.ensureLoaded()
    return this.environments
  }

  async createEnvironment(input = {}) {
    await this.ensureLoaded()
    const now = new Date().toISOString()
    const env = this.normalizeEnvironment(input, {
      id: crypto.randomUUID(),
      createdAt: now,
      enabled: true,
    })
    env.updatedAt = now
    this.environments.unshift(env)
    await this.saveEnvironments()
    return env
  }

  async updateEnvironment(id, input = {}) {
    await this.ensureLoaded()
    const env = this.findEnvironment(id)
    Object.assign(env, this.normalizeEnvironment(input, env), {
      id: env.id,
      createdAt: env.createdAt,
      updatedAt: new Date().toISOString(),
    })
    await this.saveEnvironments()
    return env
  }

  async toggleEnvironment(id, enabled) {
    await this.ensureLoaded()
    const env = this.findEnvironment(id)
    env.enabled = Boolean(enabled)
    env.updatedAt = new Date().toISOString()
    await this.saveEnvironments()
    return env
  }

  async deleteEnvironment(id) {
    await this.ensureLoaded()
    const env = this.findEnvironment(id)
    if (env.locked) {
      throw new GuobaError('默认沙盒环境不能删除')
    }
    this.environments = this.environments.filter(item => item.id !== env.id)
    await this.saveEnvironments()
    return {id: env.id}
  }

  async run(input = {}) {
    await this.ensureLoaded()
    const env = this.findEnvironment(input.environmentId || this.environments[0]?.id)
    if (!env.enabled) {
      throw new GuobaError('沙盒环境已停用')
    }
    const code = String(input.code || '')
    if (!code.trim()) {
      throw new GuobaError('请输入要运行的 JS 代码')
    }
    if (Buffer.byteLength(code, 'utf8') > CODE_LIMIT) {
      throw new GuobaError('代码超过 50KB，暂不支持运行')
    }

    const record = this.createRecord(env, code)
    Object.assign(record, runSandboxCode({
      code,
      env,
      rootPath: this.rootPath,
      rootRealPath: this.rootRealPath,
    }))
    this.records.unshift(record)
    this.trimRecords()
    await this.saveRecords()
    return record
  }

  async queryRecords(query = {}) {
    await this.ensureLoaded()
    const status = String(query.status || '').trim()
    const envId = String(query.environmentId || '').trim()
    const keyword = String(query.keyword || '').trim().toLowerCase()
    let items = [...this.records]
    if (status) {
      items = items.filter(item => item.status === status)
    }
    if (envId) {
      items = items.filter(item => item.environmentId === envId)
    }
    if (keyword) {
      items = items.filter(item => this.matchRecord(item, keyword))
    }
    return this.pageItems(items, query)
  }

  async getRecord(id) {
    await this.ensureLoaded()
    return this.records.find(item => item.id === String(id || '')) || null
  }

  normalizeEnvironment(input = {}, base = {}) {
    return {
      allowedCommands: this.normalizeCommands(input.allowedCommands ?? base.allowedCommands ?? []),
      allowedDirs: this.normalizeDirs(input.allowedDirs ?? base.allowedDirs ?? DEFAULT_DIRS),
      createdAt: base.createdAt || new Date().toISOString(),
      description: String(input.description ?? base.description ?? ''),
      enabled: Boolean(input.enabled ?? base.enabled ?? true),
      id: String(base.id || input.id || crypto.randomUUID()),
      locked: Boolean(base.locked || input.locked),
      maxOutputLength: this.normalizeInt(input.maxOutputLength ?? base.maxOutputLength, 12000, 1000, 100000),
      name: this.normalizeName(input.name ?? base.name ?? '默认沙盒'),
      timeoutMs: this.normalizeInt(input.timeoutMs ?? base.timeoutMs, 3000, 100, 10000),
      updatedAt: base.updatedAt || new Date().toISOString(),
    }
  }

  normalizeDirs(value) {
    const dirs = this.toArray(value).length ? this.toArray(value) : DEFAULT_DIRS
    return [...new Set(dirs.map(dir => this.normalizeDir(dir)))]
  }

  normalizeDir(value) {
    const resolved = path.resolve(this.rootPath, String(value || '').trim())
    this.assertInsideRoot(resolved)
    return path.relative(this.rootPath, resolved).replaceAll('\\', '/') || '.'
  }

  normalizeCommands(value) {
    return [...new Set(this.toArray(value).map(item => String(item).trim()).filter(Boolean))]
      .filter(item => /^[\w.-]+$/.test(item))
      .slice(0, 20)
  }

  normalizeName(value) {
    const name = String(value || '').trim()
    if (!name) {
      throw new GuobaError('沙盒名称不能为空')
    }
    return name.slice(0, 40)
  }

  toArray(value) {
    if (Array.isArray(value)) {
      return value
    }
    return String(value || '').split(/[\n,]/).map(item => item.trim()).filter(Boolean)
  }

  assertInsideRoot(target) {
    const relative = path.relative(this.rootRealPath, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new GuobaError('路径超出云崽根目录')
    }
  }

  findEnvironment(id) {
    const env = this.environments.find(item => item.id === String(id || ''))
    if (!env) {
      throw new GuobaError('沙盒环境不存在')
    }
    return env
  }

  createRecord(env, code) {
    const now = new Date().toISOString()
    return {
      id: crypto.randomUUID(),
      codePreview: code.trim().slice(0, 200),
      duration: 0,
      environmentId: env.id,
      environmentName: env.name,
      error: '',
      finishedAt: '',
      output: '',
      result: '',
      startedAt: now,
      status: 'running',
    }
  }

  matchRecord(item, keyword) {
    return [item.id, item.environmentName, item.codePreview, item.output, item.result, item.error]
      .some(value => String(value || '').toLowerCase().includes(keyword))
  }

  pageItems(items, query = {}) {
    const page = this.normalizeInt(query.page || query.pageNo, 1, 1, 999999)
    const pageSize = this.normalizeInt(query.pageSize, 20, 1, 200)
    const start = (page - 1) * pageSize
    return {items: items.slice(start, start + pageSize), page, pageSize, total: items.length}
  }

  normalizeInt(value, fallback, min, max) {
    const number = Number.parseInt(value, 10)
    return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback
  }

  trimRecords() {
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(0, MAX_RECORDS)
    }
  }

  async ensureLoaded() {
    if (this.loaded) {
      return
    }
    await fs.promises.mkdir(this.sandboxDir, {recursive: true})
    this.environments = await this.readJson(this.envFile, [])
    this.records = await this.readJson(this.recordFile, [])
    if (!this.environments.length) {
      this.environments = [this.normalizeEnvironment({
        description: '默认只允许读取 plugins/example 和沙盒数据目录',
        id: 'default',
        locked: true,
        name: '默认沙盒',
      })]
      await this.saveEnvironments()
    }
    this.trimRecords()
    this.loaded = true
  }

  async readJson(file, fallback) {
    try {
      const data = JSON.parse(await fs.promises.readFile(file, 'utf8'))
      return Array.isArray(data) ? data : fallback
    } catch {
      return fallback
    }
  }

  async saveEnvironments() {
    await this.writeJson(this.envFile, this.environments)
  }

  async saveRecords() {
    await this.writeJson(this.recordFile, this.records)
  }

  async writeJson(file, data) {
    this.saveQueue = this.saveQueue.then(async () => {
      await fs.promises.mkdir(this.sandboxDir, {recursive: true})
      await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
    }).catch(error => logger?.warn?.('[Guoba] 沙盒数据写入失败', error))
    await this.saveQueue
  }
}
