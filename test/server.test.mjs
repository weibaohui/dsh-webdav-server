// @weibaohui/dsh-webdav-server — 引擎与全链路协议测试（node --test）。
// 直接驱动 src/server.js 装配真实 express+nephele 监听器（随机端口），
// 按 WebDAV 客户端视角走 PROPFIND/GET/PUT/MKCOL/COPY/MOVE/DELETE。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const engine = require('../src/server.js')

// 隔离 dshHome：默认共享根/token 文件测试都落临时目录
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-webdav-'))

function authHeader(token, user = 'dsh') {
  return 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64')
}

/** 监听器刚就绪的瞬间偶发 fetch 抖动，重试一次保 CI 稳定。 */
async function fetchRetry(url, opts = {}, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, opts)
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 150))
    }
  }
  throw last
}

async function boot(overrides = {}) {
  const root = overrides.__root || mkdtempSync(join(tmpdir(), 'webdav-root-'))
  const cfg = engine.normalizeConfig({
    host: '127.0.0.1',
    port: 0,
    token: 'test-token',
    ...overrides,
    root,
  })
  delete cfg.__root
  const extra = typeof overrides.__verify === 'function' ? { verify: overrides.__verify } : {}
  delete overrides.__verify
  const { app } = await engine.createWebdavApp({ ...cfg, root, ...extra })
  const server = await engine.startListener(app, cfg)
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  // 就绪探测：'listening' 事件后内核 backlog 首连在 macOS 高负载下偶发
  // ECONNRESET，探测通了才返回，消掉整类首请求抖动
  for (let i = 0; ; i++) {
    try {
      const probe = await fetch(base + '/', { method: 'OPTIONS' })
      assert.ok(probe.status > 0)
      break
    } catch (e) {
      if (i >= 25) throw e
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  return { server, base, root, cfg, close: () => engine.closeServer(server) }
}

test('resolveRootDir：空值回默认根、~ 展开、相对路径拒绝', () => {
  const def = engine.resolveRootDir('')
  assert.equal(def, engine.defaultRoot())
  assert.ok(def.startsWith(process.env.DSH_HOME), '默认根应落在 DSH_HOME 下')
  assert.equal(engine.resolveRootDir('~/foo'), join(homedir(), 'foo'))
  assert.equal(engine.resolveRootDir('relative/path'), null)
  assert.equal(engine.resolveRootDir('/abs/dir'), '/abs/dir')
})

test('sanitizePatch：白名单 + 夹取', () => {
  const out = engine.sanitizePatch({
    enabled: 'yes', port: 80, host: 'bad host!', root: ' /tmp/x ', token: ' t ', evil: 1,
    readOnly: true, followLinks: false, authMode: 'nonsense',
  }, { enabled: true, host: '0.0.0.0', port: 19087, authMode: 'token' })
  assert.deepEqual(out, {
    enabled: true, // 非真布尔 → 兜底 base 值，绝不吃进垃圾串
    port: 1024,
    host: '0.0.0.0', // 非法 host 保留 base
    root: '/tmp/x',
    token: 't',
    authMode: 'token', // 非法枚举保留 base
    readOnly: true,
    followLinks: false,
  })
  assert.equal(engine.sanitizePatch({ authMode: 'user-management' }, {}).authMode, 'user-management')
})

test('自定义 verify 回调：user-management 凭据桥接入点', async () => {
  const { base, close } = await boot({
    __verify: async (username, password) => ({ ok: username === 'alice' && password === 'alicepass' }),
  })
  try {
    const alice = { Authorization: authHeader('alicepass', 'alice') }
    assert.equal((await fetchRetry(base + '/', { method: 'PROPFIND', headers: { ...alice, Depth: '0' } })).status, 207)
    assert.equal((await fetchRetry(base + '/', { method: 'PROPFIND', headers: { Authorization: authHeader('alicepass', 'mallory'), Depth: '0' } })).status, 401)
    // 令牌在 UM 模式语义下不再放行（verify 只认 UM 凭据）
    assert.equal((await fetchRetry(base + '/', { method: 'PROPFIND', headers: { Authorization: authHeader('test-token'), Depth: '0' } })).status, 401)
  } finally {
    await close()
  }
})

test('normalizeConfig：脏配置兜底', () => {
  const cfg = engine.normalizeConfig({ port: 'abc', host: 'x y', enabled: 'nope' })
  assert.equal(cfg.port, engine.DEFAULTS.port)
  assert.equal(cfg.host, engine.DEFAULTS.host)
  assert.equal(cfg.enabled, engine.DEFAULTS.enabled)
})

test('timingSafeEqualStr：等与不等', () => {
  assert.equal(engine.timingSafeEqualStr('abc', 'abc'), true)
  assert.equal(engine.timingSafeEqualStr('abc', 'abd'), false)
  assert.equal(engine.timingSafeEqualStr('abc', 'very-different-length'), false)
})

test('WebDAV 全链路：认证门禁 + PROPFIND/PUT/GET/MKCOL/COPY/MOVE/DELETE', async () => {
  const { server, base, root, close } = await boot()
  try {
    // 无认证 → 401
    const denied = await fetch(base + '/', { method: 'PROPFIND', headers: { Depth: '0' } })
    assert.equal(denied.status, 401)
    assert.match(denied.headers.get('www-authenticate') || '', /Basic/i)

    // Class 2 合规（DAV: 1, 2）——macOS mount_webdav 对 Class 1 强制只读挂载
    const options = await fetch(base + '/', { method: 'OPTIONS' })
    assert.equal(options.status, 200)
    const davHeader = options.headers.get('dav') || ''
    assert.match(davHeader, /\b2\b/, `DAV header 应含 Class 2（LOCK），实际: ${davHeader}`)

    const auth = { Authorization: authHeader('test-token') }

    // PROPFIND 根集合 → 207
    const prop0 = await fetch(base + '/', { method: 'PROPFIND', headers: { ...auth, Depth: '0' } })
    assert.equal(prop0.status, 207)

    // PUT 新文件 → 2xx；GET 回读
    const put = await fetch(base + '/hello.txt', { method: 'PUT', headers: auth, body: '你好 WebDAV' })
    assert.ok(put.status >= 200 && put.status < 300, `PUT status ${put.status}`)
    const get = await fetch(base + '/hello.txt', { headers: auth })
    assert.equal(get.status, 200)
    assert.equal(await get.text(), '你好 WebDAV')

    // MKCOL → 2xx；子目录写读
    const mkcol = await fetch(base + '/sub', { method: 'MKCOL', headers: auth })
    assert.ok(mkcol.status >= 200 && mkcol.status < 300, `MKCOL status ${mkcol.status}`)
    const put2 = await fetch(base + '/sub/a.txt', { method: 'PUT', headers: auth, body: 'in-sub' })
    assert.ok(put2.status >= 200 && put2.status < 300)

    // COPY（Destination 为绝对 URL，Windows/raDrive 风格）
    const copy = await fetch(base + '/hello.txt', {
      method: 'COPY', headers: { ...auth, Destination: `${base}/sub/b.txt` },
    })
    assert.ok(copy.status >= 200 && copy.status < 300, `COPY status ${copy.status}`)
    assert.equal(await (await fetch(base + '/sub/b.txt', { headers: auth })).text(), '你好 WebDAV')

    // MOVE
    const move = await fetch(base + '/sub/b.txt', {
      method: 'MOVE', headers: { ...auth, Destination: `${base}/sub/c.txt` },
    })
    assert.ok(move.status >= 200 && move.status < 300, `MOVE status ${move.status}`)
    assert.equal(existsSync(join(root, 'sub', 'b.txt')), false)
    assert.equal(existsSync(join(root, 'sub', 'c.txt')), true)

    // PROPFIND Depth 1 列目录 → 207 且包含已写文件
    const prop1 = await fetch(base + '/sub/', { method: 'PROPFIND', headers: { ...auth, Depth: '1' } })
    assert.equal(prop1.status, 207)
    const xml = await prop1.text()
    assert.match(xml, /c\.txt/)

    // DELETE → 2xx
    const del = await fetch(base + '/sub/c.txt', { method: 'DELETE', headers: auth })
    assert.ok(del.status >= 200 && del.status < 300, `DELETE status ${del.status}`)
    assert.equal(existsSync(join(root, 'sub', 'c.txt')), false)

    // 错误令牌 → 401
    const bad = await fetch(base + '/hello.txt', { headers: { Authorization: authHeader('wrong') } })
    assert.equal(bad.status, 401)
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('只读模式：写操作 403，读不受影响', async () => {
  const root = mkdtempSync(join(tmpdir(), 'webdav-ro-'))
  writeFileSync(join(root, 'r.txt'), 'only-read')
  const { base, close } = await boot({ __root: root, readOnly: true })
  try {
    const auth = { Authorization: authHeader('test-token') }
    assert.equal((await fetchRetry(base + '/r.txt', { headers: auth })).status, 200)
    const put = await fetch(base + '/new.txt', { method: 'PUT', headers: auth, body: 'x' })
    assert.equal(put.status, 403)
    const del = await fetch(base + '/r.txt', { method: 'DELETE', headers: auth })
    assert.equal(del.status, 403)
    assert.equal(existsSync(join(root, 'r.txt')), true)
  } finally {
    await close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('共享根自动创建 + 指纹函数', async () => {
  const fresh = join(process.env.DSH_HOME, 'made-by-test', 'share')
  assert.equal(existsSync(fresh), false)
  assert.equal(engine.ensureRootDir(fresh), null)
  assert.equal(existsSync(fresh), true)

  const fp = engine.serverFingerprint({ ...engine.DEFAULTS })
  assert.equal(fp, engine.serverFingerprint({ ...engine.DEFAULTS }))
  assert.notEqual(fp, engine.serverFingerprint({ ...engine.DEFAULTS, port: 19088 }))
})

test('generateToken：base64url 且不重复', () => {
  const a = engine.generateToken()
  const b = engine.generateToken()
  assert.match(a, /^[A-Za-z0-9_-]+$/)
  assert.notEqual(a, b)
  assert.ok(a.length >= 20)
})
