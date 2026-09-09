'use strict'

/**
 * @weibaohui/dsh-webdav-server — user-management 凭据桥（宿主无关，可直测）。
 *
 * authMode='user-management' 时，挂载客户端的用户名/密码直接对
 * user-management 的用户库验证，省一套独立账号。user-management 的口令是
 * crypto.scrypt（salt + hex hash，N=16384/r=8），users.json 在
 * `<dshHome>/user-management/users.json`——格式跨仓复刻（user-management
 * 不是 npm 依赖，require 不到；改动其哈希格式时此处要跟）。
 *
 * scrypt 单次约几十毫秒，而 WebDAV 客户端每个请求都重发 Basic 凭据，
 * 所以带两层缓存：
 *  - users.json 按 mtime+size 缓存（文件没变不重读）；
 *  - 凭据判定结果缓存（sha256(用户名\0密码) 为键，绝不存明文）：命中正
 *    结果 5 分钟、负结果 30 秒（改密码后旧行为快速收敛），超容量整体清空。
 *
 * 语义对齐 user-management 登录策略：disabled 账号拒绝；开启 TOTP 的账号
 * 拒绝（Basic 认证无处输入动态码，与其静默降级不如明确 401，提示换令牌
 * 模式）。users.json 缺失/损坏返回 {ok:false, unavailable:true}，上层据此
 * 回退令牌兜底，避免接了 UM 却把人锁死在外面。
 */

const fs = require('node:fs')
const { createHash, scryptSync, timingSafeEqual } = require('node:crypto')
const { join } = require('node:path')

const KEY_LEN = 32
const SCRYPT_COST = 16384
const POSITIVE_TTL_MS = 5 * 60 * 1000
const NEGATIVE_TTL_MS = 30 * 1000
const CACHE_MAX = 500
// 与 user-management 登录同款：缺失用户也烧一次哈希时间，防用户名枚举
const DUMMY_SALT = '0'.repeat(32)
const DUMMY_HASH = '0'.repeat(64)

function dshHome() {
  return process.env.DSH_HOME ? require('node:path').resolve(process.env.DSH_HOME) : join(require('node:os').homedir(), '.dsh')
}

function usersFile(home) {
  return join(home || dshHome(), 'user-management', 'users.json')
}

/** user-management store.verifyPassword 的跨仓复刻（scrypt N=16384/r=8/p=1）。 */
function verifyScrypt(record, password) {
  if (!record || !record.salt || !record.passHash || typeof password !== 'string') return false
  let expected
  try {
    expected = Buffer.from(record.passHash, 'hex')
  } catch {
    return false
  }
  let derived
  try {
    derived = scryptSync(password, record.salt, KEY_LEN, { N: SCRYPT_COST, r: 8, p: 1 })
  } catch {
    return false
  }
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

function burnHash(password) {
  try {
    scryptSync(password, DUMMY_SALT, KEY_LEN, { N: SCRYPT_COST, r: 8, p: 1 })
  } catch {}
}

/**
 * 创建凭据检查器。
 * check(username, password) → { ok, reason?, unavailable? }
 *   reason: 'no-user' | 'disabled' | 'totp'（失败细分只进日志，HTTP 侧统一 401）
 */
function createUmAuth({ home, now = () => Date.now() } = {}) {
  let cacheUsers = null
  let cacheStamp = null
  const verdicts = new Map()

  function loadUsers() {
    const file = usersFile(home)
    let stamp = null
    try {
      const st = fs.statSync(file)
      stamp = `${st.mtimeMs}:${st.size}`
    } catch {
      cacheUsers = null
      cacheStamp = null
      return null
    }
    if (stamp === cacheStamp && cacheUsers) return cacheUsers
    try {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
      const users = Array.isArray(doc && doc.users) ? doc.users : null
      if (!users) {
        cacheUsers = null
        cacheStamp = null
        return null
      }
      cacheUsers = users
      cacheStamp = stamp
      return users
    } catch {
      cacheUsers = null
      cacheStamp = null
      return null
    }
  }

  /** 用户库可用性：'ok' | 'missing'（缺失/损坏，上层回退令牌）。 */
  function availability() {
    return loadUsers() ? 'ok' : 'missing'
  }

  function cachedVerdict(key) {
    const hit = verdicts.get(key)
    if (!hit) return null
    if (now() > hit.expiresAt) {
      verdicts.delete(key)
      return null
    }
    return hit
  }

  function storeVerdict(key, ok) {
    if (verdicts.size >= CACHE_MAX) verdicts.clear()
    verdicts.set(key, { ok, expiresAt: now() + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) })
  }

  function check(username, password) {
    if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
      return { ok: false }
    }
    const users = loadUsers()
    if (!users) return { ok: false, unavailable: true }

    const key = createHash('sha256').update(username + '\0' + password).digest('hex')
    const hit = cachedVerdict(key)
    if (hit) return { ok: hit.ok }

    const user = users.find((u) => u && u.username === username)
    let ok = false
    let reason
    if (!user) {
      burnHash(password)
      reason = 'no-user'
    } else if (user.disabled) {
      burnHash(password)
      reason = 'disabled'
    } else if (user.totpSecret) {
      // Basic 认证无法输入动态码：与 UM 登录策略一致，明确拒绝
      burnHash(password)
      reason = 'totp'
    } else {
      ok = verifyScrypt(user, password)
      if (!ok) reason = 'bad-password'
    }
    storeVerdict(key, ok)
    return { ok, reason }
  }

  function resetCache() {
    cacheUsers = null
    cacheStamp = null
    verdicts.clear()
  }

  return { check, availability, resetCache }
}

module.exports = { createUmAuth, usersFile, verifyScrypt, dshHome }
