const STRING_FIELD_PATTERN = field => new RegExp(`${field}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`)

export function parseJsPluginSource(content = '') {
  const text = String(content || '')
  const classes = extractClasses(text)
  const rules = extractRules(text)
  const tasks = extractTasks(text)
  const meta = extractPluginMeta(text)
  return {
    classes,
    classCount: classes.length,
    dsc: meta.dsc,
    event: meta.event,
    name: meta.name,
    priority: meta.priority,
    ruleCount: rules.length,
    rules,
    taskCount: tasks.length,
    tasks,
  }
}

function extractClasses(text) {
  const matches = text.matchAll(/(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\s+extends\s+([A-Za-z_$][\w$.]*)/g)
  return Array.from(matches).map((match) => ({
    extendsName: match[2] || '',
    name: match[1] || '',
  }))
}

function extractPluginMeta(text) {
  const superBlock = extractFirstCallObject(text, 'super') || ''
  const priority = Number.parseInt(extractNumberField(superBlock, 'priority'), 10)
  return {
    dsc: extractStringField(superBlock, 'dsc'),
    event: extractStringField(superBlock, 'event'),
    name: extractStringField(superBlock, 'name'),
    priority: Number.isFinite(priority) ? priority : null,
  }
}

function extractRules(text) {
  const block = extractFieldArray(text, 'rule')
  if (!block) {
    return []
  }
  return splitObjectBlocks(block).map((item, index) => ({
    event: extractStringField(item, 'event'),
    fnc: extractStringField(item, 'fnc'),
    log: extractBooleanField(item, 'log'),
    name: extractStringField(item, 'name'),
    permission: extractStringField(item, 'permission'),
    reg: extractRuleReg(item),
    ruleIndex: index,
  }))
}

function extractTasks(text) {
  const block = extractFieldArray(text, 'task')
  if (!block) {
    return []
  }
  return splitObjectBlocks(block).map((item, index) => ({
    cron: extractStringField(item, 'cron'),
    fnc: extractStringField(item, 'fnc'),
    log: extractBooleanField(item, 'log'),
    name: extractStringField(item, 'name'),
    taskIndex: index,
  }))
}

function extractFirstCallObject(text, name) {
  const callIndex = text.indexOf(`${name}(`)
  if (callIndex < 0) {
    return ''
  }
  const start = text.indexOf('{', callIndex)
  return start >= 0 ? extractBalanced(text, start, '{', '}') : ''
}

function extractFieldArray(text, field) {
  const match = new RegExp(`${field}\\s*:`).exec(text)
  if (!match) {
    return ''
  }
  const start = text.indexOf('[', match.index)
  return start >= 0 ? extractBalanced(text, start, '[', ']') : ''
}

function extractBalanced(text, start, open, close) {
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (quote) {
      escaped = char === '\\' ? !escaped : false
      if (char === quote && !escaped) {
        quote = ''
      }
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === open) {
      depth += 1
    } else if (char === close) {
      depth -= 1
      if (depth === 0) {
        return text.slice(start + 1, index)
      }
    }
  }
  return ''
}

function splitObjectBlocks(text) {
  const blocks = []
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') {
      continue
    }
    const block = extractBalanced(text, index, '{', '}')
    if (block) {
      blocks.push(block)
      index += block.length + 1
    }
  }
  return blocks
}

function extractStringField(text, field) {
  return text.match(STRING_FIELD_PATTERN(field))?.[2] || ''
}

function extractNumberField(text, field) {
  return text.match(new RegExp(`${field}\\s*:\\s*(-?\\d+)`))?.[1] || ''
}

function extractBooleanField(text, field) {
  const value = text.match(new RegExp(`${field}\\s*:\\s*(true|false)`))?.[1]
  return value ? value === 'true' : null
}

function extractRuleReg(text) {
  const stringReg = extractStringField(text, 'reg')
  if (stringReg) {
    return stringReg
  }
  return text.match(/reg\s*:\s*(\/.*?\/[gimsuy]*)/)?.[1] || ''
}
