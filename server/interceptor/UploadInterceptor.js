import multer from 'multer'
import {Interceptor, Result} from '#guoba.framework'
import {_paths} from '#guoba.platform'

const upload = multer({
  dest: 'data/upload_tmp/',
  limits: {
    fieldSize: 2 * 1024 * 1024,
    fields: 50,
    fileSize: 20 * 1024 * 1024,
    files: 4,
  },
})

const uploadPaths = [
  new RegExp('^/api/plugin/miao/help$'),
  new RegExp('^/api/plugin/miao/help/theme/action$'),
  new RegExp('^/api/plugin/miao/help/theme/action_put$'),
]

export default class UploadInterceptor extends Interceptor {
  handler(req, res, next) {
    if (req.method !== 'POST' || !this.isUploadPath(req)) {
      next()
      return
    }
    upload.any()(req, res, (error) => {
      if (error) {
        const result = Result.error('上传内容过大或格式不合法', 413)
        res.status(result.httpStatus).json(result.toJSON())
        return
      }
      next()
    })
  }

  isUploadPath(req) {
    const {realMountPrefix} = _paths.server
    let {path} = req
    if (path.startsWith(realMountPrefix)) {
      path = path.substring(realMountPrefix.length)
    }
    return uploadPaths.some(reg => reg.test(path))
  }

  static priority = 200
}
