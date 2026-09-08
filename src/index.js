'use strict'

/**
 * @weibaohui/dsh-webdav-server — Host half（cordis 宿主接线）。
 *
 * 三件事：
 *  1. settings 服务注册 schema（settings.yaml 的 dsh-webdav-server 节 +
 *     设置 UI 可覆盖，3s 内热生效——reconciler 指纹比对自动重建监听器）；
 *  2. 独立 WebDAV 监听器生命周期：配置/令牌/根目录任一变化 → 重建
 *     （express + nephele 装配在 src/server.js，这里只做协调）；
 *  3. 同源路由 /dsh-webdav-server/api/*（status/settings/token）给宿主
 *     设置页用——认证由宿主 web 门禁负责，此处不重复做。
 *
 * 共享根目录是「固定目录」语义（挂载盘需要稳定根），默认
 * dshHome()/dsh-webdav-server/share，settings.root 一条配置可指到任意
 * 绝对路径（支持 ~）。访问令牌首次启动自动生成并持久化。
 */

const fs = require('node:fs')
const path = require('node:path')

const engine = require('./server')

const name = engine.PLUGIN_ID
const inject = ['webServer', 'settings']
const API_PREFIX = '/' + engine.PLUGIN_ID + '/api'
const SETTINGS_NS = engine.PLUGIN_ID

// ── schemastery 加载（settings 服务同源；缺席时仅 loader config 生效）──────

const { pathToFileURL } = require('node:url')
const os = require('node:os')

let schemaPromise = null

// 宿主 dsh 全局安装里的 vendored 副本。跟随 dsh bin 真实位置：
// <prefix>/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/<pkg>/…
function hostCandidatePaths(pkgName, rel) {
  const prefixes = [process.env.DSH_GLOBAL_PREFIX, os.homedir() + '/.local'].filter(Boolean)
  return prefixes.map((prefix) =>
    path.join(prefix, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', pkgName, rel),
  )
}

// schemastery 另有 CJS 副本，优先 CJS 保持与宿主 settings 服务同源；统一走
// 动态 import()（CJS 顶层无法 await）。加载失败只降级不让宿主 boot 失败。
function startSchemaLoader() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const candidates = [
        ...hostCandidatePaths('schemastery', 'lib/index.cjs'),
        '@deepseek-ai/schemastery',
      ]
      const errors = []
      for (const target of candidates) {
        try {
          const specifier = target.includes('/') && !target.startsWith('@') && target.includes('node_modules')
            ? pathToFileURL(target).href
            : target
          const mod = await import(specifier)
          return mod
        } catch (e) {
          errors.push(`${target}: ${String((e && e.message) || e).slice(0, 160)}`)
        }
      }
      throw new Error(errors.join(' | '))
    })()
  }
  return schemaPromise
}

async function resolveSchema() {
  try {
    const mod = await startSchemaLoader()
    if (!mod) return null
    const Schema = mod.default || mod.Schema || (typeof mod === 'function' ? mod : null)
    return Schema && typeof Schema.object === 'function' ? Schema : null
  } catch {
    return null
  }
}

// 测试缝隙：预先注入 Schema，让单测不依赖本机宿主安装
function __seedSchema(Schema) {
  schemaPromise = Promise.resolve(Schema ? { default: Schema } : null)
}

function settingsSchema(Schema) {
  if (!Schema || typeof Schema.object !== 'function') return null
  return Schema.object({
    enabled: Schema.boolean().default(engine.DEFAULTS.enabled),
    root: Schema.string().default(engine.DEFAULTS.root),
    host: Schema.string().default(engine.DEFAULTS.host),
    port: Schema.number().step(1).min(engine.NUM_RANGES.port[0]).max(engine.NUM_RANGES.port[1]).default(engine.DEFAULTS.port),
    token: Schema.string().default(engine.DEFAULTS.token),
    readOnly: Schema.boolean().default(engine.DEFAULTS.readOnly),
    followLinks: Schema.boolean().default(engine.DEFAULTS.followLinks),
  })
}

// ── 插件 ─────────────────────────────────────────────────────────────────

module.exports = {
  name,
  inject,
  version: engine.VERSION,
  __internals: { settingsSchema, resolveSchema, __seedSchema, API_PREFIX, SETTINGS_NS },

  apply(ctx, config) {
    // 宿主可能过滤插件 logger 输出；console.error 走 stderr 保底可见（launchd 下进 err.log）
    const hostLogger = ctx.logger && typeof ctx.logger.warn === 'function' ? ctx.logger : null
    const logger = {
      info(m) { try { hostLogger && hostLogger.info && hostLogger.info(m) } catch {} console.error(m) },
      warn(m) { try { hostLogger && hostLogger.warn && hostLogger.warn(m) } catch {} console.error(m) },
      error(m) { try { hostLogger && hostLogger.error && hostLogger.error(m) } catch {} console.error(m) },
    }
    const webServer = ctx.webServer

    const base = engine.normalizeConfig({ ...engine.DEFAULTS, ...(config || {}) })
    let settingsScope = null
    let memoryPatch = {} // settings 服务缺席时的进程内兜底
    let tokenFileCache = null

    const state = { server: null, fingerprint: '', error: null }

    function effective() {
      const fromSettings = settingsScope && typeof settingsScope.get === 'function'
        ? settingsScope.get()
        : null
      return engine.normalizeConfig({ ...base, ...(fromSettings || {}), ...memoryPatch })
    }

    /** 令牌落盘兜底：settings 服务缺席时写 token 文件（重启仍可挂载）。 */
    function readTokenFile() {
      if (tokenFileCache !== null) return tokenFileCache
      try {
        tokenFileCache = fs.readFileSync(engine.tokenFile(), 'utf8').trim()
      } catch {
        tokenFileCache = ''
      }
      return tokenFileCache
    }

    function writeTokenFile(token) {
      try {
        fs.mkdirSync(path.dirname(engine.tokenFile()), { recursive: true })
        fs.writeFileSync(engine.tokenFile(), token + '\n', { mode: 0o600 })
        tokenFileCache = token
      } catch (e) {
        logger.warn(`dsh-webdav-server: token 文件写入失败: ${(e && e.message) || e}`)
      }
    }

    /** 确保令牌存在：settings → token 文件（已有的先采纳，别覆盖）→ 自动生成。 */
    async function ensureToken(cfg) {
      if (cfg.token) return
      // token 文件里已有值必须采纳：否则每次重启都会重新生成，
      // 已挂载的客户端（记着旧令牌）全部静默掉线
      const fromFile = readTokenFile()
      if (fromFile) {
        memoryPatch.token = fromFile
        cfg.token = fromFile
        return
      }
      let token = engine.generateToken()
      if (settingsScope && typeof settingsScope.update === 'function') {
        try {
          await settingsScope.update({ token })
        } catch (e) {
          logger.warn(`dsh-webdav-server: 令牌写入 settings 失败，退回文件: ${(e && e.message) || e}`)
          memoryPatch.token = token
          writeTokenFile(token)
        }
      } else {
        memoryPatch.token = token
        writeTokenFile(token)
      }
      cfg.token = token
    }

    async function setToken(token) {
      memoryPatch = { ...memoryPatch, token }
      if (settingsScope && typeof settingsScope.update === 'function') {
        try {
          await settingsScope.update({ token })
        } catch (e) {
          logger.warn(`dsh-webdav-server: 令牌写入 settings 失败，退回文件: ${(e && e.message) || e}`)
          writeTokenFile(token)
        }
      } else {
        writeTokenFile(token)
      }
    }

    function status() {
      const cfg = effective()
      const token = cfg.token || readTokenFile()
      const root = engine.resolveRootDir(cfg.root)
      const lan = engine.lanIPv4()
      const openToLan = cfg.host === '0.0.0.0' || cfg.host === '::'
      return {
        ok: true,
        running: Boolean(state.server),
        enabled: cfg.enabled,
        error: state.error,
        host: cfg.host,
        port: cfg.port,
        urlLocal: `http://127.0.0.1:${cfg.port}/`,
        urlLan: openToLan && lan ? `http://${lan}:${cfg.port}/` : null,
        root: root || cfg.root,
        rootIsDefault: Boolean(root) && root === engine.defaultRoot(),
        readOnly: cfg.readOnly,
        followLinks: cfg.followLinks,
        token,
        username: 'dsh',
      }
    }

    /** 配置协调器：指纹变化才重建；enabled=false 或配置非法则停机。 */
    async function reconcile() {
      const cfg = effective()
      await ensureToken(cfg)
      const token = cfg.token || readTokenFile()
      if (token !== cfg.token) cfg.token = token
      const fp = engine.serverFingerprint(cfg)
      if (fp === state.fingerprint) return status()

      if (!cfg.enabled) {
        await engine.closeServer(state.server)
        state.server = null
        state.fingerprint = fp
        state.error = null
        logger.info('dsh-webdav-server: 已停用，监听器关闭')
        return status()
      }

      const root = engine.resolveRootDir(cfg.root)
      if (!root) {
        await engine.closeServer(state.server)
        state.server = null
        state.fingerprint = fp
        state.error = `共享目录配置无效（需绝对路径）: ${cfg.root}`
        logger.warn('dsh-webdav-server: ' + state.error)
        return status()
      }
      const mkdirError = engine.ensureRootDir(root)
      if (mkdirError) {
        await engine.closeServer(state.server)
        state.server = null
        state.fingerprint = fp
        state.error = `共享目录创建失败: ${(mkdirError && mkdirError.message) || mkdirError}`
        logger.warn('dsh-webdav-server: ' + state.error)
        return status()
      }

      state.fingerprint = fp // 先记账防并发重建；失败时错误落在 state.error
      // 同端口重建必须先释放旧监听器，否则 EADDRINUSE（停顿仅毫秒级）
      await engine.closeServer(state.server)
      state.server = null
      try {
        const { app } = await engine.createWebdavApp({ ...cfg, root })
        state.server = await engine.startListener(app, cfg)
        state.error = null
        logger.info(
          `dsh-webdav-server: WebDAV http://${cfg.host}:${cfg.port}/ root=${root}` +
            (cfg.readOnly ? ' [read-only]' : ''),
        )
      } catch (e) {
        state.error = engine.startErrorText(e)
        logger.error('dsh-webdav-server: ' + state.error)
      }
      return status()
    }

    // ── settings 注册（异步；缺席不阻塞宿主半其余功能）───────────────────
    ;(async () => {
      const Schema = await resolveSchema()
      if (Schema && ctx.settings && typeof ctx.settings.register === 'function') {
        try {
          settingsScope = ctx.settings.register(SETTINGS_NS, settingsSchema(Schema), { base })
          logger.info('dsh-webdav-server: settings-registered')
        } catch (e) {
          logger.warn(`dsh-webdav-server: settings register 失败（仅 loader config 生效）: ${(e && e.message) || e}`)
        }
      } else {
        logger.warn(
          `dsh-webdav-server: settings 不可用（Schema=${Boolean(Schema)}, ctx.settings=${Boolean(ctx.settings)}）——令牌/配置退回 token 文件与进程内兜底`,
        )
      }
      await reconcile()
    })().catch((e) => logger.error(`dsh-webdav-server: init: ${(e && e.message) || e}`))

    // ── 同源 API：status / settings / token ─────────────────────────────
    function sendJson(res, statusCode, payload) {
      const body = JSON.stringify(payload)
      res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-store',
      })
      res.end(body)
    }

    function readBody(req) {
      return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0
        req.on('data', (c) => {
          size += c.length
          if (size > 64 * 1024) {
            reject(new Error('body too large'))
            req.destroy()
            return
          }
          chunks.push(c)
        })
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
      })
    }

    if (webServer && typeof webServer.register === 'function') {
      ctx.effect(() => {
        webServer.register({
          kind: 'prefix',
          path: API_PREFIX,
          handler: async (req, res) => {
            const url = new URL(req.url || '/', 'http://dsh.local')
            const rest = url.pathname.slice(API_PREFIX.length)
            try {
              if (req.method === 'GET' && (rest === '' || rest === '/' || rest === '/status')) {
                sendJson(res, 200, status())
                return
              }
              if (req.method === 'POST' && rest === '/token') {
                await setToken(engine.generateToken())
                await reconcile()
                sendJson(res, 200, status())
                return
              }
              if (req.method === 'PUT' && rest === '/settings') {
                let patchBody = null
                try {
                  patchBody = JSON.parse((await readBody(req)) || '{}')
                } catch {
                  sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' })
                  return
                }
                const patch = engine.sanitizePatch(patchBody, effective())
                memoryPatch = { ...memoryPatch, ...patch }
                if (settingsScope && typeof settingsScope.update === 'function') {
                  try {
                    await settingsScope.update(patch)
                  } catch (e) {
                    logger.warn(`dsh-webdav-server: settings update 失败（仅本次进程生效）: ${(e && e.message) || e}`)
                  }
                }
                await reconcile()
                sendJson(res, 200, status())
                return
              }
              sendJson(res, 404, { ok: false, error: 'not found' })
            } catch (e) {
              try { sendJson(res, 500, { ok: false, error: String((e && e.message) || e) }) } catch {}
            }
          },
        })
      }, 'dsh-webdav-server: api route')
    } else {
      logger.warn('dsh-webdav-server: webServer 不可用，设置 API 未注册')
    }

    // ── 协调器心跳：兜住手改 settings.yaml / token 文件的外部变更 ────────
    ctx.effect(() => {
      const timer = setInterval(() => {
        reconcile().catch((e) => logger.error(`dsh-webdav-server: reconcile: ${(e && e.message) || e}`))
      }, 3000)
      return () => {
        clearInterval(timer)
        engine.closeServer(state.server).catch(() => {})
      }
    }, 'dsh-webdav-server: reconciler + listener')

    // 不 return 任何值——cordis-plugin-loader 把 apply 的返回值当作 disposable/effect。
  },
}
