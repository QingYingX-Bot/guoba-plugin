import {GuobaSupportMap, PluginsMap} from '#guoba.platform'
import {getPluginIconPath, parseShowInMenu} from '../../../../../utils/pluginUtils.js'

const pluginsLegacyMenu = {
  path: '/plugins',
  name: 'PluginsLegacy',
  component: '/guoba/plugins/index',
  redirect: '/plugins/market',
  meta: {
    title: '插件管理',
    icon: 'clarity:plugin-line',
    hideMenu: true,
  },
}

const pluginsMarketMenu = {
  path: '/plugins/market',
  name: 'PluginsMarket',
  component: '/guoba/plugins/index',
  meta: {
    title: '插件市场',
    icon: 'lucide:store',
  },
}

const pluginRulesMenu = {
  path: '/plugins/rules',
  name: 'PluginRules',
  component: '/guoba/plugins/rules/index',
  redirect: '/plugins/rules/@/all',
  meta: {
    title: '功能规则',
    icon: 'lucide:list-checks',
  },
  children: [],
}

function getMenuPluginIcon(pluginInfo, fallback = 'clarity:plugin-line') {
  const pluginIconPath = getPluginIconPath(pluginInfo)
  return pluginIconPath || pluginInfo?.icon || fallback
}

function getMenuPluginGuobaMeta(pluginInfo) {
  const pluginIconPath = getPluginIconPath(pluginInfo)
  return {
    plugin: {
      name: pluginInfo?.name,
      icon: pluginInfo?.icon,
      iconColor: pluginInfo?.iconColor,
      iconPath: pluginIconPath,
    },
  }
}

// 插件的菜单
// noinspection JSUnusedGlobalSymbols
export async function usePluginsMenu() {
  const pluginMenus = []
  const pluginRuleMenus = []
  let miaoPluginDetailMenu = null

  pluginRuleMenus.push({
    path: '/plugins/rules/@/all',
    name: 'PluginRules_All',
    component: '/guoba/plugins/rules/index',
    meta: {
      title: '全部插件',
      icon: 'lucide:list-checks',
      ignoreRoute: true,
    },
  })

  // 遍历所有插件
  GuobaSupportMap.forEach((value, name) => {
    if (!parseShowInMenu(value)) {
      return
    }

    const pluginIcon = getMenuPluginIcon(value.pluginInfo)

    const detailMenu = {
      path: `/plugin/@/${name}`,
      name: 'PluginDetail_' + name,
      component: `/guoba/plugins/plugin-detail/index`,
      meta: {
        title: value.pluginInfo?.title ?? name,
        icon: pluginIcon,
        ignoreRoute: true,
      },
      guobaMeta: {
        ...getMenuPluginGuobaMeta(value.pluginInfo),
      }
    }

    if (name === 'miao-plugin') {
      miaoPluginDetailMenu = detailMenu
      return
    }

    pluginMenus.push(detailMenu)
  })

  Array.from(PluginsMap.values())
    .filter((plugin) => plugin?.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .forEach((plugin) => {
      const name = plugin.name
      const pluginIcon = getMenuPluginIcon(plugin, 'lucide:file-check-2')
      pluginRuleMenus.push({
        path: `/plugins/rules/@/${encodeURIComponent(name)}`,
        name: `PluginRules_${String(name).replaceAll(/[^a-zA-Z0-9_]/g, '_')}`,
        component: '/guoba/plugins/rules/index',
        meta: {
          title: name,
          icon: pluginIcon,
          ignoreRoute: true,
        },
        guobaMeta: getMenuPluginGuobaMeta(plugin),
      })
    })

  pluginRuleMenus.push({
    path: '/plugins/rules/@/:name',
    name: 'PluginRules_Detail',
    component: '/guoba/plugins/rules/index',
    meta: {
      title: '功能规则',
      hideMenu: true,
    },
  })

  const pluginRulesGroupMenu = {
    ...pluginRulesMenu,
    children: pluginRuleMenus,
  }

  // 喵喵插件额外功能
  const miaoExtraMenus = await useMiaoPluginMenu()
  if (miaoPluginDetailMenu && miaoExtraMenus.length > 0) {
    pluginMenus.push(buildMiaoPluginMenu(miaoPluginDetailMenu, miaoExtraMenus))
  } else {
    if (miaoPluginDetailMenu) {
      pluginMenus.push(miaoPluginDetailMenu)
    }
    pluginMenus.push(...miaoExtraMenus)
  }

  if (pluginMenus.length > 0) {
    pluginMenus.push({
      path: `/plugin/@/:name`,
      name: 'PluginDetail',
      component: `/guoba/plugins/plugin-detail/index`,
      meta: {
        title: '插件详情',
        hideMenu: true,
      },
    })
  }

  if (pluginMenus.length > 0) {
    return [
      pluginsLegacyMenu,
      pluginsMarketMenu,
      pluginRulesGroupMenu,
      {
        path: '/plugin/@',
        name: 'PluginDetailParent',
        component: '/guoba/plugins/index',
        meta: {
          title: '插件配置',
          // icon: 'clarity:plugin-line',
          // icon: 'arcticons:game-plugins',
          icon: 'ion:settings-outline',
        },
        // 重定向到
        redirect: pluginMenus[0]?.path ?? pluginsMarketMenu.path,
        children: [
          ...pluginMenus,
        ],
      }
    ]
  } else {
    return [
      pluginsLegacyMenu,
      pluginsMarketMenu,
      pluginRulesGroupMenu,
    ]
  }
}

const miaoMenu = {
  path: '/plugin/@/miao-plugin/help',
  name: 'MiaoPlugin',
  component: '/guoba/plugins/extra-config/miao-plugin/index',
  meta: {
    title: '喵喵配置',
    icon: 'twemoji:heart-with-ribbon',
  },
}

const miaoV1Menu = {
  path: miaoMenu.path,
  name: miaoMenu.name,
  component: '/guoba/plugins/extra-config/miao-plugin-v1/index',
  meta: {
    ...miaoMenu.meta,
  },
}

// 喵喵帮助菜单
async function useMiaoPluginMenu() {
  // 判断是否安装了喵喵插件
  if (PluginsMap.get('miao-plugin')) {
    // 判断喵喵插件版本
    try {
      let miaoVersion = (await import('../../../../../../../miao-plugin/components/Version.js')).default
      if (miaoVersion.version.startsWith('1')) {
        return [miaoV1Menu]
      } else {
        return [miaoMenu]
      }
    } catch (e) {
      logger.error(e)
    }
  }
  return []
}

function buildMiaoPluginMenu(miaoPluginDetailMenu, miaoExtraMenus) {
  const miaoIconPath = miaoPluginDetailMenu?.guobaMeta?.plugin?.iconPath

  const configMenu = {
    ...miaoPluginDetailMenu,
    path: '/plugin/@/miao-plugin/config',
    name: `${miaoPluginDetailMenu.name}_Config`,
    meta: {
      ...(miaoPluginDetailMenu.meta ?? {}),
      title: '插件配置',
      icon: 'ion:settings-outline',
      ignoreRoute: true,
    },
  }

  return {
    path: '/plugin/@/miao-plugin',
    name: `${miaoPluginDetailMenu.name}_Group`,
    meta: {
      title: miaoPluginDetailMenu.meta?.title ?? 'Miao-Plugin',
      icon: miaoIconPath ?? miaoPluginDetailMenu.meta?.icon ?? 'clarity:plugin-line',
      ignoreRoute: true,
    },
    redirect: configMenu.path,
    children: [
      configMenu,
      ...miaoExtraMenus,
    ],
  }
}
