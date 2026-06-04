const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g
const CONSOLE_HUB_KEY = Symbol.for('guoba.console.hub')
const MAX_STREAM_BUFFER = 500
const MAX_LINE_CHARS = 20000

const LEVEL_MAP = {
  DEBG: 'debug',
  ERRO: 'error',
  FATL: 'fatal',
  INFO: 'info',
  MARK: 'mark',
  TRAC: 'trace',
  WARN: 'warn',
}

export function getConsoleStreamHub() {
  if (!globalThis[CONSOLE_HUB_KEY]) {
    globalThis[CONSOLE_HUB_KEY] = {
      buffer: [],
      clients: new Set(),
      seq: 0,
      stderrPartial: '',
      stdoutPartial: '',
      wrappedStreams: new WeakSet(),
    }
  }
  return globalThis[CONSOLE_HUB_KEY]
}

export function installConsoleStreamHooks(hub) {
  wrapProcessStream(hub, process.stdout, 'stdout')
  wrapProcessStream(hub, process.stderr, 'stderr')
}

export function writeConsoleStreamEvent(res, event, data) {
  const payload = JSON.stringify(data)
  if (data?.id) {
    res.write(`id: ${data.id}\n`)
  }
  res.write(`event: ${event}\n`)
  res.write(`data: ${payload}\n\n`)
}

function wrapProcessStream(hub, stream, source) {
  if (!stream || typeof stream.write !== 'function' || hub.wrappedStreams.has(stream)) {
    return
  }
  const original = stream.write
  stream.write = function (...args) {
    const result = original.apply(this, args)
    publishStreamChunk(hub, source, args[0], args[1])
    return result
  }
  hub.wrappedStreams.add(stream)
}

function publishStreamChunk(hub, source, chunk, encoding) {
  const text = chunkToString(chunk, encoding)
  if (!text) {
    return
  }
  const partialKey = source === 'stderr' ? 'stderrPartial' : 'stdoutPartial'
  const normalized = `${hub[partialKey] || ''}${text}`.replace(/\r(?!\n)/g, '\n')
  const lines = normalized.split(/\r?\n/)

  if (/\r?\n$/.test(normalized)) {
    hub[partialKey] = ''
    lines.pop()
  } else {
    hub[partialKey] = lines.pop() || ''
  }

  for (const line of lines) {
    publishStreamLine(hub, source, line)
  }
}

function chunkToString(chunk, encoding) {
  if (typeof chunk === 'string') {
    return chunk
  }
  const charset = typeof encoding === 'string' ? encoding : 'utf8'
  if (Buffer.isBuffer(chunk)) {
    return chunk.toString(charset)
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString(charset)
  }
  return String(chunk || '')
}

function publishStreamLine(hub, source, rawLine) {
  const raw = limitLine(String(rawLine || ''))
  if (!raw.trim()) {
    return
  }
  const content = raw.replace(ANSI_PATTERN, '')
  const event = {
    content,
    createdAt: new Date().toISOString(),
    id: ++hub.seq,
    level: detectLevel(content, source),
    raw,
    source,
  }
  pushEvent(hub, event)
}

function pushEvent(hub, event) {
  hub.buffer.push(event)
  if (hub.buffer.length > MAX_STREAM_BUFFER) {
    hub.buffer.splice(0, hub.buffer.length - MAX_STREAM_BUFFER)
  }
  for (const client of [...hub.clients]) {
    try {
      writeConsoleStreamEvent(client.res, 'console', event)
    } catch {
      hub.clients.delete(client)
    }
  }
}

function detectLevel(content, source) {
  const tag = String(content || '').match(/\[(TRAC|DEBG|INFO|WARN|ERRO|FATL|MARK)\]/)?.[1]
  if (tag) {
    return LEVEL_MAP[tag] || tag.toLowerCase()
  }
  return source === 'stderr' ? 'error' : 'info'
}

function limitLine(line) {
  if (line.length <= MAX_LINE_CHARS) {
    return line
  }
  return `${line.slice(0, MAX_LINE_CHARS)}...`
}
