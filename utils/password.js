import crypto from 'crypto'

const HASH_ALGORITHM = 'pbkdf2-sha256'
const HASH_ITERATIONS = 120000
const KEY_LENGTH = 32
const DIGEST = 'sha256'

export function createPasswordHash(password) {
  const text = String(password || '')
  if (!text) {
    return ''
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(text, salt, HASH_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
  return `${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`
}

export function verifyPasswordHash(password, passwordHash) {
  const text = String(password || '')
  const stored = String(passwordHash || '')
  if (!text || !stored) {
    return false
  }

  const parts = stored.split('$')
  if (parts.length === 4 && parts[0] === HASH_ALGORITHM) {
    const iterations = Number(parts[1])
    const salt = parts[2]
    const expectedHash = parts[3]
    if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expectedHash) {
      return false
    }
    const actual = crypto.pbkdf2Sync(text, salt, iterations, KEY_LENGTH, DIGEST).toString('hex')
    return timingSafeEqualHex(actual, expectedHash)
  }

  // 兼容手工填入的 sha256 明文摘要，便于迁移。
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const actual = crypto.createHash('sha256').update(text).digest('hex')
    return timingSafeEqualHex(actual, stored)
  }

  return false
}

function timingSafeEqualHex(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''), 'hex')
  const expectedBuffer = Buffer.from(String(expected || ''), 'hex')
  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}
