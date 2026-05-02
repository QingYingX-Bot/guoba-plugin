import path from 'path'
import fs from 'fs'
import {YamlReader, GuobaError} from "#guoba.framework";
import {_paths} from "#guoba.platform";

export const configReader = new Map()

function resolveConfigPath(configPath) {
  const paths = Array.isArray(configPath) ? configPath : [configPath]
  const absolutePaths = paths.map((filePath) => path.join(_paths.root, filePath))
  const existedPath = absolutePaths.find((filePath) => fs.existsSync(filePath))
  if (existedPath) {
    return existedPath
  }

  const pathWithExistingDir = absolutePaths.find((filePath) => fs.existsSync(path.dirname(filePath)))
  return pathWithExistingDir ?? absolutePaths[0]
}

export function getConfigReader(key, configFile) {
  let reader = configReader.get(key)
  if (!reader) {
    let filePath = configFile[key]
    if (filePath) {
      filePath = resolveConfigPath(filePath)
      reader = new YamlReader(filePath, true)
      configReader.set(key, reader)
    } else {
      throw new GuobaError(`没有找到配置文件：${key}`)
    }
  }
  return reader
}
