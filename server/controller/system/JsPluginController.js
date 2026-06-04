import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class JsPluginController extends ApiController {
  auditService = autowired('auditService')
  jsPluginService = autowired('jsPluginService')

  constructor(guobaApp) {
    super('/js-plugins', guobaApp)
  }

  registerRouters() {
    this.get('/list', this.query)
    this.get('/detail', this.detail)
    this.post('/toggle', this.toggle)
    this.post('/copy-example', this.copyExample)
    this.post('/reload', this.reload)
  }

  query(req) {
    return Result.ok(this.jsPluginService.query(req.query || {}))
  }

  detail(req) {
    return Result.ok(this.jsPluginService.detail(req.query?.path))
  }

  async toggle(req) {
    const {path, enabled} = req.body || {}
    return await this.withAudit(req, 'js-plugin.toggle', path, {enabled, path}, async () => {
      return this.jsPluginService.toggle(path, Boolean(enabled))
    })
  }

  async copyExample(req) {
    const {path, targetName} = req.body || {}
    return await this.withAudit(req, 'js-plugin.copy-example', path, {path, targetName}, async () => {
      return this.jsPluginService.copyExample(path, targetName)
    })
  }

  async reload(req) {
    const {path} = req.body || {}
    return await this.withAudit(req, 'js-plugin.reload', path, {path}, async () => {
      return await this.jsPluginService.reload(path)
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
