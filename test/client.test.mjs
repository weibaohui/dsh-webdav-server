// @weibaohui/dsh-webdav-server — 客户端半契约测试（node --test）。
// 无 react / primitives 平台模块时走 shim，校验模块结构、locale 对齐、
// settings.section slot 注册与 API 路径约定。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const client = require('../client/index.js')

test('模块契约：名称/inject/内部导出', () => {
  assert.equal(client.name, '@weibaohui/dsh-webdav-server')
  assert.deepEqual(client.inject, ['slots', 'locale'])
  assert.equal(typeof client.__boot, 'function')
  assert.equal(typeof client.apply, 'function')
  assert.ok(client.__internals && client.__internals.NS === 'dshWebdavServer')
})

test('locale：zh/en 键集合一致且无空串', () => {
  const { ZH, EN } = client.__internals
  const zhKeys = Object.keys(ZH).sort()
  const enKeys = Object.keys(EN).sort()
  assert.deepEqual(zhKeys, enKeys)
  for (const [k, v] of Object.entries(ZH)) {
    assert.equal(typeof v, 'string')
    assert.ok(v.length > 0, `ZH.${k} 不应为空`)
    assert.ok(EN[k] && EN[k].length > 0, `EN.${k} 不应为空`)
  }
})

test('apply：注册 settings.section slot 并走 ctx.effect', () => {
  const effects = []
  let registered = null
  const ctx = {
    locale: { register() {}, bind: () => null },
    effect(fn, label) { effects.push(label); fn() },
    slots: {
      inject(slot, register) { register() },
      register(def, comp) { registered = def; return comp },
    },
  }
  client.apply(ctx)
  assert.ok(registered, 'slot 未注册')
  assert.equal(registered.name, 'settings.section')
  assert.equal(registered.id, '@weibaohui/dsh-webdav-server')
  assert.equal(registered.locale, 'dshWebdavServer')
  assert.equal(typeof registered.label, 'function')
  assert.equal(registered.label(), 'WebDAV 服务器')
  assert.ok(effects.includes('dsh-webdav-server: settings section'))
})

test('API 前缀约定：/dsh-webdav-server/api（客户端与宿主半一致）', () => {
  const clientSrc = readFileSync(new URL('../client/index.js', import.meta.url), 'utf8')
  const hostSrc = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  const engineSrc = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.ok(clientSrc.includes("const API = '/dsh-webdav-server/api'"), '客户端 API 前缀')
  assert.ok(engineSrc.includes("const PLUGIN_ID = 'dsh-webdav-server'"), '引擎 PLUGIN_ID')
  assert.ok(hostSrc.includes("require('./server')"), '宿主半复用引擎 PLUGIN_ID')
})
