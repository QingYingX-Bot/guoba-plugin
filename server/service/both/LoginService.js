import jwt from 'jsonwebtoken'
import {GuobaError, Service} from '#guoba.framework';
import {cfg, Constant} from "#guoba.platform";
import {getAllWebAddress, randomString, verifyPasswordHash} from '#guoba.utils'

const DEFAULT_TOKEN_EXPIRES = 3600 * 24

export class LoginService extends Service {
  constructor(app) {
    super(app)
  }

  /** 注册并保存Token */
  signToken(loginContext, expiresIn = DEFAULT_TOKEN_EXPIRES) {
    const payload = this.normalizeLoginPayload(loginContext)
    expiresIn = this.normalizeExpiresIn(expiresIn)
    let token = jwt.sign(payload, cfg.getJwtSecret(), {expiresIn})
    // 将token存入redis
    let redisKey = this.getRedisKey(token)
    redis.set(redisKey, token, {EX: expiresIn})
    return token
  }

  logout(token) {
    if (token) {
      let redisKey = this.getRedisKey(token)
      redis.del(redisKey)
    }
  }

  async setQuickLogin(loginContext) {
    let {redisKey, code} = this.getQuickLoginRedisKey(null)
    let token = this.signToken(loginContext)
    redis.set(redisKey, token, {EX: 180})
    let webAddress = await getAllWebAddress()
    for (let [key, address] of Object.entries(webAddress)) {
      webAddress[key] = address.map(h => `${h}/#/ml/${code}`)
    }
    return webAddress
  }

  async getQuickLogin(code) {
    if (!code) {
      throw new GuobaError('登录失败')
    }
    let {redisKey} = this.getQuickLoginRedisKey(code)
    let token = await redis.get(redisKey)
    if (token) {
      redis.del(redisKey)
      return {token}
    }
    throw new GuobaError('登录失败')
  }

  getQuickLoginRedisKey(code) {
    if (!code) {
      code = randomString(6)
    }
    return {
      code,
      redisKey: `${Constant.REDIS_PREFIX}login-quick:${code}`,
    }
  }

  async codeLoginRequest() {
    let redisKey = `${Constant.REDIS_PREFIX}login-code`
    let code = await redis.get(redisKey)
    if (code) {
      throw new GuobaError('当前验证码还未失效，请稍后再试')
    } else {
      code = randomString(16)
    }
    await redis.set(redisKey, code, {EX: 300})
    return code
  }

  async codeLoginCheck(code) {
    let redisKey = `${Constant.REDIS_PREFIX}login-code`
    let redisCode = await redis.get(redisKey)
    if (redisCode === code) {
      await redis.del(redisKey)
      return await this.signToken('admin')
    }
    return false
  }

  getPasswordLoginStatus() {
    const passwordHash = String(cfg.get('login.passwordHash') || '').trim()
    return {
      hasPassword: !!passwordHash,
      rememberDays: this.getRememberDays(),
    }
  }

  async passwordLoginCheck(password, remember = false) {
    const status = this.getPasswordLoginStatus()
    if (!status.hasPassword) {
      throw new GuobaError('固定密码未设置')
    }
    const passwordHash = String(cfg.get('login.passwordHash') || '').trim()
    if (!verifyPasswordHash(password, passwordHash)) {
      return false
    }
    const expiresIn = remember ? status.rememberDays * 3600 * 24 : DEFAULT_TOKEN_EXPIRES
    return this.signToken('admin', expiresIn)
  }

  getRedisKey(token) {
    return `${Constant.REDIS_PREFIX}access-token:${token}`
  }

  getRememberDays() {
    const days = Number(cfg.get('login.rememberDays') || 7)
    if (!Number.isFinite(days)) {
      return 7
    }
    return Math.min(Math.max(Math.trunc(days), 1), 365)
  }

  normalizeExpiresIn(expiresIn) {
    const value = Number(expiresIn || DEFAULT_TOKEN_EXPIRES)
    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_TOKEN_EXPIRES
    }
    return Math.trunc(value)
  }

  normalizeLoginPayload(loginContext) {
    if (typeof loginContext === 'object' && loginContext !== null) {
      const username = String(loginContext.username || 'admin').trim() || 'admin'
      const sourceBotUin = String(loginContext.sourceBotUin || '').trim()
      const sourceBotName = String(loginContext.sourceBotName || '').trim()
      const sourcePlatform = String(loginContext.sourcePlatform || '').trim()
      return {
        username,
        sourceBotUin,
        sourceBotName,
        sourcePlatform,
      }
    }
    return {
      username: String(loginContext || 'admin').trim() || 'admin',
      sourceBotUin: '',
      sourceBotName: '',
      sourcePlatform: '',
    }
  }
}
