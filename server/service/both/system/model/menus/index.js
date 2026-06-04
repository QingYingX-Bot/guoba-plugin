import {isV2} from '#guoba.adapter'

const {GI} = Guoba.createImport(import.meta.url)
const {SystemMenus, useConfigMenu} = await GI('./systemMenus.js')
const {usePluginsMenu} = await GI('./pluginMenus.js')

// noinspection JSUnusedGlobalSymbols
export async function useMenuList() {
  if (isV2) return useMenuListV2()
  const menus = []
  menus.push(SystemMenus.home)
  menus.push(SystemMenus.console)
  menus.push(useConfigMenu())
  menus.push(...(await usePluginsMenu()))
  menus.push(SystemMenus.account)
  menus.push(SystemMenus.message)
  menus.push(SystemMenus.files)
  menus.push(SystemMenus.sandbox)
  menus.push(SystemMenus.jsPlugins)
  menus.push(SystemMenus.tasks)
  menus.push(SystemMenus.about)
  return menus
}

async function useMenuListV2() {
  return []
}
