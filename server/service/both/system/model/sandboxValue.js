export function stringifySandboxValue(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stringifySegment).filter(Boolean).join('')
  return stringifySegment(value)
}

export function truncateSandboxText(value, limit = 4000) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

export function createSandboxMessage({content, level = '', meta = {}, role, type = 'text'}) {
  return {
    content: truncateSandboxText(stringifySandboxValue(content)),
    createdAt: new Date().toISOString(),
    id: `sandbox-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    meta,
    role,
    type,
  }
}

function stringifySegment(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (value.type) return stringifyTypedSegment(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function stringifyTypedSegment(value) {
  const data = value.data ?? value
  switch (value.type) {
    case 'at':
      return `@${data.qq ?? data.user_id ?? data}`
    case 'file':
      return `[文件：${data.name ?? data.file ?? data}]`
    case 'image':
      return `[图片：${data.url ?? data.file ?? data}]`
    case 'json':
      return `[JSON：${stringifySegment(data.data ?? data)}]`
    case 'record':
      return `[语音：${data.url ?? data.file ?? data}]`
    case 'reply':
      return `[回复：${data.id ?? data}]`
    case 'video':
      return `[视频：${data.url ?? data.file ?? data}]`
    case 'xml':
      return `[XML：${stringifySegment(data.data ?? data)}]`
    default:
      return `[${value.type}：${stringifySegment(data)}]`
  }
}
