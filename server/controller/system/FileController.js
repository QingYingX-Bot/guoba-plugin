import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class FileController extends ApiController {
  auditService = autowired('auditService')
  fileManagerService = autowired('fileManagerService')

  constructor(guobaApp) {
    super('/files', guobaApp)
  }

  registerRouters() {
    this.get('/roots', this.getRoots)
    this.get('/list', this.listFiles)
    this.get('/read', this.readFile)
    this.get('/stat', this.statFile)
    this.post('/mkdir', this.createDirectory)
    this.post('/rename', this.renameFile)
    this.put('/write', this.writeFile)
    this.delete('/delete', this.deleteFile)
  }

  getRoots() {
    return Result.ok(this.fileManagerService.getRoots())
  }

  async listFiles(req) {
    return Result.ok(await this.fileManagerService.list(req.query || {}))
  }

  async readFile(req) {
    return Result.ok(await this.fileManagerService.read(req.query?.path))
  }

  async statFile(req) {
    return Result.ok(await this.fileManagerService.stat(req.query?.path))
  }

  async createDirectory(req) {
    const {path, name} = req.body || {}
    return await this.withAudit(req, 'file.mkdir', path, {name, path}, async () => {
      return await this.fileManagerService.mkdir(path, name)
    })
  }

  async renameFile(req) {
    const {path, name} = req.body || {}
    return await this.withAudit(req, 'file.rename', path, {name, path}, async () => {
      return await this.fileManagerService.rename(path, name)
    })
  }

  async writeFile(req) {
    const {path, content = ''} = req.body || {}
    return await this.withAudit(req, 'file.write', path, {
      contentLength: String(content ?? '').length,
      path,
    }, async () => {
      return await this.fileManagerService.write(path, content)
    })
  }

  async deleteFile(req) {
    const {path} = req.body || {}
    return await this.withAudit(req, 'file.delete', path, {path}, async () => {
      return await this.fileManagerService.remove(path)
    })
  }

  async withAudit(req, action, target, params, executor) {
    const begin = Date.now()
    try {
      const data = await executor()
      await this.auditService.record(req, action, target, {
        duration: Date.now() - begin,
        params,
        result: 'success',
      })
      return Result.ok(data)
    } catch (error) {
      await this.auditService.record(req, action, target, {
        duration: Date.now() - begin,
        params,
        result: 'failed',
      })
      return Result.error(error?.message || String(error))
    }
  }
}
