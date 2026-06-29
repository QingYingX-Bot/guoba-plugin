const DEFAULT_GIT_INSTALL_WHITELIST = [
  'github.com',
  'gitee.com',
  'gitlab.com',
  'gitcode.com',
]

const ALLOWED_GIT_PROTOCOLS = new Set(['http:', 'https:', 'ssh:', 'git:'])

export function getPluginInstallRejectReason(link, whitelist) {
  const text = String(link || '').trim()
  if (!text || text.includes('\0') || /[\r\n]/.test(text)) {
    return '插件链接不合法'
  }
  const host = getGitInstallHost(text)
  if (!host) {
    return '插件链接不合法'
  }
  const allowedHosts = normalizeWhitelist(whitelist)
  if (!allowedHosts.some(domain => host === domain || host.endsWith(`.${domain}`))) {
    return `不允许从 ${host} 安装插件，请在锅巴设置中添加白名单`
  }
  return ''
}

export function getPluginNameFromLink(link) {
  const text = String(link || '').trim()
  if (!text) {
    return ''
  }
  let name = ''
  if (isScpLikeGitUrl(text)) {
    name = text.split('/').pop()
  } else {
    try {
      const url = new URL(text)
      if (!ALLOWED_GIT_PROTOCOLS.has(url.protocol)) {
        return ''
      }
      name = url.pathname.split('/').filter(Boolean).pop()
    } catch {
      return ''
    }
  }
  name = String(name || '').replace(/\.git$/i, '')
  return isSafePluginName(name) ? name : ''
}

function getGitInstallHost(link) {
  const scpHost = link.match(/^git@([a-z0-9.-]+):[a-z0-9._~/-]+(?:\.git)?$/i)?.[1]
  if (scpHost) {
    return scpHost.toLowerCase()
  }
  try {
    const url = new URL(link)
    if (!ALLOWED_GIT_PROTOCOLS.has(url.protocol)) {
      return ''
    }
    return url.hostname.toLowerCase()
  } catch {
    return ''
  }
}

function normalizeWhitelist(whitelist) {
  const items = Array.isArray(whitelist) ? whitelist : DEFAULT_GIT_INSTALL_WHITELIST
  const normalized = items
    .map(item => String(item || '').trim().toLowerCase())
    .filter(item => /^[a-z0-9.-]+$/.test(item))
  return normalized.length > 0 ? normalized : DEFAULT_GIT_INSTALL_WHITELIST
}

function isScpLikeGitUrl(link) {
  return /^git@[a-z0-9.-]+:[a-z0-9._~/-]+(?:\.git)?$/i.test(link)
}

function isSafePluginName(name) {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(String(name || ''))
}
