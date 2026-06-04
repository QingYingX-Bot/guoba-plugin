import fs from 'fs'
import path from 'path'
import {GuobaError, Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'
import loader from '../../../../../../lib/plugins/loader.js'
import {parseJsPluginSource} from './model/jsPluginParser.js'

const PLUGIN_FILE_PATTERN = /\.(js|js\.disabled|js\.exa)$/i
const TEXT_LIMIT = 1024 * 1024

export class JsPluginService extends Service {
  constructor(app) {
    super(app)
    this.pluginsRoot = path.resolve(_paths.root, 'plugins')
    this.pluginsRealRoot = fs.realpathSync(this.pluginsRoot)
  }

  query(query = {}) {
    const keyword = String(query.keyword || '').trim().toLowerCase()
    const status = String(query.status || '').trim()
    let items = this.scan()

    if (status) {
      items = items.filter(item => item.status === status)
    }
    if (keyword) {
      items = items.filter(item => this.matchKeyword(item, keyword))
    }
    return this.pageItems(items, query)
  }

  detail(filePath) {
    const resolved = this.resolvePluginFile(filePath)
    const stat = fs.statSync(resolved)
    if (stat.size > TEXT_LIMIT) {
      throw new GuobaError('文件超过 1MB，暂不支持查看')
    }
    const content = fs.readFileSync(resolved, 'utf8')
    return {
      ...this.toItem(resolved, stat, content),
      content,
    }
  }

  toggle(filePath, enabled) {
    const resolved = this.resolvePluginFile(filePath)
    const current = this.toItem(resolved, fs.statSync(resolved))
    const nextPath = enabled
      ? this.getEnabledPath(resolved, current.status)
      : this.getDisabledPath(resolved, current.status)
    if (fs.existsSync(nextPath)) {
      throw new GuobaError('目标文件已存在')
    }
    fs.renameSync(resolved, nextPath)
    if (!enabled) {
      this.unloadRuntime(current.loaderKey)
    }
    return this.toItem(nextPath, fs.statSync(nextPath))
  }

  copyExample(filePath, targetName = '') {
    const resolved = this.resolvePluginFile(filePath)
    const item = this.toItem(resolved, fs.statSync(resolved))
    if (item.status !== 'template') {
      throw new GuobaError('只能复制 .js.exa 示例文件')
    }
    const name = this.normalizeTargetName(targetName || path.basename(resolved).replace(/\.exa$/i, ''))
    const target = this.resolveChild(path.dirname(resolved), name)
    if (fs.existsSync(target)) {
      throw new GuobaError('目标文件已存在')
    }
    fs.copyFileSync(resolved, target)
    return this.toItem(target, fs.statSync(target))
  }

  async reload(filePath) {
    const resolved = this.resolvePluginFile(filePath)
    const item = this.toItem(resolved, fs.statSync(resolved))
    if (item.status !== 'enabled') {
      throw new GuobaError('只能热重载已启用的 JS 插件')
    }
    this.unloadRuntime(item.loaderKey)
    await loader.importPlugin({
      name: item.loaderKey,
      path: `../../plugins/${item.sourceKey}?${Date.now()}`,
    })
    if (Array.isArray(loader.priority)) {
      loader.priority.sort((a, b) => Number(a?.priority || 0) - Number(b?.priority || 0))
    }
    return {
      loaderKey: item.loaderKey,
      path: item.path,
      reloadedAt: new Date().toISOString(),
    }
  }

  scan() {
    const items = []
    for (const pluginFolder of this.readDirNames(this.pluginsRoot)) {
      const pluginPath = path.join(this.pluginsRoot, pluginFolder)
      if (!fs.statSync(pluginPath).isDirectory()) {
        continue
      }
      items.push(...this.scanDir(pluginPath, pluginFolder, ''))
      items.push(...this.scanDir(path.join(pluginPath, 'apps'), pluginFolder, 'apps'))
    }
    return items.sort((a, b) => a.pluginFolder.localeCompare(b.pluginFolder, 'zh-CN')
      || a.moduleFile.localeCompare(b.moduleFile, 'zh-CN'))
  }

  scanDir(dirPath, pluginFolder, basePath) {
    if (!fs.existsSync(dirPath)) {
      return []
    }
    return this.readDirNames(dirPath)
      .filter(name => PLUGIN_FILE_PATTERN.test(name))
      .map(name => {
        const filePath = path.join(dirPath, name)
        return this.toItem(filePath, fs.statSync(filePath), this.tryReadPreview(filePath))
      })
      .filter(item => item.pluginFolder === pluginFolder && item.moduleFile.startsWith(basePath))
  }

  toItem(filePath, stat, content = null) {
    const relativePath = path.relative(this.pluginsRoot, filePath).replaceAll('\\', '/')
    const parts = relativePath.split('/').filter(Boolean)
    const pluginFolder = parts[0] || ''
    const moduleFile = parts.slice(1).join('/')
    const status = this.getStatus(filePath)
    const sourceKey = this.getSourceKey(pluginFolder, moduleFile, status)
    const parsed = content == null ? {} : parseJsPluginSource(content)
    return {
      ...parsed,
      enabled: status === 'enabled',
      extension: this.getExtension(filePath),
      loaderKey: this.getLoaderKey(pluginFolder, moduleFile),
      loaded: status === 'enabled' && this.isLoaded(this.getLoaderKey(pluginFolder, moduleFile)),
      modifiedAt: stat.mtime.toISOString(),
      moduleFile,
      name: parsed.name || path.basename(filePath),
      path: filePath,
      pluginFolder,
      relativePath,
      size: stat.size,
      sourceKey,
      status,
    }
  }

  tryReadPreview(filePath) {
    try {
      const stat = fs.statSync(filePath)
      if (stat.size > TEXT_LIMIT) {
        return ''
      }
      return fs.readFileSync(filePath, 'utf8')
    } catch {
      return ''
    }
  }

  readDirNames(dirPath) {
    try {
      return fs.readdirSync(dirPath)
    } catch {
      return []
    }
  }

  resolvePluginFile(filePath) {
    const resolved = path.resolve(String(filePath || ''))
    this.assertPathInside(resolved)
    if (!PLUGIN_FILE_PATTERN.test(path.basename(resolved))) {
      throw new GuobaError('只支持 JS 插件文件')
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new GuobaError('文件不存在')
    }
    this.assertPathInside(fs.realpathSync(resolved))
    return resolved
  }

  resolveChild(parent, name) {
    const resolved = path.resolve(parent, name)
    this.assertPathInside(resolved)
    return resolved
  }

  assertPathInside(target) {
    const relative = path.relative(this.pluginsRealRoot, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new GuobaError('路径超出插件目录')
    }
  }

  getStatus(filePath) {
    const name = path.basename(filePath).toLowerCase()
    if (name.endsWith('.js.disabled')) {
      return 'disabled'
    }
    if (name.endsWith('.js.exa')) {
      return 'template'
    }
    return 'enabled'
  }

  getExtension(filePath) {
    const name = path.basename(filePath).toLowerCase()
    if (name.endsWith('.js.disabled')) {
      return '.js.disabled'
    }
    if (name.endsWith('.js.exa')) {
      return '.js.exa'
    }
    return '.js'
  }

  getEnabledPath(filePath, status) {
    if (status !== 'disabled') {
      throw new GuobaError('当前文件不能启用')
    }
    return filePath.replace(/\.disabled$/i, '')
  }

  getDisabledPath(filePath, status) {
    if (status !== 'enabled') {
      throw new GuobaError('当前文件不能禁用')
    }
    return `${filePath}.disabled`
  }

  normalizeTargetName(value) {
    const name = String(value || '').trim()
    if (!/^[^/\\]+\.js$/i.test(name)) {
      throw new GuobaError('目标文件名必须以 .js 结尾')
    }
    return name
  }

  getSourceKey(pluginFolder, moduleFile, status) {
    const cleanModule = moduleFile.replace(/\.disabled$/i, '').replace(/\.exa$/i, '')
    return [pluginFolder, cleanModule].filter(Boolean).join('/')
  }

  getLoaderKey(pluginFolder, moduleFile) {
    return moduleFile === 'index.js' ? pluginFolder : `${pluginFolder}/${moduleFile}`
  }

  isLoaded(loaderKey) {
    return Array.isArray(loader.priority) && loader.priority.some(item => item?.key === loaderKey)
  }

  unloadRuntime(loaderKey) {
    if (Array.isArray(loader.priority)) {
      loader.priority = loader.priority.filter(item => item?.key !== loaderKey)
    }
  }

  matchKeyword(item, keyword) {
    return [
      item.pluginFolder,
      item.moduleFile,
      item.name,
      item.dsc,
      item.event,
      item.relativePath,
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
      page,
      pageSize,
      total,
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
