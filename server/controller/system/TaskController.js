import {autowired, Result} from '#guoba.framework'
import {ApiController} from '#guoba.platform'

export class TaskController extends ApiController {
  pluginTaskService = autowired('pluginTaskService')
  taskService = autowired('taskService')

  constructor(guobaApp) {
    super('/tasks', guobaApp)
  }

  registerRouters() {
    this.get('/', this.queryTasks)
    this.get('/plugin/records', this.queryPluginTaskRecords)
    this.get('/plugin', this.queryPluginTasks)
    this.get('/:id', this.getTask)
  }

  async queryTasks(req) {
    return Result.ok(await this.taskService.query(req.query || {}))
  }

  async queryPluginTasks(req) {
    return Result.ok(this.pluginTaskService.query(req.query || {}))
  }

  async queryPluginTaskRecords(req) {
    return Result.ok(this.pluginTaskService.queryRecords(req.query || {}))
  }

  async getTask(req) {
    const task = await this.taskService.get(req.params.id)
    if (!task) {
      return Result.error(404, '任务不存在')
    }
    return Result.ok(task)
  }
}
