import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

/**
 * 工具类Controller
 */
export default class HelperController extends ApiController {

  helperService = autowired('helperService')

  constructor(guobaApp) {
    super('/helper', guobaApp)
  }

  registerRouters() {
    // 中转请求，绕过跨域和防盗链
    this.all('/transit', this.transitRequest)
    // 本地尝试释放端口
    // 假设用户关闭yunzai时，没有关干净，导致端口号被异常占用
    // 此时另一方启动的锅巴可以尝试调用此接口，来关闭当前的端口占用
    // 安全性：仅限 localhost 访问
    this.delete('/release_port', this.tryReleasePort)
  }

  transitRequest(req, res) {
    return this.helperService.transitRequest(req, res)
  }

  tryReleasePort(req) {
    if (req.hostname !== 'localhost') {
      return Result.noAuth()
    }
    logger.mark('[Guoba] 服务已在另一处启动，正在尝试停止当前服务……')
    setTimeout(() => {
      Guoba.server.close(err => {
        if (err) {
          logger.mark('[Guoba] 服务停止失败')
          logger.error(err)
        } else {
          logger.mark('[Guoba] 已停止当前服务，您如果想要多开锅巴，请更改不同的端口号~')
        }
      })
    }, 10)
    return Result.ok()
  }
}
