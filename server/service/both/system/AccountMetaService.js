import fs from 'fs'
import path from 'path'
import {Service} from '#guoba.framework'
import {_paths} from '#guoba.platform'

const DEFAULT_META = {remark: '', tags: [], defaultAccount: false}

export class AccountMetaService extends Service {
  constructor(app) {
    super(app)
    this.metaFile = path.join(_paths.data, 'guoba', 'account-meta.json')
  }

  get(uin) {
    const meta = this.read()[String(uin || '')]
    if (!meta) {
      return {...DEFAULT_META}
    }
    return {
      remark: String(meta.remark || ''),
      tags: Array.isArray(meta.tags) ? meta.tags.map(item => String(item)) : [],
      defaultAccount: meta.defaultAccount === true,
    }
  }

  update(uin, data = {}) {
    uin = String(uin || '').trim()
    if (!uin) {
      throw new Error('userId不能为空')
    }
    const all = this.read()
    all[uin] = {
      remark: String(data.remark || '').trim(),
      tags: Array.isArray(data.tags)
        ? data.tags.map(item => String(item).trim()).filter(Boolean)
        : [],
      defaultAccount: data.defaultAccount === true,
    }
    if (all[uin].defaultAccount) {
      for (const key of Object.keys(all)) {
        if (key !== uin) {
          all[key].defaultAccount = false
        }
      }
    }
    this.write(all)
    return all[uin]
  }

  read() {
    try {
      return JSON.parse(fs.readFileSync(this.metaFile, 'utf8')) || {}
    } catch {
      return {}
    }
  }

  write(data) {
    fs.mkdirSync(path.dirname(this.metaFile), {recursive: true})
    fs.writeFileSync(this.metaFile, JSON.stringify(data, null, 2), 'utf8')
  }
}
