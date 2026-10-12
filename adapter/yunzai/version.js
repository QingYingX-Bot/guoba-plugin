import fs from 'fs'

export const yunzaiPackage = JSON.parse(fs.readFileSync('./package.json', 'utf8'))

// 原神插件目录候选，按优先级排序：旧版为 genshin，新版为 Mys-plugin
const GENSHIN_PLUGIN_CANDIDATES = ['genshin', 'Mys-plugin']

// 检查yunzai版本
export const {
  isV2,
  isV3,
  isV4,
  isTRSS,
  isTRSSLike,
  frameworkName,
  noSupport,
  yunzaiVersion,

  genshinPluginDirs,
  genshinPluginName,
  hasGenshin,
} = checkVersion()

// 是否开发模式
export const isDev = (process.argv || []).includes('dev')

function checkVersion() {
  let isV2 = false, isV3 = false, isV4 = false, noSupport = false

  let {name, version} = yunzaiPackage ?? {}

  if (version) {
    if (version.startsWith('2')) {
      isV2 = true
    } else if (version.startsWith('3')) {
      isV3 = true
    } else if (version.startsWith('4')) {
      isV4 = true
    } else {
      noSupport = true
    }
  }

  const isTRSS = yunzaiPackage.name === 'trss-yunzai'
  const isJiuLi = yunzaiPackage.name === 'jiuli'

  // JiuLi（玖璃）等 TRSS 兼容框架：同样暴露 Bot.express / Bot.server（含 skip_auth / quiet），
  // 并提供 lib/config/config.js 兼容层，因此可复用「共享端口」能力。
  // 注意：isTRSS 仍只认 trss-yunzai，避免误用 TRSS 专属配置模型。
  const isTRSSLike = isTRSS || isJiuLi

  // 框架展示名（日志用）—— 别写死 TRSS，JiuLi 等框架同样走这条链路
  const frameworkName = isTRSS ? 'TRSS' : isJiuLi ? 'JiuLi' : (yunzaiPackage.name || 'Yunzai')

  // 实际存在的原神插件目录，可能同时存在，此时按候选顺序优先
  const genshinPluginDirs = GENSHIN_PLUGIN_CANDIDATES.filter((dir) => fs.existsSync(`./plugins/${dir}`))
  // 优先使用的原神插件目录名，没有则为 null
  const genshinPluginName = genshinPluginDirs[0] ?? null
  // 是否存在原神插件（兼容 genshin / Mys-plugin 两种目录名）
  const hasGenshin = genshinPluginDirs.length > 0

  return {
    isV2,
    isV3,
    isV4,
    noSupport,
    isTRSS,
    isTRSSLike,
    frameworkName,
    yunzaiVersion: version,

    genshinPluginDirs,
    genshinPluginName,
    hasGenshin,
  }
}
