// @weibaohui/dsh-webdav-server — user-management 凭据桥测试（node --test）。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'

const require = createRequire(import.meta.url)
const { createUmAuth, usersFile } = require('../src/um-auth.js')

// 造一个 user-management 用户库：alice 正常 / bob 禁用 / carol 开 TOTP
function makeHome() {
  const home = mkdtempSync(join(tmpdir(), 'dsh-umauth-'))
  const dir = join(home, 'user-management')
  mkdirSync(dir, { recursive: true })
  return home
}

function scryptRecord(password) {
  const salt = randomBytes(16).toString('hex')
  const passHash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex')
  return { salt, passHash }
}

function writeUsers(home, users) {
  writeFileSync(usersFile(home), JSON.stringify({ seq: users.length, users }))
}

const home = makeHome()
writeUsers(home, [
  { id: 'u1', username: 'alice', role: 'user', ...scryptRecord('alicepass') },
  { id: 'u2', username: 'bob', role: 'user', disabled: true, ...scryptRecord('bobpass') },
  { id: 'u3', username: 'carol', role: 'admin', totpSecret: 'JBSWY3DPEHPK3PXP', ...scryptRecord('carolpass') },
])

test('users.json 缺失 → unavailable（上层回退令牌）', () => {
  const emptyHome = makeHome()
  const um = createUmAuth({ home: emptyHome })
  assert.equal(um.availability(), 'missing')
  const r = um.check('alice', 'alicepass')
  assert.equal(r.ok, false)
  assert.equal(r.unavailable, true)
  assert.equal(existsSync(usersFile(emptyHome)), false)
})

test('合法用户：正确密码 ok，错误密码拒绝', () => {
  const um = createUmAuth({ home })
  assert.equal(um.availability(), 'ok')
  assert.deepEqual(um.check('alice', 'alicepass').ok, true)
  const r = um.check('alice', 'wrong-password')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'bad-password')
})

test('disabled 与 TOTP 账号拒绝（reason 细分供日志）', () => {
  const um = createUmAuth({ home })
  assert.equal(um.check('bob', 'bobpass').reason, 'disabled')
  assert.equal(um.check('carol', 'carolpass').reason, 'totp')
  assert.equal(um.check('nobody', 'whatever123').reason, 'no-user')
})

test('判定缓存：正结果在 TTL 内即便用户被删也命中', () => {
  const um = createUmAuth({ home })
  assert.equal(um.check('alice', 'alicepass').ok, true)
  // 删掉 alice（mtime 变化触发 users.json 重载，但判定缓存仍在）
  writeUsers(home, [{ id: 'u2', username: 'bob', role: 'user', disabled: true, ...scryptRecord('bobpass') }])
  assert.equal(um.check('alice', 'alicepass').ok, true, '5 分钟内命中缓存')
  um.resetCache()
  assert.notEqual(um.check('alice', 'alicepass').ok, true, '清缓存后按新用户库判定')
})

test('文件损坏 → unavailable', () => {
  const broken = makeHome()
  writeFileSync(usersFile(broken), '{not-json')
  const um = createUmAuth({ home: broken })
  assert.equal(um.availability(), 'missing')
  assert.equal(um.check('alice', 'x').unavailable, true)
})
