import fs from 'fs'
import path from 'path'
import {GuobaError, Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'

const MAX_TEXT_SIZE = 1024 * 1024
const textExtensions = new Set([
  '.conf', '.css', '.csv', '.env', '.gitignore', '.html', '.ini', '.js', '.json',
  '.jsx', '.log', '.md', '.mjs', '.sh', '.ts', '.tsx', '.txt', '.vue', '.xml',
  '.yaml', '.yml',
])

export class FileManagerService extends Service {
  constructor(app) {
    super(app)
    this.rootPath = path.resolve(_paths.root)
    this.rootRealPath = fs.realpathSync(this.rootPath)
  }

  getRoots() {
    const roots = [
      {key: 'root', title: '云崽根目录', path: _paths.root},
      {key: 'plugins', title: '插件目录', path: path.join(_paths.root, 'plugins')},
      {key: 'data', title: '数据目录', path: _paths.data},
      {key: 'resources', title: '资源目录', path: _paths.resources},
      {key: 'guoba', title: '锅巴插件', path: _paths.pluginRoot},
    ]
    return roots
      .map(item => ({...item, path: this.resolvePath(item.path)}))
      .filter(item => this.existsInside(item.path))
  }

  async list(query = {}) {
    const current = this.resolvePath(query.path || this.rootPath)
    const stat = await this.getStat(current)
    if (!stat.isDirectory()) {
      throw new GuobaError('路径不是目录')
    }
    const names = await fs.promises.readdir(current)
    const items = []
    for (const name of names) {
      const itemPath = path.join(current, name)
      try {
        items.push(this.toItem(itemPath, await this.getStat(itemPath)))
      } catch {}
    }
    items.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory)
      || a.name.localeCompare(b.name, 'zh-CN'))
    return {
      current: this.toDirectory(current),
      items,
      parent: this.getParent(current),
      roots: this.getRoots(),
    }
  }

  async read(filePath) {
    const resolved = this.resolvePath(filePath)
    const stat = await this.getStat(resolved)
    if (!stat.isFile()) {
      throw new GuobaError('只能读取文件')
    }
    if (stat.size > MAX_TEXT_SIZE) {
      throw new GuobaError('文件超过 1MB，暂不支持在线编辑')
    }
    const buffer = await fs.promises.readFile(resolved)
    if (this.isBinary(buffer)) {
      throw new GuobaError('当前文件不是文本文件')
    }
    return {
      ...this.toItem(resolved, stat),
      content: buffer.toString('utf8'),
      encoding: 'utf8',
    }
  }

  async write(filePath, content = '') {
    const resolved = this.resolvePath(filePath)
    const text = String(content ?? '')
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_SIZE) {
      throw new GuobaError('文件内容超过 1MB，暂不支持保存')
    }
    if (fs.existsSync(resolved)) {
      const stat = await this.getStat(resolved)
      if (!stat.isFile()) {
        throw new GuobaError('只能保存文件')
      }
    }
    await this.ensureParent(resolved)
    await fs.promises.writeFile(resolved, text, 'utf8')
    return this.toItem(resolved, await fs.promises.stat(resolved))
  }

  async mkdir(parentPath, name) {
    const parent = this.resolvePath(parentPath || this.rootPath)
    const dirName = this.normalizeName(name)
    const target = this.resolveChild(parent, dirName)
    const parentStat = await this.getStat(parent)
    if (!parentStat.isDirectory()) {
      throw new GuobaError('父路径不是目录')
    }
    if (fs.existsSync(target)) {
      throw new GuobaError('目录已存在')
    }
    await fs.promises.mkdir(target)
    return this.toItem(target, await fs.promises.stat(target))
  }

  async rename(filePath, name) {
    const resolved = this.resolvePath(filePath)
    const nextName = this.normalizeName(name)
    const target = this.resolveChild(path.dirname(resolved), nextName)
    await this.getStat(resolved)
    await this.ensureParent(target)
    if (resolved === target) {
      return this.toItem(resolved, await fs.promises.stat(resolved))
    }
    if (fs.existsSync(target)) {
      throw new GuobaError('目标名称已存在')
    }
    await fs.promises.rename(resolved, target)
    return this.toItem(target, await fs.promises.stat(target))
  }

  async remove(filePath) {
    const resolved = this.resolvePath(filePath)
    if (resolved === this.rootPath) {
      throw new GuobaError('不能删除云崽根目录')
    }
    const stat = await this.getStat(resolved)
    if (stat.isDirectory()) {
      const children = await fs.promises.readdir(resolved)
      if (children.length > 0) {
        throw new GuobaError('只能删除空目录')
      }
      await fs.promises.rmdir(resolved)
    } else {
      await fs.promises.unlink(resolved)
    }
    return {path: resolved}
  }

  async stat(filePath) {
    const resolved = this.resolvePath(filePath)
    return this.toItem(resolved, await this.getStat(resolved))
  }

  async ensureParent(filePath) {
    const parent = path.dirname(filePath)
    const stat = await this.getStat(parent)
    if (!stat.isDirectory()) {
      throw new GuobaError('父路径不是目录')
    }
  }

  async getStat(filePath) {
    try {
      await this.assertRealPathInside(filePath)
      return await fs.promises.stat(filePath)
    } catch (error) {
      if (error instanceof GuobaError) {
        throw error
      }
      throw new GuobaError('路径不存在')
    }
  }

  resolveChild(parent, name) {
    return this.resolvePath(path.join(parent, name))
  }

  resolvePath(value) {
    const resolved = path.resolve(String(value || this.rootPath))
    this.assertPathInside(resolved, this.rootPath)
    return resolved
  }

  async assertRealPathInside(filePath) {
    this.assertPathInside(await fs.promises.realpath(filePath), this.rootRealPath)
  }

  assertPathInside(target, root) {
    const relative = path.relative(root, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new GuobaError('路径超出云崽根目录')
    }
  }

  existsInside(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return false
      }
      this.assertPathInside(fs.realpathSync(filePath), this.rootRealPath)
      return true
    } catch {
      return false
    }
  }

  normalizeName(value) {
    const name = String(value || '').trim()
    if (!name) {
      throw new GuobaError('名称不能为空')
    }
    if (name.includes('/') || name.includes('\\')) {
      throw new GuobaError('名称不能包含路径分隔符')
    }
    if (name === '.' || name === '..') {
      throw new GuobaError('名称不合法')
    }
    return name
  }

  getParent(current) {
    if (current === this.rootPath) {
      return ''
    }
    return this.toDirectory(path.dirname(current))
  }

  toDirectory(dirPath) {
    return {
      name: path.basename(dirPath) || dirPath,
      path: dirPath,
      relativePath: path.relative(this.rootPath, dirPath) || '.',
    }
  }

  toItem(filePath, stat) {
    const isDirectory = stat.isDirectory()
    return {
      editable: stat.isFile() && stat.size <= MAX_TEXT_SIZE && this.looksTextFile(filePath),
      extension: path.extname(filePath).toLowerCase(),
      isDirectory,
      isFile: stat.isFile(),
      modifiedAt: stat.mtime.toISOString(),
      name: path.basename(filePath),
      path: filePath,
      relativePath: path.relative(this.rootPath, filePath) || '.',
      size: stat.size,
      type: isDirectory ? 'directory' : 'file',
    }
  }

  looksTextFile(filePath) {
    const basename = path.basename(filePath).toLowerCase()
    if (textExtensions.has(basename) || textExtensions.has(path.extname(basename))) {
      return true
    }
    return basename.startsWith('.') && !basename.includes('.', 1)
  }

  isBinary(buffer) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024))
    return sample.includes(0)
  }
}
