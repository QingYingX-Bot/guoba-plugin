import os from 'os'
import fs from 'fs'
import path from 'path'
import lodash from 'lodash'
import fetch from 'node-fetch'
import {exec} from 'child_process'
import {Service} from '#guoba.framework';
import {cfg, Constant, GuobaSupportMap, PluginsMap} from '#guoba.platform';
import {applyGithubProxy, BotActions} from '#guoba.utils'
import {parsePluginsIndexByLocal, parseReadmeLink} from '../../helper/pluginsIndex.js'
import {getPluginIconPath, parseShowInMenu} from '../../utils/pluginUtils.js'
import {serializeGuobaSchemas} from '../../utils/schemaCompat.js'

export default class IPluginService extends Service {
  constructor(app) {
    super(app)
    // 获取插件列表，填充GuobaSupportMap
    this.loadPlugining = this.getPlugins()
  }

  /**
   * 获取所有插件
   * @param force 是否清空缓存强制刷新
   * @return {Promise<*>}
   */
  async getPlugins(force = false) {
    let remotePlugins = await this.getRemotePlugins(force)
    let localPlugins = await this.readLocalPlugins(this.pluginsPath)
    for (let rp of remotePlugins) {
      let idx = localPlugins.findIndex(({name}) => lodash.toLower(name) === lodash.toLower(rp.name))
      if (idx > -1) {
        let lp = localPlugins[idx]
        Object.assign(rp, lp, {installed: true})
        localPlugins.splice(idx, 1)
      }
    }
    if (localPlugins.length > 0) {
      for (let plugin of localPlugins) {
        remotePlugins.push({
          isV2: false,
          isV3: false,
          isDeleted: false,
          title: plugin.name,
          name: plugin.name,
          link: '',
          author: '未知',
          authorLink: '',
          description: '',
          installed: true,
          ...plugin,
        })
      }
    }
    // 处理config等信息
    for (let plugin of remotePlugins) {
      // 判断是否配置了 iconPath
      plugin.iconPath = getPluginIconPath(plugin)
      // 判断是否支持guoba
      let supportObject = GuobaSupportMap.get(plugin.name)
      if (!supportObject) {
        continue
      }
      // 判断是否支持配置项
      let {configInfo} = supportObject
      let schemaGroups = Array.isArray(configInfo?.schemaGroups)
        ? serializeGuobaSchemas(configInfo.schemaGroups)
        : undefined
      let schemas = Array.isArray(configInfo?.schemas)
        ? serializeGuobaSchemas(configInfo.schemas)
        : undefined

      if (
        configInfo
        && (schemas?.length > 0 || schemaGroups?.length > 0)
        && typeof configInfo.getConfigData === 'function'
      ) {
        plugin.hasConfig = true
        plugin.schemaGroups = schemaGroups
        plugin.schemas = schemas
        plugin.showInMenu = parseShowInMenu(supportObject)
      }
    }
    // 已安装的插件，排在前面
    return remotePlugins.sort((a, b) => {
      if (a.installed && !b.installed) {
        return -1
      }
      if (!a.installed && b.installed) {
        return 1
      }
      return 0
    })
  }

  /**
   * 读取本地插件信息
   * @param pluginsPath
   * @return {object[]}
   */
  async readLocalPlugins(pluginsPath) {
    let files = fs.readdirSync(pluginsPath)
    let plugins = []
    for (let name of files) {
      if (this.exclude && this.exclude.includes(name)) {
        continue
      }
      let filePath = path.join(pluginsPath, name)
      let stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        let jsPath = path.join(filePath, 'index.js')
        if (fs.existsSync(jsPath) || fs.existsSync(path.join(filePath, '.git/'))) {
          let plugin = {
            name: name.toLowerCase(),
          }
          jsPath = path.join(filePath, 'guoba.support.js')
          // 判断是否支持锅巴
          if (fs.existsSync(jsPath)) {
            try {
              // 判断是否是windows系统
              if (os.platform() === 'win32') {
                jsPath = 'file:///' + jsPath
              }
              let {supportGuoba} = await import(jsPath + '?' + Date.now())
              if (typeof supportGuoba === 'function') {
                // TODO 传什么参数？待定
                let supportObject = supportGuoba()
                if (supportObject.pluginInfo) {
                  plugin = Object.assign(plugin, supportObject.pluginInfo)
                }
                // 注册进锅巴
                GuobaSupportMap.set(plugin.name, supportObject)
              } else {
                throw 'supportGuoba必须要定义成一个方法！'
              }
            } catch (e) {
              logger.error(`[Guoba] 载入"${plugin.name}"插件的"guoba.support.js"失败：` + (e.message || e))
            }
          }
          PluginsMap.set(plugin.name, plugin)
          plugins.push(plugin)
        }
      }
    }
    return plugins
  }

  /**
   * 获取远程插件列表
   * @param force 是否清空缓存强制刷新
   * @return {Promise<*>}
   */
  async getRemotePlugins(force = false) {
    let redisKey = Constant.REDIS_PREFIX + 'plugins'
    let remotePlugins = null
    if (!force) {
      remotePlugins = await redis.get(redisKey)
    }
    if (remotePlugins) {
      return JSON.parse(remotePlugins)
    }
    try {
      const remotesMap = await parsePluginsIndexByLocal()
      if (!remotesMap) {
        return []
      }
      const {topPlugins = [], plugins = [], gamePlugins = []} = remotesMap;
      remotePlugins = [...topPlugins, ...plugins, ...gamePlugins]
    } catch (e) {
      logger.error(e)
    }
    // 读取失败……
    if (!remotePlugins || remotePlugins.length === 0) {
      return []
    }
    redis.set(redisKey, JSON.stringify(remotePlugins), {EX: 3600 * 6})
    return remotePlugins
  }

  async getReadmeText(link, force = false) {
    let redisKey = Constant.REDIS_PREFIX + 'plugin:readme:' + link
    let text = null
    if (!force) {
      text = await redis.get(redisKey)
    }
    if (text) {
      return text
    }
    let arr = link.split('/')
    let name = (arr.pop() || '').trim().replace(/\.git$/, '')
    let author = arr.pop()
    let url = ''
    if (/github\.com/i.test(link)) {
      url = `https://raw.githubusercontent.com/${author}/${name}/{branch}`
    } else if (/gitee\.com/i.test(link)) {
      url = `https://gitee.com/${author}/${name}/raw/{branch}`
    }
    if (url) {
      let baseUrl = ''
      let branches = ['master', 'main']
      for (let branch of branches) {
        baseUrl = url.replace('{branch}', branch)
        let response = await fetch(applyGithubProxy(`${baseUrl}/README.md`))
        if (response.status === 200) {
          text = await response.text()
          break
        }
      }
      if (text) {
        text = parseReadmeLink(text, baseUrl)
        redis.set(redisKey, text, {EX: 3600 * 12})
        return text
      }
    }
    return ''
  }

  /**
   * 安装插件
   * @param link 插件链接
   * @param autoRestart 是否自动重启
   * @param autoNpmInstall 是否自动安装依赖
   * @param packageManager 包管理器
   * @return {Promise<{logs: string[], message: string, status: string}>}
   */
  async installPlugin(link, autoRestart, autoNpmInstall, packageManager = 'pnpm') {
    await this.initBotMethods();
    const name = link.split('/').pop().replace(/\.git$/, '');
    const pluginPath = `plugins/${name}`;
    const logs = []

    if (await Bot.fsStat(pluginPath)) {
      return {logs, status: 'error', message: `插件 ${name} 已安装`};
    }

    const cloneUrl = applyGithubProxy(link)

    let result = await Bot.exec(`git clone --depth 1 --single-branch "${cloneUrl}" "${pluginPath}"`);
    logs.push(this.formatExecLog('克隆插件', result))

    if (result.error) {
      logger.error(`[Guoba] 插件安装失败：${result.error}`);
      return {logs, status: 'error', message: `插件 ${name} 安装失败\n${result.error}`};
    }

    if (autoNpmInstall && await Bot.fsStat(`${pluginPath}/package.json`)) {
      const installCommand = this.getInstallCommand(pluginPath, packageManager)
      if (installCommand) {
        const installResult = await Bot.exec(installCommand);
        logs.push(this.formatExecLog('安装依赖', installResult))
        if (installResult.error) {
          logger.error(`[Guoba] 插件安装失败：${installResult.error}`);
          return {logs, status: 'error', message: `插件安装失败：${installResult.error}`};
        }
      } else {
        logs.push('安装依赖：已跳过')
      }
    } else if (autoNpmInstall) {
      logs.push('安装依赖：未发现 package.json，已跳过')
    } else {
      logs.push('安装依赖：已关闭自动安装')
    }

    if (autoRestart) {
      logs.push('重启：已触发自动重启')
      BotActions.doRestart();
    } else {
      logs.push('重启：已关闭自动重启')
    }

    return {logs, status: 'success', message: `插件 ${name} 安装成功`};
  }

  getInstallCommand(pluginPath, packageManager = 'pnpm') {
    packageManager = String(packageManager || 'pnpm').trim().toLowerCase()
    if (packageManager === 'none') {
      return ''
    }
    if (packageManager === 'auto') {
      if (fs.existsSync(path.join(pluginPath, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm'
      } else if (fs.existsSync(path.join(pluginPath, 'yarn.lock'))) {
        packageManager = 'yarn'
      } else if (fs.existsSync(path.join(pluginPath, 'bun.lockb')) || fs.existsSync(path.join(pluginPath, 'bun.lock'))) {
        packageManager = 'bun'
      } else if (fs.existsSync(path.join(pluginPath, 'package-lock.json'))) {
        packageManager = 'npm'
      } else {
        packageManager = 'pnpm'
      }
    }
    const commands = {
      bun: 'bun install',
      npm: 'npm install',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
    }
    const command = commands[packageManager] || commands.pnpm
    return `cd "${pluginPath}" && ${command}`
  }

  formatExecLog(title, result = {}) {
    const lines = [`${title}：${result.error ? '失败' : '完成'}`]
    if (result.stdout) {
      lines.push(String(result.stdout).trim())
    }
    if (result.stderr) {
      lines.push(String(result.stderr).trim())
    }
    if (result.error) {
      lines.push(String(result.error?.stack || result.error?.message || result.error).trim())
    }
    return lines.filter(Boolean).join('\n')
  }

  async uninstallPlugin(name, autoRestart = true) {
    await this.initBotMethods();
    const pluginPath = `plugins/${name}`;
    if (await Bot.fsStat(pluginPath)) {
      let result = await Bot.rm(pluginPath)
      if (!result) {
        logger.error(`[Guoba] 插件卸载失败`);
        return {status: 'error', message: `插件 ${name} 卸载失败`};
      } else {
        if (autoRestart) {
          BotActions.doRestart()
        }
        logger.info(`[Guoba] 插件 ${name} 卸载成功`);
        return {status: 'success', message: `插件 ${name} 卸载成功`};
      }
    } else {
      return {status: 'error', message: `插件 ${name} 不存在`};
    }
  }

  /**
   * 批量卸载插件
   * @param {string[]} nameArr
   */
  async uninstallPluginBatch(nameArr) {
    let texts = []
    for (let i = 0; i < nameArr.length; i++) {
      const name = nameArr[i]
      // 最后一个插件卸载时自动重启
      const autoRestart = i === nameArr.length - 1
      let {message} = await this.uninstallPlugin(name, autoRestart)
      texts.push(message)
    }
    return {status: 'success', message: texts.join('\n')}
  }

  async initBotMethods() {
    Bot.fsStat = Bot.fsStat || ((path) => {
      return new Promise((resolve) => {
        fs.stat(path, (err, stats) => {
          if (err) {
            logger.trace(`[Guoba] 获取${path}状态错误：${err}`);
            resolve(false);
          } else {
            resolve(stats);
          }
        });
      });
    });

    Bot.exec = Bot.exec || ((cmd, opts = {}) => {
      return new Promise((resolve) => {
        if (!opts.quiet) {
          logger.info(`[Guoba] 执行命令：${logger.blue(cmd)}`);
        }
        opts.windowsHide = opts.windowsHide ?? true;
        exec(cmd, opts, (error, stdout, stderr) => {
          resolve({error, stdout, stderr});
          if (opts.quiet) {
            return
          }
          logger.mark(`[Guoba] 执行命令完成：${logger.blue(cmd)}${stdout ? `\n${String(stdout).trim()}` : ""}${stderr ? logger.red(`\n${String(stderr).trim()}`) : ""}`);
          if (error) {
            logger.mark(`[Guoba] 执行命令错误：${logger.blue(cmd)}\n${logger.red((error?.message || error)?.trim?.() ?? '未知错误')}`);
          }
        });
      });
    });

    Bot.rm = Bot.rm || ((file) => {
      return new Promise((resolve) => {
        fs.rm(file, {force: true, recursive: true}, (err) => {
          if (err) {
            logger.trace(`[Guoba] 删除${file}错误：${err}`);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    });
  }
}
