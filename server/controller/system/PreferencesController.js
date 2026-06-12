import fs from 'fs'
import path from 'path'
import {autowired, Result} from '#guoba.framework'
import {ApiController, _paths} from '#guoba.platform'

/**
 * UI 偏好设置 API
 * 用于保存和读取前端 UI 偏好设置（主题、布局、侧边栏等）
 */
export default class PreferencesController extends ApiController {

  constructor(guobaApp) {
    super('/preferences', guobaApp)
  }

  registerRouters() {
    this.get('/ui', this.getUiPreferences)
    this.post('/ui', this.saveUiPreferences)
  }

  getFilePath() {
    return path.join(_paths.pluginRoot, 'config', 'ui-preferences.json')
  }

  /** 获取已保存的 UI 偏好设置 */
  async getUiPreferences() {
    try {
      const filePath = this.getFilePath()
      if (!fs.existsSync(filePath)) {
        return Result.ok({})
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      return Result.ok(data)
    } catch (e) {
      logger.error('[Guoba] 读取 UI 偏好设置失败', e)
      return Result.ok({})
    }
  }

  /** 保存 UI 偏好设置 */
  async saveUiPreferences(req) {
    try {
      const data = req.body
      const filePath = this.getFilePath()
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return Result.ok('偏好设置保存成功~')
    } catch (e) {
      logger.error('[Guoba] 保存 UI 偏好设置失败', e)
      return Result.error('保存失败')
    }
  }

}
