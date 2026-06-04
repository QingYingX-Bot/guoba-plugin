import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class AccountController extends ApiController {
  accountService = autowired('accountService')
  accountTargetService = autowired('accountTargetService')
  auditService = autowired('auditService')

  constructor(guobaApp) {
    super('/accounts', guobaApp)
  }

  registerRouters() {
    this.get('/', this.queryAccounts)
    this.get('/list', this.queryAccounts)
    this.get('/:uin', this.getAccount)
    this.get('/:uin/diagnostics', this.getDiagnostics)
    this.get('/:uin/friends', this.getFriends)
    this.get('/:uin/groups', this.getGroups)
    this.post('/:uin/status', this.setStatus)
    this.put('/:uin/status', this.setStatus)
  }

  async queryAccounts(req) {
    return Result.ok(await this.accountService.queryAccounts(req))
  }

  async getAccount(req) {
    const {uin} = req.params
    return Result.ok(await this.accountService.getAccount(uin))
  }

  getDiagnostics(req) {
    const {uin} = req.params
    return Result.ok(this.accountService.getDiagnostics(uin))
  }

  async getFriends(req) {
    const {uin} = req.params
    return Result.ok(await this.accountTargetService.listFriends(uin, req.query))
  }

  async getGroups(req) {
    const {uin} = req.params
    return Result.ok(await this.accountTargetService.listGroups(uin, req.query))
  }

  async setStatus(req) {
    const {uin} = req.params
    const {action} = req.body || {}
    const begin = Date.now()
    try {
      const data = await this.accountService.setAccountStatus(uin, action)
      await this.auditService.record(req, 'account.status.update', uin, {
        botUin: uin,
        params: {action},
        result: 'success',
        duration: Date.now() - begin,
      })
      return Result.ok(data, action === 'enable' ? '已发送上线操作' : '已发送下线操作')
    } catch (error) {
      await this.auditService.record(req, 'account.status.update', uin, {
        botUin: uin,
        params: {action},
        result: 'failed',
        duration: Date.now() - begin,
      })
      return Result.error(`账号状态切换失败：${error?.message || error}`)
    }
  }
}
