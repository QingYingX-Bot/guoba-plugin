import {autowired, Result} from '#guoba.framework'
import {ApiController, cfg} from '#guoba.platform'

export class UserController extends ApiController {
  accountService = autowired('accountService')
  auditService = autowired('auditService')

  constructor(guobaApp) {
    super('/user', guobaApp)
  }

  registerRouters() {
    this.get('/getLoginUser', this.getLoginUser)
    this.get('/profile', this.getProfile)
    this.put('/profile', this.updateProfile)
    this.get('/list', this.getUserList)
    this.put('/account/status', this.setAccountStatus)
  }

  // 获取登录用户
  async getLoginUser(req) {
    const preferredUin = this.accountService.getPreferredUinFromReq(req)
    const current = await this.accountService.getCurrentAccount(preferredUin)
    return Result.ok({
      userId: current.userId,
      username: current.username,
      realName: current.realName,
      avatar: this.getAvatar(),
      desc: '',
      homePath: '/home',
      roles: [
        {roleName: '超级管理员', value: 'sa'},
      ],
      sourceBotUin: current.userId,
      sourcePlatform: current.platform || '',
    })
  }

  getProfile() {
    return Result.ok({
      displayName: String(cfg.get('login.displayName') || '').trim(),
      avatar: this.getAvatar(),
    })
  }

  async updateProfile(req) {
    const {displayName = '', avatar = ''} = req.body || {}
    const nextDisplayName = String(displayName || '').trim()
    const nextAvatar = String(avatar || '').trim()
    if (nextAvatar && !this.isSafeAvatarUrl(nextAvatar)) {
      return Result.error('头像地址仅支持 http(s)、data:image 或站内静态资源路径')
    }
    cfg.set('login.displayName', nextDisplayName)
    cfg.set('login.avatar', nextAvatar)
    return Result.ok({
      displayName: nextDisplayName,
      avatar: nextAvatar,
    }, '面板资料已保存')
  }

  getAvatar() {
    const avatar = String(cfg.get('login.avatar') || '').trim()
    return this.isSafeAvatarUrl(avatar) ? avatar : ''
  }

  isSafeAvatarUrl(avatar) {
    if (!avatar) {
      return false
    }
    return /^https?:\/\//i.test(avatar)
      || /^data:image\//i.test(avatar)
      || avatar.startsWith('/')
  }

  // 获取账号列表
  async getUserList(req) {
    const preferredUin = this.accountService.getPreferredUinFromReq(req)
    const accounts = await this.accountService.listAccounts(preferredUin)
    return Result.ok(accounts)
  }

  // 设置账号上下线状态
  async setAccountStatus(req) {
    const {userId, action} = req.body || {}
    const begin = Date.now()
    try {
      await this.accountService.setAccountStatus(userId, action)
      await this.auditService.record(req, 'account.status.update', userId, {
        botUin: userId,
        params: {action},
        result: 'success',
        duration: Date.now() - begin,
      })
      return Result.ok(true, action === 'enable' ? '已发送上线操作' : '已发送下线操作')
    } catch (error) {
      await this.auditService.record(req, 'account.status.update', userId, {
        botUin: userId,
        params: {action},
        result: 'failed',
        duration: Date.now() - begin,
      })
      return Result.error(`账号状态切换失败：${error?.message || error}`)
    }
  }
}
