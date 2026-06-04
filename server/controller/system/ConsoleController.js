import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class ConsoleController extends ApiController {
  consoleService = autowired('consoleService')

  constructor(guobaApp) {
    super('/console', guobaApp)
  }

  registerRouters() {
    this.get('/logs', this.queryLogs)
  }

  queryLogs(req) {
    return Result.ok(this.consoleService.queryLogs(req.query || {}))
  }
}
