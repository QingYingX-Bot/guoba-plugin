import {genshinPluginDirs} from './version.js'

let Restart
try {
  Restart = (await import('../../../other/restart.js')).Restart
} catch {
  Restart = (await import('./mock/system/apps.js')).Restart
}

let MysInfo, MysUser;

/**
 * 依次尝试从 genshin / Mys-plugin 载入米游社相关 model
 * 兼容旧版 genshin 插件与新版 Mys-plugin（两者目录结构一致）
 */
const importMys = async () => {
  const errors = []
  for (const plugin of genshinPluginDirs) {
    try {
      MysInfo = (await import(`../../../${plugin}/model/mys/mysInfo.js`)).default
      MysUser = (await import(`../../../${plugin}/model/mys/MysUser.js`)).default
      return {ok: true}
    } catch (e) {
      errors.push(`[${plugin}] ${e?.message || e}`)
    }
  }
  return {ok: false, errors}
}

const importMockMys = async () => {
  const mys = (await import('./mock/genshin/mys.js'))
  MysInfo = mys.MysInfo
  MysUser = mys.MysUser
}

const {ok, errors = []} = await importMys()
if (!ok) {
  // 装了原神插件但模块加载失败时给出明确报错，方便排查
  if (genshinPluginDirs.length) {
    logger.warn(`[Guoba] 检测到原神插件（${genshinPluginDirs.join(' / ')}），但米游社模块加载失败，相关功能已禁用`)
    for (const msg of errors) {
      logger.error(`[Guoba] ${msg}`)
    }
  }
  await importMockMys()
}

export {
  Restart,
  MysInfo,
  MysUser,
}
