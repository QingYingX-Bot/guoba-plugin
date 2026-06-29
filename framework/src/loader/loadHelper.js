import express from "express";

const REQUEST_BODY_LIMIT = '5mb'

/**
 * 一些辅助工具
 * @param {GuobaApplication} guobaApp
 */
export function useHelper(guobaApp) {
  const {app, _args} = guobaApp
  useJsonBigIntReplacer(app)
  const prefix = normalizePrefix(_args.prefix)
  if (_args.staticPath) {
    // 静态资源
    app.set('views', _args.staticPath)
    app.use(prefix, express.static(_args.staticPath))
  }
  // parse application/json
  app.use(prefix, markBodyAlreadyParsed)
  app.use(prefix, express.json({limit: REQUEST_BODY_LIMIT}))
  app.use(prefix, express.urlencoded({limit: REQUEST_BODY_LIMIT, extended: true}))
}

function useJsonBigIntReplacer(app) {
  const existingReplacer = app.get('json replacer')
  if (existingReplacer?.guobaBigIntSafe) {
    return
  }

  const replacer = (key, value) => {
    const nextValue = typeof existingReplacer === 'function'
      ? existingReplacer(key, value)
      : value
    return typeof nextValue === 'bigint' ? nextValue.toString() : nextValue
  }
  replacer.guobaBigIntSafe = true
  app.set('json replacer', replacer)
}

function markBodyAlreadyParsed(req, res, next) {
  if (req.body !== undefined && req.readable === false) {
    req._body = true
  }
  next()
}

function normalizePrefix(prefix) {
  prefix = String(prefix || '/').trim()
  if (!prefix.startsWith('/')) {
    prefix = '/' + prefix
  }
  return prefix.length > 1 && prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
}
