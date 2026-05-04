# Guoba Plugin Issues Progress

更新日期：2026-05-04

## 已完成

### #61 SSL 支持

状态：已完成。

已实现内容：

- 新增 `server.ssl.*` 配置项。
- 支持 HTTPS 监听。
- Web 地址协议可按配置切换为 `https`。
- 补充 README / CHANGELOG 说明。

验证情况：

- 已做 HTTPS 启动验证。
- 已做后端语法检查与 diff 空白检查。

### #105 GitHub 代理全局配置

状态：已完成。

已实现内容：

- 整理 `getGithubProxyUrl()`、`isGithubUrl(url)`、`applyGithubProxy(url)` 等全局工具方法。
- 插件安装 clone 链路使用 GitHub 代理。
- 插件 README 读取使用 GitHub 代理。
- 插件索引与 README 链接兜底处理使用 GitHub 代理。
- 更新 `guoba.support.js` 中 GitHub 代理配置说明。

验证情况：

- 已做后端语法检查。
- 已做 no-network 定向测试。
- 已做 diff 空白检查。

### #91 安装插件体验增强

状态：已完成，等待实际面板测试。

已实现内容：

- 安装插件时可选择包管理器：`auto` / `pnpm` / `npm` / `yarn` / `bun` / `跳过`。
- `auto` 会根据 lockfile 自动选择安装命令。
- 安装插件时可选择是否安装依赖。
- 安装插件时可选择是否自动重启。
- 后端返回 clone、依赖安装、重启状态日志。
- 前端插件列表页与插件详情弹窗均支持查看安装日志。
- Web 构建产物已同步到 `server/static`。

验证情况：

- `node --check` 后端相关文件通过。
- `pnpm -F @vben/web-antd run typecheck` 通过。
- `pnpm run build:v5` 通过。
- `git diff --check` 通过。

### #87 免验证码登录 / 固定密码登录

状态：已完成，等待实际面板测试。

已实现内容：

- 新增 `login.passwordHash`、`login.rememberDays` 配置。
- 配置页支持填写固定登录密码，保存时自动生成 PBKDF2-SHA256 哈希，不落盘明文密码。
- 新增固定密码登录状态接口与登录接口。
- 设置固定密码后即可使用密码登录；未设置密码时仅验证码可用。
- 不再提供单独启用开关，密码登录能力只由 `login.passwordHash` 是否存在决定。
- 登录页密码状态接口使用统一请求客户端解包后端 `result`，避免已设置密码但页面误判未配置。
- 验证码登录始终保留，登录页始终保留“密码登录 / 验证码登录”切换入口。
- 固定密码设置/修改必须先获取后台验证码，再输入验证码和新密码执行设置动作。
- 配置读取/保存会过滤 `login.passwordHash`、临时验证码、明文密码和历史 `login.password.*` 字段。
- 登录页不显示用户名，后端固定按 `admin` 语义处理密码登录。
- “记住登录”通过 token 有效期控制，有效期来自 `login.rememberDays`。

验证情况：

- 后端语法检查通过。
- 密码哈希生成与校验定向测试通过。
- `pnpm -F @vben/web-antd run typecheck` 通过。
- `pnpm run build:v5` 通过。

### #86 自定义头像

状态：已完成，等待实际面板测试。

已实现内容：

- 新增 `login.avatar` 配置项。
- 新增 `login.displayName` 配置项，登录用户信息优先使用用户自定义昵称。
- 右上角头像菜单新增“面板资料”，支持修改面板昵称。
- 面板头像改为本地图片上传并裁剪，复用框架 `VCropper`，裁剪后保存为 256x256 的 `data:image/png`。
- 移除用户下拉区域的示例邮箱 `ann.vben@gmail.com` 和 `Pro` 标签。
- `/user/getLoginUser` 返回配置的 `avatar`，前端现有布局会用于右上角、锁屏和工作台头像。
- 后端仍保留头像值校验，支持 `http(s)`、`data:image/...` 和站内静态资源路径；留空时继续使用前端默认头像。
- 锅巴插件配置页不再展示面板昵称/头像，避免把用户资料混在插件配置中。

验证情况：

- 后端语法检查通过。
- `pnpm -F @vben/web-antd run typecheck` 通过。
- `pnpm run build:v5` 通过，构建产物已同步到 `server/static`。
- 已检查源码与 `basic` 静态 chunk，右上角用户菜单不再输出示例邮箱和 `Pro` 标签。
- 已检查源码与 `basic` 静态 chunk，资料弹窗包含“上传裁剪 / 裁剪头像 / 清除头像”。
- `git diff --check` 通过。

### #90 群组配置按插件一键启用 / 禁用

状态：已完成，等待实际面板测试。

已实现内容：

- 群组配置页的功能白名单 / 功能黑名单支持按插件批量加入或移除功能。
- 批量操作复用 #49 的 `/plugin/rules` 运行时规则数据，按插件 `package.json name` 优先聚合。
- 白名单 / 黑名单最终仍保存为 Yunzai 原生 `enable` / `disable` 字符串数组，不改变后端配置格式。
- 批量加入使用运行时插件实例名 `plugin.name`，和 Yunzai loader 实际启停检查字段保持一致。
- 批量加入某插件到白名单时，会自动从黑名单移除同名功能；加入黑名单时同理，避免同一功能同时出现在两边。
- 保留手动输入功能名能力，兼容旧配置与未被运行时规则接口识别的功能。
- 群组配置页面继续支持创建多个群聊配置，默认配置与单群配置均可使用批量规则选择。
- 群基础设置按冷却时间、响应入口、添加权限、回复行为分区展示，减少普通字段平铺造成的阅读负担。
- 功能白名单与功能黑名单改为独立名单区域，共用规则库搜索和刷新入口，减少普通字段与功能规则混杂。
- 新增群配置弹窗改为表格选择器，完整拉取 Bot 会话列表，仅排除 `stdin` / 标准输入。
- 新增群配置弹窗支持按 QQ 群、官方 QQ 机器人、Discord、其他类型筛选。
- 官方 QQ 机器人会话（如 `3889842994:...`）独立显示为“官方 QQ 机器人”。
- Discord 会话（如 `dc_...`）按服务器 / 频道拆分展示，便于区分同一服务器下的不同频道。
- 配置管理二级菜单图标已区分基础配置、群组配置、原神配置、其他配置。

验证情况：

- `pnpm -F @vben/web-antd run typecheck` 通过。
- `pnpm run build:v5` 通过，构建产物已同步到 `server/static`。
- `node --check plugins/Guoba-Plugin/server/service/both/system/model/menus/systemMenus.js` 通过。
- `git diff --check` 通过。

## 已整理 / 清理

### 旧天气功能

状态：已移除。

- 移除 `/helper/city_weather`。
- 移除 `HelperService.getWeather()` / `getWeather_old()`。
- 移除 `base.city` 配置和配置页 schema。
- 移除 `resources/json/city.json`。

### 旧首页与随机图片功能

状态：已移除。

- 移除旧 `/home/data` 接口。
- 移除前端 `getHomeDataApi` / `GuobaHomeData`。
- 移除旧 `/home/random-image` 接口。
- 移除 `resources/images/no-miao.png`。

### 旧自动更新检查

状态：已移除。

- 移除锅巴自身旧自动检查更新流程。
- 移除 `base.checkUpdate` 配置和配置页 schema。
- 移除 `doCheckUpdate`、`doAutoUpdate`、`doUpdateTask`。
- 移除 `lib/compareVersions.js` 和 `models/libs.js` 中的对应导出。
- 保留聊天侧手动更新命令：`#锅巴版本`、`#锅巴更新`、`#锅巴强制更新`。

### 旧资源仓库缓存

状态：已停止初始化。

- 从 `utils/git.js` 移除 `GuobaResources` 仓库注册。
- 启动时不再 clone/update `https://gitee.com/guoba-yunzai/resources.git`。
- `data/repo/GuobaResources` 如本地仍存在，只是历史运行缓存。

### 维护目录

状态：已整理。

- 移除 `.github/copilot-instructions.md`。
- 新增 `AGENTS.md`，作为 Codex/agent 协作说明。
- 新增 `docs/PROJECT_STRUCTURE.md`。
- 将 issue 进度记录迁移到 `docs/ISSUE_PROGRESS.md`。
- 维护脚本保留在 `scripts/maintenance/`。

## 保留项

- `/helper/transit`：插件 README 图片代理仍在使用，并且在 `TokenInterceptor` 中保持公开。
- `/helper/release_port`：仍被端口释放逻辑使用。
- `/plugin/miao/**`：前端喵喵配置页仍在使用。
- `/home/dashboard`：当前首页 dashboard 接口仍在使用。
- `data/cache/repos/PluginsIndex`：插件市场索引缓存仍在使用；旧 `data/repo/PluginsIndex` 会在启动时自动迁移。

## 待处理

### #49 功能规则列表 / 禁用插件功能

状态：只读规则查看器已完成，等待实际面板测试。

已实现内容：

- 新增 `/plugin/rules` 接口。
- 基于 Yunzai `loader.priority` 只读收集当前运行时已加载规则。
- 来源插件显示使用插件 `package.json` 的 `name`，例如 `guoba-plugin`，不再使用目录名或功能名冒充插件名。
- 对 `index.js` 聚合导出的插件，后端会尽量通过运行时 class 名反查真实 JS 文件。
- 功能规则页改为树形层级：插件包名 -> JS 文件名 -> `plugin.name` / `plugin.dsc` -> 规则。
- 规则叶子节点展示规则名称、处理方法、事件、权限、优先级、正则、日志开关。
- 插件市场、插件配置、功能规则已拆成独立入口，不再把功能规则塞在插件管理内容区。
- 功能规则入口支持二级菜单：`全部插件` 与各插件包名子菜单。
- 功能规则页内容区移除重复插件列表，仅保留筛选栏、规则表格和规则详情。
- 前端支持按关键词、文件、事件、权限、日志、优先级筛选规则。
- 规则详情区展示来源插件、JS 文件、功能、方法、事件、权限、日志和匹配正则。

注意点：

- 当前仅做查看，不修改 Yunzai loader/runtime 行为。
- 禁用功能留到数据来源稳定后再实现。
- 对没有 `package.json` 的插件，来源插件会回退显示插件目录名。
- 规则页插件范围由路由决定，供后续 #90 复用“插件 -> 功能规则”映射。

验证情况：

- 后端语法检查通过。
- `pnpm -F @vben/web-antd run typecheck` 通过。
- `pnpm run build:v5` 通过，构建产物已同步到 `server/static`。
- `git diff --check` 通过。

## 推荐后续顺序

1. #49 功能规则禁用能力

说明：

- #49 的只读数据基础已经完成，#90 已复用当前规则来源。
- 下一步可以在规则查看器中继续做禁用功能，确认如何落到 Yunzai loader/runtime 层。
