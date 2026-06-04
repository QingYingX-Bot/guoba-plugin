import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class ConsoleController extends ApiController {
  consoleService = autowired('consoleService')

  constructor(guobaApp) {
    super('/console', guobaApp)
  }

  registerRouters() {
    this.get('/logs', this.queryLogs)
    this.get('/stream', this.stream)
  }

  queryLogs(req) {
    return Result.ok(this.consoleService.queryLogs(req.query || {}))
  }

  stream(req, res) {
    this.consoleService.stream(req, res)
    return Result.VOID
  }
}
