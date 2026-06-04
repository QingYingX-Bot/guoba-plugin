// noinspection JSUnusedGlobalSymbols
import {getConfigTabs} from '../../../../v3/config/model/useConfig.js'

const configMenuBase = {
  path: '/config',
  name: 'Config',
  component: '/guoba/config/index',
  meta: {
    title: '配置管理',
    icon: 'ion:settings-outline',
  },
}

const configTabIconMap = {
  base: 'ion:options-outline',
  adapter: 'lucide:plug-zap',
  genshin: 'ion:sparkles-outline',
  group: 'ion:people-outline',
  other: 'lucide:shield-user',
  service: 'lucide:server-cog',
  storage: 'lucide:database',
}

function getConfigTabIcon(tab) {
  return tab.icon ?? configTabIconMap[tab.key] ?? 'ion:settings-outline'
}

function getConfigRouteName(key) {
  return `Config_${String(key).replaceAll(/[^a-zA-Z0-9_]/g, '_')}`
}

export function useConfigMenu() {
  const children = getConfigTabs().map((tab) => ({
    path: `/config/@/${encodeURIComponent(tab.key)}`,
    name: getConfigRouteName(tab.key),
    component: '/guoba/config/index',
    meta: {
      title: tab.title ?? tab.key,
      icon: getConfigTabIcon(tab),
      ignoreRoute: true,
    },
  }))

  children.push({
    path: '/config/@/:key',
    name: 'Config_Detail',
    component: '/guoba/config/index',
    meta: {
      title: '配置管理',
      hideMenu: true,
    },
  })

  return {
    ...configMenuBase,
    redirect: children[0]?.path ?? configMenuBase.path,
    children,
  }
}

export const SystemMenus = {
  // 首页菜单
  home: {
    path: '/home',
    name: 'Home',
    component: '/guoba/home/index',
    meta: {
      title: '首页',
      icon: 'bx:bx-home',
    },
  },
  // 账号管理
  account: {
    path: '/account',
    name: 'Account',
    component: '/guoba/system/account/index',
    meta: {
      title: '账号管理',
      icon: 'ant-design:user-outlined',
    },
  },
  // 代发消息
  message: {
    path: '/message',
    name: 'Message',
    component: '/guoba/system/message/index',
    meta: {
      title: '代发消息',
      icon: 'lucide:send',
    },
  },
  // 任务管理
  tasks: {
    path: '/tasks',
    name: 'Tasks',
    component: '/guoba/system/tasks/index',
    meta: {
      title: '任务管理',
      icon: 'lucide:list-checks',
    },
  },
  // 配置管理
  config: configMenuBase,
  // 关于
  about: {
    path: '/about',
    name: 'about',
    component: '/guoba/about/index',
    meta: {
      title: '关于',
      icon: 'cib:about-me',
    },
  },
}
