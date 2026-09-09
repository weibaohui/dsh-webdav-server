'use strict'

/**
 * @weibaohui/dsh-webdav-server — WebDAV 引擎（宿主无关）。
 *
 * 职责：配置解析/清洗 + express/nephele 装配 + 监听器生命周期。
 * 不接触 cordis 宿主（ctx），全部能力经参数进出，便于 node --test 直测。
 *
 * 引擎选型：nephele（RFC4918 全量实现的 Express 中间件）+ 官方
 * adapter-file-system（物理文件系统后端）+ authenticator-custom（自接令牌
 * Basic 认证）。四个包均锁死同一 alpha 版本（nephele 1.0 前API可能变动，
 * 锁版本防漂移）。只读模式不官方 plugin-read-only——它对所有写方法抛 401
 * （会诱发客户端无限重输名），自绘 express 中间件给干净的 403。
 *
 * 目录语义：共享根是一个「固定目录」（挂载盘需要稳定根，与 file-share 的
 * 每会话工作区不同），默认落在 dshHome()/dsh-webdav-server/share，
 * settings 一条配置可换成任意绝对路径（支持 ~ 展开）。
 */

const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')

const VERSION = '0.1.0'
const PLUGIN_ID = 'dsh-webdav-server'

// 与 settingsSchema / sanitizePatch 共用同一份，防止漂移。
const DEFAULTS = Object.freeze({
  enabled: true,
  // 空 = 默认共享根（dshHome()/dsh-webdav-server/share）
  root: '',
  host: '0.0.0.0',
  port: 19087,
  // 空 = 首次启动自动生成并持久化（settings 服务或 token 文件）
  token: '',
  // 认证模式：'token'（独立令牌）| 'user-management'（复用 UM 登录账号密码）
  authMode: 'token',
  readOnly: false,
  followLinks: true,
})

const NUM_RANGES = Object.freeze({ port: [1024, 65535] })
const BOOL_KEYS = Object.freeze(['enabled', 'readOnly', 'followLinks'])
const AUTH_MODES = Object.freeze(['token', 'user-management'])
// 只读放行的全部方法（读语义）；其余一律 403
const READ_METHODS = Object.freeze(['GET', 'HEAD', 'OPTIONS', 'PROPFIND'])

function dshHome() {
  return process.env.DSH_HOME ? path.resolve(process.env.DSH_HOME) : path.join(os.homedir(), '.dsh')
}

function defaultRoot() {
  return path.join(dshHome(), PLUGIN_ID, 'share')
}

function tokenFile() {
  return path.join(dshHome(), PLUGIN_ID, 'token')
}

/** 展开 ~ 与 ~/ 前缀；空值返回默认共享根；相对路径拒绝（返回 null）。 */
function resolveRootDir(raw) {
  let p = typeof raw === 'string' ? raw.trim() : ''
  if (!p) return defaultRoot()
  if (p === '~') p = os.homedir()
  else if (p.startsWith('~/') || p.startsWith('~\\')) p = path.join(os.homedir(), p.slice(2))
  if (!path.isAbsolute(p)) return null
  return path.normalize(p)
}

/** 定长摘要比较：长度不一致时普通比较会提前返回，先各自 sha256 再比。 */
function timingSafeEqualStr(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function generateToken() {
  return crypto.randomBytes(18).toString('base64url')
}

function clampNum(v, [min, max], fallback) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function cleanStr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function cleanBool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback
}

/**
 * 设置清洗（PUT /settings 白名单 + 手改 settings.yaml 的防御性夹取）：
 * 未知键丢弃；布尔只收真布尔；端口夹取进范围；host 只收合法主机字符。
 */
function sanitizePatch(patch, base) {
  const out = {}
  if (!patch || typeof patch !== 'object') return out
  const b = base || DEFAULTS
  for (const k of BOOL_KEYS) {
    if (k in patch) out[k] = cleanBool(patch[k], b[k] !== undefined ? b[k] : DEFAULTS[k])
  }
  if ('port' in patch) out.port = clampNum(patch.port, NUM_RANGES.port, b.port)
  for (const k of ['root', 'token']) {
    if (k in patch) out[k] = cleanStr(patch[k])
  }
  if ('authMode' in patch) {
    out.authMode = AUTH_MODES.includes(patch.authMode) ? patch.authMode : b.authMode || DEFAULTS.authMode
  }
  if ('host' in patch) {
    const host = cleanStr(patch.host)
    out.host = /^[a-zA-Z0-9.:\-_]+$/.test(host) ? host : cleanStr(b.host) || DEFAULTS.host
  }
  return out
}

/** 合并 + 夹取成最终生效配置（settings.yaml 手改脏值也在这层兜住）。 */
function normalizeConfig(raw) {
  const merged = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
  return {
    enabled: cleanBool(merged.enabled, DEFAULTS.enabled),
    root: cleanStr(merged.root),
    host: /^[a-zA-Z0-9.:\-_]+$/.test(cleanStr(merged.host)) ? cleanStr(merged.host) : DEFAULTS.host,
    port: clampNum(merged.port, NUM_RANGES.port, DEFAULTS.port),
    token: cleanStr(merged.token),
    authMode: AUTH_MODES.includes(merged.authMode) ? merged.authMode : DEFAULTS.authMode,
    readOnly: cleanBool(merged.readOnly, DEFAULTS.readOnly),
    followLinks: cleanBool(merged.followLinks, DEFAULTS.followLinks),
  }
}

/** 重建判据：任一项变化都需重建监听器/中间件。 */
function serverFingerprint(cfg) {
  return [cfg.enabled, cfg.root, cfg.host, cfg.port, cfg.token, cfg.authMode, cfg.readOnly, cfg.followLinks].join('|')
}

/** 共享根不存在则创建（含中间层）；失败返回错误对象。 */
function ensureRootDir(root) {
  try {
    fs.mkdirSync(root, { recursive: true })
    return null
  } catch (e) {
    return e
  }
}

function lanIPv4() {
  const ifaces = os.networkInterfaces()
  for (const list of Object.values(ifaces)) {
    for (const it of list || []) {
      if (it && it.family === 'IPv4' && !it.internal) return it.address
    }
  }
  return null
}

/**
 * 装配 express + nephele 应用。nephele 家族是 ESM-only，CJS 侧统一动态
 * import（Express 本体是 CJS，同样走 import 拿 default，省两套写法）。
 * properties 用 disallow：挂载客户端不需要 dead properties，拒掉最省心。
 * 锁走 meta-files：macOS mount_webdav 对 Class 1 服务器强制只读挂载
 * （man mount_webdav 原文），LOCK/UNLOCK 必须在，写挂载才成立。
 */
async function createWebdavApp(cfg) {
  const [expressMod, nepheleMod, adapterMod, authMod] = await Promise.all([
    import('express'),
    import('nephele'),
    import('@nephele/adapter-file-system'),
    import('@nephele/authenticator-custom'),
  ])
  const express = expressMod.default
  const nepheleServer = nepheleMod.default
  const FileSystemAdapter = adapterMod.default.Adapter || adapterMod.default
  const CustomAuthenticator = authMod.default.Authenticator || authMod.default
  const User = authMod.User

  const adapter = new FileSystemAdapter({
    root: cfg.root,
    followLinks: cfg.followLinks,
    properties: 'disallow',
    // 锁必须开（meta-files）：macOS mount_webdav/Finder 对 Class 1 服务器
    // 强制 rdonly（man 原文），写挂载依赖 LOCK/UNLOCK；代价是共享目录里
    // 可能出现 .nephelemeta 锁元数据文件（勿删）
    locks: 'meta-files',
  })

  // 用户名先放行到 authBasic（getUser 返回占位 User，存在性判定在 verify 里），
  // verify(username, password) 由宿主半注入：令牌直查或 user-management 桥。
  // 统一返回 { ok } 对象（裸布尔会在 authBasic 的 r.ok 判定上翻车）。
  const verify = typeof cfg.verify === 'function'
    ? cfg.verify
    : async (_u, p) => ({ ok: timingSafeEqualStr(p, cfg.token) })
  const authenticator = new CustomAuthenticator({
    realm: 'dsh WebDAV',
    getUser: async (username) => new User({ username: cleanStr(username) || 'dsh' }),
    authBasic: async (user, password) => {
      const r = await verify(user.username, password)
      return Boolean(r && r.ok)
    },
  })

  const app = express()
  app.disable('x-powered-by')
  if (cfg.readOnly) {
    // 403 而非 401：客户端已认证，重输名解决不了「只读共享」
    app.use('/', (req, res, next) => {
      if (!READ_METHODS.includes(req.method)) {
        res.status(403).set('allow', READ_METHODS.join(', ')).json({ message: 'Share is read-only.' })
        return
      }
      next()
    })
  }
  app.use('/', nepheleServer({ adapter, authenticator, plugins: [] }))
  return { app }
}

/** 独立监听器：挂载客户端走这个端口，与宿主 web 同源服务互不相干。 */
function startListener(app, cfg) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    // 默认 5 分钟请求超时会掐断大文件上传/下载（nephele README 同款建议）
    server.requestTimeout = 30 * 60 * 1000
    // 默认 5s keep-alive 太激进：Apple 客户端 OPTIONS 后走 NetAuth IPC 取凭据
    // 常超 5s，连接被关会让它放弃整个挂载序列；Finder/davfs2 操作间隙也会闲置
    server.keepAliveTimeout = 120 * 1000
    server.headersTimeout = 125 * 1000
    server.once('error', reject)
    server.listen(cfg.port, cfg.host, () => resolve(server))
  })
}

/** 关闭监听器并踢掉 keep-alive 连接（WebDAV 客户端长连接会让 close 挂住）。 */
function closeServer(server) {
  if (!server) return Promise.resolve()
  return new Promise((resolve) => {
    try {
      server.closeAllConnections()
    } catch {}
    server.close(() => resolve())
  })
}

/** 启动失败的用户向文案（EADDRINUSE 最常见）。 */
function startErrorText(e) {
  if (e && (e.code === 'EADDRINUSE' || /EADDRINUSE/.test(String(e.message)))) {
    return `端口 ${e.port || ''} 已被占用，请在设置里换一个端口`
  }
  if (e && e.code === 'EACCES') return '端口被系统保护（1024 以下需特权），请换 1024 以上的端口'
  return '启动失败: ' + String((e && e.message) || e)
}

module.exports = {
  VERSION,
  PLUGIN_ID,
  DEFAULTS,
  NUM_RANGES,
  BOOL_KEYS,
  AUTH_MODES,
  dshHome,
  defaultRoot,
  tokenFile,
  resolveRootDir,
  timingSafeEqualStr,
  generateToken,
  sanitizePatch,
  normalizeConfig,
  serverFingerprint,
  ensureRootDir,
  lanIPv4,
  createWebdavApp,
  startListener,
  closeServer,
  startErrorText,
}
