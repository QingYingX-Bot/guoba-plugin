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
    this.put('/:uin/profile', this.updateProfile)
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

  async updateProfile(req) {
    const {uin} = req.params
    const begin = Date.now()
    const data = this.accountService.updateAccountMeta(uin, req.body || {})
    await this.auditService.record(req, 'account.profile.update', uin, {
      botUin: uin,
      params: req.body || {},
      result: 'success',
      duration: Date.now() - begin,
    })
    return Result.ok(data, '账号资料已保存')
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
