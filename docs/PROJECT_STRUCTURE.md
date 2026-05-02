# Guoba-Plugin Project Structure

本文档记录锅巴插件当前目录职责，方便后续整理时判断哪些目录属于源码、运行缓存或构建产物。

## 核心入口

- `index.js`：Yunzai 插件入口。
- `main.js`：AlemonJS 入口。
- `guoba.support.js`：锅巴配置页 schema。
- `package.json`：依赖、导入别名和插件元信息。

## 插件本体

- `apps/`：聊天侧指令，例如帮助、登录、手动更新和 V2 适配命令。
- `adapter/`：Yunzai/TRSS/Miao 等兼容层。
- `framework/`：插件内部轻量 controller/service 框架。
- `server/`：管理面板后端。
- `models/`：`#guoba.*` import alias 的聚合导出。
- `utils/`：插件通用工具。
- `lib/`：仍在运行期使用的独立 helper 库。

## 配置与资源

- `defSet/`：默认配置模板，应该提交到仓库。
- `config/`：本地运行配置，已被 git 忽略。
- `resources/images/`：README、帮助图、图标等仍在使用的图片资源。

## 前端

- `guoba-plugin-web/`：管理面板前端源码，是独立 git 仓库。
- `server/static/`：前端构建产物，不手动修改；需要发布前端变更时由构建同步。

## 运行缓存

- `data/`：运行期数据，已被 git 忽略。
- `data/cache/repos/PluginsIndex`：插件市场索引仓库缓存，由 `utils/git.js` 初始化，仍在插件列表中使用。
- `data/repo/PluginsIndex`：旧插件市场索引缓存位置，启动时会自动迁移到 `data/cache/repos/PluginsIndex`。
- `data/repo/GuobaResources`：旧资源仓库缓存，已不再初始化；本地残留可视为历史缓存。

## 维护文件

- `docs/`：项目结构、issue 进度等维护文档。
- `scripts/maintenance/`：维护和兼容性检查脚本。
- `AGENTS.md`：Codex/agent 协作说明。

## 已清理的旧功能

- 旧天气查询和 `resources/json/city.json`。
- 旧首页 `/home/data` 接口和对应前端类型/API。
- 旧随机喵喵图片 `/home/random-image` 和 `resources/images/no-miao.png`。
- 锅巴自身旧自动检查更新流程和 `lib/compareVersions.js`。
- 旧 `components/Changelog.js` 聊天渲染组件。
- 旧 `GuobaResources` 资源仓库自动克隆配置。
