import fs from 'fs'
import path from 'path'
import {GitTools} from '#guoba.framework'
import {_paths, GitRepoMap} from '#guoba.platform'
import {applyGithubProxy, mkdirSync} from './common.js'

const repos = [
  {
    name: 'PluginsIndex', 
    url: 'https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index.git', 
    fallbackUrl: 'https://github.com/yhArcadia/Yunzai-Bot-plugins-index.git'
  },
  // {name: 'GuobaTest', url: 'https://gitee.com/guoba-yunzai/test.git'},
]

const legacyRepoPath = path.join(_paths.pluginRoot, 'data/repo')
export const repoPath = path.join(_paths.pluginRoot, 'data/cache/repos')

function migrateLegacyRepo(name, directory) {
  const legacyDirectory = path.join(legacyRepoPath, name)
  if (fs.existsSync(directory) || !fs.existsSync(legacyDirectory)) {
    return
  }
  try {
    fs.renameSync(legacyDirectory, directory)
    globalThis.logger?.mark?.(`[Guoba] 已迁移插件索引缓存：${legacyDirectory} -> ${directory}`)
  } catch (error) {
    globalThis.logger?.warn?.(`[Guoba] 迁移插件索引缓存失败，将重新初始化：${error.message}`)
  }
}

export function initRepos() {
  mkdirSync(repoPath)
  for (let {name, url, fallbackUrl} of repos) {
    const directory = path.join(repoPath, name)
    migrateLegacyRepo(name, directory)
    const tools = new GitTools(directory, url, {
      strictMode: true,
      immediateClone: true,
      fallbackUrl: fallbackUrl ? applyGithubProxy(fallbackUrl) : fallbackUrl
    })
    GitRepoMap.set(name, tools)
  }
}

/**
 *
 * @param key
 * @return {Promise<GitTools>}
 */
export async function get(key) {
  const repo = GitRepoMap.get(key)
  if (repo?.initPromise) {
    await repo.initPromise
  }
  return repo
}

export function getPluginsIndex() {
  return get('PluginsIndex')
}
