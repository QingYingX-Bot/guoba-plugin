import {exec} from 'child_process'
import {_paths, _version} from '#guoba.platform'

const _STATUS = {
  FAIL: 'FAIL',
  SUCCESS: 'SUCCESS',
  GIT_NO_UPDATE: 'GIT_NO_UPDATE',
}

/**
 * 锅巴更新
 */
export class GuobaUpdate extends plugin {
  constructor(e) {
    super({
      name: '锅巴更新',
      dsc: '锅巴更新、升级',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#锅巴版本$',
          fnc: 'getVersion',
        },
        {
          reg: '^#锅巴(强制)?(更新|升级|update)$',
          fnc: 'doUpdate',
          permission: 'master',
        },
      ],
    })
  }

  async getVersion() {
    return this.reply(`[Guoba] 当前版本：${_version}`)
  }

  async doUpdate() {
    let isForce = this.e.msg.includes('强制')
    let response = await this.doGitPull(isForce)
    let {status, message} = response
    if (status === _STATUS.GIT_NO_UPDATE) {
      return this.reply(`[Guoba] 已经是最新版本啦`)
    } else if (status === _STATUS.SUCCESS) {
      return this.reply(`[Guoba] ${message}`)
    } else {
      if (message) {
        return this.reply(`[Guoba] 更新失败！\n${message}`)
      }
      logger.error(`[Guoba] 更新失败：`, {status, message})
      return this.reply(`[Guoba] 更新失败…… 请查看日志获取更多信息`)
    }
  }

  /**
   * 执行git pull更新
   * @param isForce 是否强制更新
   * @return {Promise<{status: number, message: string}>}
   */
  doGitPull(isForce = false) {
    return new Promise((resolve) => {
      // 普通更新：添加 --rebase 策略，防止高版本 Git 报错
      let command = 'git pull --rebase'
      if (isForce) {
        // 强制更新：获取远程最新记录，并将本地强制重置为远程上游分支，彻底丢弃本地所有更改和分叉
        command = 'git fetch --all && git reset --hard @{u}'
      }
      exec(command, {cwd: _paths.pluginRoot}, function (error, stdout, stderr) {
        if (error) {
          let message = 'Error code: ' + error.code + '\n' + error.stack + '\n 请稍后重试。'
          resolve({status: _STATUS.FAIL, message})
          return
        }
        if (/Already up[ -]to[ -]date/.test(stdout)) {
          resolve({status: _STATUS.GIT_NO_UPDATE})
          return
        }
        resolve({
          status: _STATUS.SUCCESS,
          // message: '更新成功' + (isForce ? '，由于是强制更新，本次更新需要重启才能生效' : '')
          message: '更新成功，请您手动重启以生效更新。'
        });
      })
    })
  }
}
