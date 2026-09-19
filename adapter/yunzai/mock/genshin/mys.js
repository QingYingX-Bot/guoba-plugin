/**
 * mock MysInfo
 */
export class MysInfo {
  static async getBingCkUid() {
    log()
    return {}
  }

  static async initCache() {
    log()
    return {}
  }
}

/**
 * mock MysUser
 */
export class MysUser {
  static async getStatData() {
    log()
    return {
      count: {
        total: -1
      }
    }
  }
}

let logged = false

function log() {
  if (logged) {
    return
  }
  logged = true
  logger.warn('[Guoba] 未检测到原神插件（genshin / Mys-plugin），相关功能不可用')
}
