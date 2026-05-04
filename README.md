# Guoba-Plugin Fork

`Guoba-Plugin Fork`是`Yunzai-Bot`的扩展插件，主要提供后台管理界面。

> 原项目地址：[gitee](https://gitee.com/guoba-yunzai/guoba-plugin) | [github](https://github.com/guoba-yunzai/guoba-plugin)

具体功能可在安装插件后，通过发送`#锅巴帮助`来进行查看。

插件反馈&交流群：[点击加群](https://qm.qq.com/q/QO3auCaOAQ)

## 安装插件

#### 第 1 步：下载插件

在云崽根目录下打开终端，运行：

* 使用 Github
``` bash
git clone --depth=1 https://github.com/QingYingX-Bot/guoba-plugin.git ./plugins/Guoba-Plugin/
```

#### 第 2 步：安装依赖

##### 方式1：采用 pnpm

> 注：如果你不是通过`pnpm`安装的云崽，那么请【**不要**】使用此方式，请看`方式2`

如果你是使用`pnpm`安装的云崽，那么只需要在云崽根目录下运行此命令即可：

```bash
pnpm install --filter=guoba-plugin
```

> 注：请务必直接复制提供的命令，否则可能会导致依赖丢失的情况，若发生需自行重新安装。<br>
> `--filter=guoba-plugin`：只安装`guoba-plugin`下的依赖，其他依赖不处理，防止丢失。

##### 方式2：采用 npm 或 cnpm

如果是使用`npm`或`cnpm`等其他依赖安装工具，需要手动安装以下依赖：

```bash
npm install express multer body-parser jsonwebtoken
```

如果以上命令执行失败，可尝试使用`cnpm`进行安装，只需将开头的`npm`替换成`cnpm`即可。

> 注：cnpm需要单独安装，已安装的可以忽略，安装命令如下：<br>
> `npm install cnpm -g --registry=https://registry.npmmirror.com`

#### 第 3 步：运行插件

依赖安装完毕之后，直接运行即可，默认运行端口号是：50831

> 可在 config/application.yaml 中修改

启动完成之后，可以在控制台中看到网页地址，复制到浏览器中即可访问。

如果访问不到，请发送`#锅巴帮助`指令获取帮助。

### HTTPS/SSL

如需让锅巴直接提供 HTTPS 访问，可在 `plugins/Guoba-Plugin/config/application.yaml` 中开启：

```yaml
server:
  ssl:
    enable: true
    keyPath: certs/privkey.pem
    certPath: certs/fullchain.pem
    caPath: ""
    passphrase: ""
```

证书路径支持绝对路径，也支持相对云崽根目录。修改后需要重启锅巴。

> 注：如果开启了“与 TRSS 共享端口”，锅巴会复用 TRSS 的服务，此处 SSL 配置不会接管监听端口，请在 TRSS 或反向代理中配置 HTTPS。

## 更新插件

一般会自动更新，如需手动更新，请发送`#锅巴更新`指令

## 项目结构

锅巴插件本体保留了 Yunzai 插件常见入口和运行目录：

- `index.js`、`main.js`、`guoba.support.js` 是运行入口或锅巴配置入口，不建议移动。
- `apps/` 放聊天侧指令，`server/` 放管理面板后端，`utils/` 和 `models/` 提供通用工具与聚合导出。
- `defSet/` 是默认配置模板，`config/` 是本地运行配置。
- `server/static/` 是前端构建产物；前端源码在独立仓库 `guoba-plugin-web/` 中。
- `resources/images/` 放图片资源，`docs/` 放维护文档。

更完整的目录说明见：[docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)。

# 功能预览

- 主界面
  ![001](./resources/images/readme/001.png)

- 查看插件README
  ![002](./resources/images/readme/002.png)

- 基础配置
  ![003](./resources/images/readme/003.png)

- 群组配置
  ![004](./resources/images/readme/004.png)

- 编辑喵喵帮助
  ![005](./resources/images/readme/005.png)

# 免责声明

1. 功能仅限内部交流与小范围使用，严禁将Guoba-Plugin用于任何商业用途或盈利
2. 图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除

# 其他

- 最后求个个star
  你的支持是维护本项目的动力~

* 原 Guoba-Plugin
    - [gitee](https://gitee.com/guoba-yunzai/guoba-plugin)
    - [github](https://github.com/QingYingX-Bot/guoba-plugin)
* TRSS-Yunzai
    - [gitee](https://gitee.com/TimeRainStarSky/Yunzai)
    - [github](https://github.com/TimeRainStarSky/Yunzai)
* Miao-Plugin
    - [gitee](https://github.com/yoimiya-kokomi/miao-plugin)
    - [github](https://github.com/yoimiya-kokomi/miao-plugin)
* Yunzai插件索引
    - [gitee](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
    - [github](https://github.com/yhArcadia/Yunzai-Bot-plugins-index)
