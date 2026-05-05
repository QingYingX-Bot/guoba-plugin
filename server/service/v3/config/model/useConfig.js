// todo adapter
import loader from '../../../../../../../lib/plugins/loader.js'
import {hasGenshin, isTRSS} from '#guoba.adapter'

const CfgAdapter = await (() => {
  if (isTRSS) {
    return import('./useTRSSConfig.js')
  } else {
    return import('./useMiaoConfig.js')
  }
})()

const addGroupPromptProps = CfgAdapter['addGroupPromptProps']

const serverConfigCards = CfgAdapter['baseConfig'].server ?? []

const defaultServerConfigCards = [
  {
    key: 'system.server',
    title: '服务器配置',
    desc: '对服务器进行相关配置',
    schemas: [
      {
        field: 'url',
        label: '服务器地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入服务器地址',
        },
      },
      {
        field: 'port',
        label: '服务器端口',
        component: 'InputNumber',
        componentProps: {
          placeholder: '0-65535',
          min: 0,
          max: 65535,
        },
      },
      {
        field: 'redirect',
        label: '服务器缺省跳转地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入地址',
        },
      },
      {
        field: 'auth',
        label: '服务器鉴权',
        component: 'GSubForm',
        componentProps: {
          multiple: true,
          modalProps: {
            title: '服务器鉴权配置',
          },
          schemas: [
            {
              field: 'key',
              label: '鉴权标识',
              bottomHelpMessage: '不能重复、不能包含空格',
              component: 'Input',
              required: true,
              rules: [
                {pattern: '^[^\\s]*$', message: '不能包含空格'},
              ],
            },
            {
              field: 'value',
              label: '鉴权值',
              component: 'Input',
              required: true,
            },
          ],
        },
      },
      {
        field: 'https.url',
        label: 'HTTPS 服务器地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入服务器地址',
        },
      },
      {
        field: 'https.port',
        label: 'HTTPS 服务器端口',
        component: 'InputNumber',
        componentProps: {
          placeholder: '0-65535',
          min: 0,
          max: 65535,
        },
      },
      {
        field: 'https.key',
        label: 'HTTPS 服务器私钥',
        component: 'Input',
        componentProps: {
          placeholder: '请输入服务器私钥文件路径',
        },
      },
      {
        field: 'https.cert',
        label: 'HTTPS 服务器证书',
        component: 'Input',
        componentProps: {
          placeholder: '请输入服务器证书文件路径',
        },
      },
    ],
  },
]

const resolvedServerConfigCards = serverConfigCards.length > 0 ? serverConfigCards : defaultServerConfigCards

// 基础配置
const baseConfig = {
  key: 'base',
  title: '基础配置',
  cards: [
    {
      key: 'system.bot',
      title: '机器人配置',
      desc: '对机器人进行相关配置',
      schemas: [
        {
          field: 'log_level',
          label: '日志等级',
          bottomHelpMessage: '日志输出等级。Mark时只显示执行命令，不显示聊天记录',
          component: 'Select',
          componentProps: {
            options: [
              {label: 'Trace', value: 'trace'},
              {label: 'Debug', value: 'debug'},
              {label: 'Info', value: 'info'},
              {label: 'Warn', value: 'warn'},
              {label: 'Fatal', value: 'fatal'},
              {label: 'Mark', value: 'mark'},
              {label: 'Error', value: 'error'},
              {label: 'Off', value: 'off'},
            ],
            placeholder: '请选择日志等级',
          },
        },
        ...(CfgAdapter['baseConfig'].bot ?? []),
        {
          field: 'online_msg_exp',
          label: '推送帮助冷却',
          bottomHelpMessage: '填上线推送通知的冷却时间',
          component: 'InputNumber',
          componentProps: {
            placeholder: '（分钟）',
          },
        },
        {
          field: 'chromium_path',
          label: 'chromium路径',
          bottomHelpMessage: 'chromium其他路径，默认无需填写，需要时可填写chromium的可执行文件绝对路径',
          component: 'Input',
          componentProps: {
            placeholder: '请输入chromium路径',
          },
        },
        {
          field: 'puppeteer_ws',
          label: 'puppeteer接口地址',
          bottomHelpMessage: 'puppeteer接口地址，默认无需填写',
          component: 'Input',
          componentProps: {
            placeholder: '请输入puppeteer接口地址',
          },
        },
        {
          field: 'puppeteer_timeout',
          label: 'puppeteer截图超时时间',
          bottomHelpMessage: 'puppeteer截图超时时间，默认无需填写',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            placeholder: '（毫秒）',
          },
        },
        {
          field: 'proxyAddress',
          label: '代理地址',
          bottomHelpMessage: '米游社接口代理地址，国际服用',
          component: 'Input',
          componentProps: {
            placeholder: '请输入米游社代理地址',
          },
        },
      ],

    },
  ],
}

const groupConfig = () => {
  const funOptions = []
  for (let item of loader.priority) {
    if (item.hasOwnProperty('name') && item.name) {
      if (!funOptions.find(i => i.value === item.name)) {
        funOptions.push({value: item.name})
      }
    }
  }
  const funComponent = funOptions.length === 0 ? 'GTags' : 'Select'
  return {
    key: 'group',
    title: '群组配置',
    cards: [
      {
        key: 'system.group',
        type: 'keyFormCard',
        // 标题表达式
        title: `{{ form.key === 'default' ? '默认配置' : '群：' + (form?.values?.__GROUP_TIP_TEXT__ ?? form.key) }}`,
        desc: '默认配置对所有群聊生效',
        // 允许添加新的配置
        allowAdd: true,
        allowDel: true,
        // 新增按钮文本（默认“新增”）
        addBtnText: '新增群配置',
        promptProps: addGroupPromptProps,
        schemas: [
          ...(CfgAdapter['groupConfig'].group ?? []),
          {
            field: 'addPrivate',
            label: '私聊添加',
            component: 'Switch',
            bottomHelpMessage: '是否允许私聊添加',
            componentProps: {
              checkedValue: 1,
              unCheckedValue: 0,
            },
          },
          {
            field: 'enable',
            label: '功能白名单',
            component: funComponent,
            bottomHelpMessage: '配置后只有配置的功能才可以使用',
            componentProps: {
              allowAdd: true,
              allowDel: true,
              mode: 'multiple',
              options: funOptions,
            },
          },
          {
            field: 'disable',
            label: '功能黑名单',
            component: funComponent,
            bottomHelpMessage: '配置后配置的功能将不可以使用',
            componentProps: {
              allowAdd: true,
              allowDel: true,
              mode: 'multiple',
              options: funOptions,
            },
          },
        ],
      },
    ],
  }
}

const genshinConfig = {
  key: 'genshin',
  title: '原神配置',
  cards: [
    {
      key: 'genshin.mys.set',
      title: '米游社设置',
      desc: '',
      schemas: [
        {
          field: 'allowUseCookie',
          label: '使用用户ck',
          component: 'Switch',
          bottomHelpMessage: '公共查询是否使用用户ck',
          componentProps: {
            checkedValue: 1,
            unCheckedValue: 0,
          },
        },
        {
          field: 'cookieDoc',
          label: 'ck文档地址',
          component: 'Input',
          bottomHelpMessage: '默认cookie帮助文档链接地址',
          componentProps: {},
        },
        {
          field: 'isAutoSign',
          label: '开启自动签到',
          component: 'Switch',
          bottomHelpMessage: '是否开启米游社原神自动签到',
          componentProps: {
            checkedValue: 1,
            unCheckedValue: 0,
          },
        },
        {
          field: 'signTime',
          label: '签到定时任务',
          component: 'EasyCron',
          bottomHelpMessage: '米游社原神签到定时任务，Cron表达式，默认00:02开始执行，每10s签到一个',
          componentProps: {
            placeholder: '请输入或选择Cron表达式',
          },
        },
        {
          field: 'abbrSetAuth',
          label: '别名权限',
          component: 'RadioGroup',
          bottomHelpMessage: '别名设置权限',
          componentProps: {
            options: [
              {label: '所有群员都可以添加', value: 0},
              {label: '群主和管理员才能添加', value: 1},
              {label: '只有主人才能添加', value: 2},
            ],
          },
        },
      ],
    },
    {
      key: 'genshin.mys.pubCk',
      title: '公共Cookie',
      desc: '米游社公共查询cookie，允许添加多个',
      // 数组form
      type: 'arrayFormCard',
      allowAdd: true,
      allowDel: true,
      addBtnText: '添加Cookie',
      lengthMin: 1,
      schemas: [],
    },
    {
      key: 'genshin.gacha',
      title: `十连配置（{{form.key === 'default' ? '默认' : form.key}}）`,
      desc: '十连次数、概率等相关配置',
      type: 'keyFormCard',
      allowAdd: true,
      allowDel: true,
      addBtnText: '新增群单独配置',
      promptProps: addGroupPromptProps,
      schemas: [
        {
          field: 'count',
          label: '每日抽卡数',
          bottomHelpMessage: '设置每天可以抽多少次',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            placeholder: '请输入每日抽卡数',
          },
        },
        {
          field: 'delMsg',
          label: '自动撤回',
          bottomHelpMessage: '自动撤回未出货的抽卡消息，0-120 秒，0 = 不撤回',
          component: 'InputNumber',
          componentProps: {
            placeholder: '请输入自动撤回时间',
          },
        },
        {
          field: 'LimitSeparate',
          label: '分开计算',
          bottomHelpMessage: '角色池、武器池限制次数是否分开计算',
          component: 'Switch',
          componentProps: {
            checkedValue: 1,
            unCheckedValue: 0,
          },
        },
      ],
    },
  ],
}

const serviceConfig = {
  key: 'service',
  title: '服务配置',
  cards: [
    ...resolvedServerConfigCards,
    {
      key: 'system.renderer',
      title: '渲染后端',
      desc: '配置截图与渲染后端，留空时使用默认 puppeteer',
      schemas: [
        {
          field: 'name',
          label: '渲染后端',
          component: 'Input',
          componentProps: {
            placeholder: '默认 puppeteer，可填写 puppeteer / karin 等',
          },
        },
      ],
    },
  ],
}

const adapterConfig = {
  key: 'adapter',
  title: '适配器配置',
  cards: [
    {
      key: 'system.milky',
      title: 'Milky 协议',
      desc: '配置 Milky 适配器连接信息',
      schemas: [
        {
          field: 'enable',
          label: '启用 Milky',
          component: 'Switch',
        },
        {
          field: 'host',
          label: '服务器地址',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 Milky 服务器地址',
          },
        },
        {
          field: 'port',
          label: '服务器端口',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            max: 65535,
            placeholder: '请输入 Milky 服务器端口',
          },
        },
        {
          field: 'prefix',
          label: 'URL 前缀',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 URL 前缀',
          },
        },
        {
          field: 'access_token',
          label: '鉴权 Token',
          component: 'InputPassword',
          componentProps: {
            placeholder: '请输入鉴权 Token',
          },
        },
        {
          field: 'connection',
          label: '事件接收方式',
          component: 'RadioGroup',
          componentProps: {
            options: [
              {label: 'WebSocket', value: 'ws'},
              {label: 'Webhook', value: 'webhook'},
            ],
          },
        },
        {
          field: 'webhook.path',
          label: 'Webhook 路径',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 Webhook 路径',
          },
        },
        {
          field: 'ws.heartbeat',
          label: 'WS 心跳间隔',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            placeholder: '秒',
          },
        },
        {
          field: 'ws.reconnect_interval',
          label: 'WS 重连间隔',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            placeholder: '秒',
          },
        },
        {
          field: 'http_timeout',
          label: 'HTTP 超时',
          component: 'InputNumber',
          componentProps: {
            min: 1,
            placeholder: '秒',
          },
        },
      ],
    },
    {
      key: 'system.satori',
      title: 'Satori 协议',
      desc: '配置 Satori HTTP API 与事件 WebSocket',
      schemas: [
        {
          field: 'enable',
          label: '启用 Satori',
          component: 'Switch',
        },
        {
          field: 'http_endpoint',
          label: 'HTTP API 地址',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 HTTP API 地址',
          },
        },
        {
          field: 'ws_endpoint',
          label: 'WebSocket 地址',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 WebSocket 事件地址',
          },
        },
        {
          field: 'token',
          label: '访问令牌',
          component: 'InputPassword',
          componentProps: {
            placeholder: '请输入 API 访问令牌',
          },
        },
        {
          field: 'platform',
          label: '平台名称',
          component: 'Input',
          componentProps: {
            placeholder: '请输入平台名称',
          },
        },
        {
          field: 'timeout',
          label: '请求超时',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            placeholder: '毫秒',
          },
        },
        {
          field: 'heartbeat_interval',
          label: '心跳间隔',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            placeholder: '毫秒',
          },
        },
      ],
    },
  ],
}

const storageConfig = {
  key: 'storage',
  title: '数据存储',
  cards: [
    {
      key: 'system.redis',
      title: 'Redis 配置',
      desc: '配置 Redis / Valkey 连接信息',
      schemas: [
        {
          field: 'path',
          label: 'Redis 命令路径',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 Redis 或 Valkey 命令路径',
          },
        },
        {
          field: 'host',
          label: 'Redis 地址',
          required: true,
          component: 'Input',
          componentProps: {
            placeholder: '请输入 Redis 地址',
          },
        },
        {
          field: 'port',
          label: 'Redis 端口',
          required: true,
          component: 'InputNumber',
          componentProps: {
            placeholder: '请输入 Redis 端口',
            min: 1,
            max: 65535,
          },
        },
        {
          field: 'username',
          label: 'Redis 用户名',
          bottomHelpMessage: '没有用户名可以为空',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 Redis 用户名',
          },
        },
        {
          field: 'password',
          label: 'Redis 密码',
          bottomHelpMessage: '没有密码可以为空',
          component: 'InputPassword',
          componentProps: {
            placeholder: '请输入 Redis 密码',
          },
        },
        {
          field: 'db',
          label: 'Redis 数据库',
          required: true,
          bottomHelpMessage: '一般不用改',
          component: 'InputNumber',
          componentProps: {
            min: 0,
            placeholder: '请输入 Redis 数据库',
          },
        },
      ],
    },
    {
      key: 'system.db',
      title: '数据库配置',
      desc: '配置 Sequelize 数据库连接',
      schemas: [
        {
          field: 'dialect',
          label: '数据库类型',
          component: 'Select',
          componentProps: {
            options: [
              {label: 'SQLite', value: 'sqlite'},
              {label: 'MySQL', value: 'mysql'},
              {label: 'PostgreSQL', value: 'postgres'},
              {label: 'MariaDB', value: 'mariadb'},
              {label: 'MSSQL', value: 'mssql'},
              {label: 'DB2', value: 'db2'},
            ],
            placeholder: '请选择数据库类型',
          },
        },
        {
          field: 'storage',
          label: 'SQLite 文件地址',
          component: 'Input',
          componentProps: {
            placeholder: '请输入 SQLite 文件地址',
          },
        },
        {
          field: 'logging',
          label: '数据库日志',
          component: 'Switch',
        },
      ],
    },
  ],
}

const otherConfig = {
  key: 'other',
  title: '其他',
  cards: [
    {
      key: 'system.other',
      title: '其他配置',
      desc: '其他配置',
      schemas: [
        ...(CfgAdapter['otherConfig'].other ?? []),
        {
          field: 'blackGroup',
          label: '黑名单群',
          bottomHelpMessage: '黑名单群，可以设置多个',
          component: 'GSelectGroup',
          componentProps: {
            placeholder: '请选择黑名单群',
          },
        },
        {
          field: 'whiteGroup',
          label: '白名单群',
          bottomHelpMessage: '白名单群，可以设置多个',
          component: 'GSelectGroup',
          componentProps: {
            placeholder: '请选择白名单群',
          },
        },
        {
          field: 'autoFriend',
          label: '添加好友',
          bottomHelpMessage: '是否自动同意添加好友请求',
          component: 'Switch',
          componentProps: {
            checkedValue: 1,
            unCheckedValue: 0,
          },
        },
        {
          field: 'autoQuit',
          label: '退群人数',
          bottomHelpMessage: '被好友拉进群时，群人数小于配置值自动退出，设为0表示不处理',
          component: 'InputNumber',
          componentProps: {
            placeholder: '请输入退群人数',
            min: 0,
          },
        },
        {
          field: 'disablePrivate',
          label: '禁用私聊',
          bottomHelpMessage: '禁用后私聊只接受ck以及抽卡链接（Bot主人不受限制）',
          component: 'Switch',
        },
        {
          field: 'disableMsg',
          label: '禁私聊提示',
          bottomHelpMessage: '禁用私聊时Bot的提示内容',
          component: 'Input',
          componentProps: {
            placeholder: '请输入禁用提示',
          },
        },
        {
          field: 'disableAdopt',
          label: '私聊通行字符串',
          bottomHelpMessage: '禁用私聊后，允许响应的字符串',
          component: 'GTags',
          componentProps: {
            allowAdd: true,
            allowDel: true,
          },
        },
      ],
    },
  ],
}

export function getConfigTabs() {
  let tabs = []
  tabs.push(baseConfig)
  tabs.push(groupConfig())
  if (hasGenshin) {
    tabs.push(genshinConfig)
  }
  tabs.push(serviceConfig)
  tabs.push(adapterConfig)
  tabs.push(storageConfig)
  tabs.push(otherConfig)
  return tabs
}

export const configFile = {
  'system.bot': '/config/config/bot.yaml',
  'system.group': '/config/config/group.yaml',
  'system.redis': '/config/config/redis.yaml',
  'system.db': '/config/config/db.yaml',
  'system.other': '/config/config/other.yaml',
  'system.server': '/config/config/server.yaml',
  'system.renderer': '/config/config/renderer.yaml',
  'system.milky': '/config/config/milky.yaml',
  'system.satori': '/config/config/satori.yaml',

  'genshin.gacha': [
    '/plugins/genshin/config/config/gacha.set.yaml',
    '/plugins/genshin/config/gacha.set.yaml',
  ],
  'genshin.mys.pubCk': [
    '/plugins/genshin/config/config/mys.pubCk.yaml',
    '/plugins/genshin/config/mys.pubCk.yaml',
  ],
  'genshin.mys.set': [
    '/plugins/genshin/config/config/mys.set.yaml',
    '/plugins/genshin/config/mys.set.yaml',
  ],
  'genshin.role.name': [
    '/plugins/genshin/config/config/role.name.yaml',
    '/plugins/genshin/config/role.name.yaml',
  ],
}
