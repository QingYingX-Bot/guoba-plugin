const COMPAT_MARKER = '__guobaCompatType'

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function serializeGuobaSchemaValue(value, seen = new WeakMap()) {
  if (typeof value === 'function') {
    return {
      [COMPAT_MARKER]: 'function',
      source: value.toString(),
    }
  }

  if (value instanceof RegExp) {
    return {
      [COMPAT_MARKER]: 'regexp',
      flags: value.flags,
      source: value.source,
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeGuobaSchemaValue(item, seen))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if (seen.has(value)) {
    return seen.get(value)
  }

  if (!isPlainObject(value)) {
    return value
  }

  const output = {}
  seen.set(value, output)

  for (const [key, item] of Object.entries(value)) {
    output[key] = serializeGuobaSchemaValue(item, seen)
  }

  return output
}

export function serializeGuobaSchemas(schemas) {
  return serializeGuobaSchemaValue(schemas)
}

