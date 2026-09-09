/* Generated from client/index.js by scripts/build-client.mjs — do not edit by hand.
 * Regenerate with: npm run build:client
 */
window.__ModuleLoader__.load({
  id: "@weibaohui/dsh-webdav-server",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    var React = require("react")
    /**
     * @weibaohui/dsh-webdav-server - Browser half.
     *
     * Single surface: the host settings page section (a `settings.section` slot =
     * one nav entry in the settings window). All colors come from the ui-theme
     * `--dsw-*` token layers so light/dark follows the shell; all copy comes from
     * the locale registry (`zh`/`en`). The client is a thin editor over the
     * plugin's HTTP API (GET /status, PUT /settings, POST /token) — the host
     * plugin owns the WebDAV listener (express + nephele) and its lifecycle.
     */

    // React is a loader platform module. Under plain Node (contract tests) a
    // minimal createElement/hook shim keeps the source loadable for assertions.
    let __React = null
    try { __React = require('react') } catch {}
    if (!__React || typeof __React.createElement !== 'function') {
      __React = {
        createElement(type, props, ...kids) {
          return { type, props: props || {}, kids: kids.flat(9).filter(k => k !== null && k !== undefined && k !== false && k !== true || true) }
        },
        useState(init) { const v = [typeof init === 'function' ? init() : init]; return [v[0], x => { v[0] = typeof x === 'function' ? x(v[0]) : x }] },
        useEffect() {}, useMemo(fn) { return fn() }, useRef(v = null) { return { current: v } },
      }
    }
    const { createElement: h, useState, useEffect } = __React

    // Platform module — always present in the loader's seeded require table.
    // Under plain Node (tests) it is absent; a tagged-element shim keeps the
    // tree structurally testable while the save button ships a real primitive.
    let P = null
    try { P = require('@deepseek-ai/dsh-client-ui-primitives') } catch {}

    /** Idempotent stylesheet injection. */
    function ensureStyles() {
      if (typeof document === 'undefined' || document.getElementById('dwv-styles')) return
      const holder = document.createElement('div')
      holder.id = 'dwv-styles'
      holder.style.display = 'none'
      holder.innerHTML = STYLE
      document.head.appendChild(holder)
    }

    const prim = (name) => P && P[name]
      ? P[name]
      : function Shim(props) {
          const { children, ...rest } = props
          return h('button', { ...rest, 'data-p-shim': name }, children)
        }

    // ── Locale ───────────────────────────────────────────────────────────────

    const NS = 'dshWebdavServer'

    const ZH = {
      title: 'WebDAV 服务器',
      running: '运行中',
      stopped: '已停用',
      failed: '启动失败',
      hint: '把共享目录变成 Windows / macOS / Linux 都能挂载成本地磁盘的 WebDAV 服务。挂载客户端用独立端口访问（令牌认证），与 dsh 网页互不相干。',
      secService: '服务',
      enabled: '启用 WebDAV 服务器',
      authModeLabel: '认证模式',
      authModeToken: '独立令牌',
      authModeUM: 'user-management 账号',
      authModeTokenHint: '挂载时用户名任意，密码=下方「访问令牌」',
      authModeUMHint: '复用 user-management 的登录用户名密码。开启两步验证（TOTP）的账号无法挂载——Basic 认证无处输入动态码，这类用户请改用独立令牌模式。',
      umUnavailable: 'user-management 用户库不可用（未安装或文件缺失），已自动回退令牌认证',
      readOnly: '只读模式',
      readOnlyHint: '开启后客户端只能读，上传/删除/改名一律拒绝',
      followLinks: '跟随软链接',
      followLinksHint: '软链接指向共享根之外时允许访问（关闭更安全，但会拒绝合法链接）',
      hostLabel: '监听地址',
      hostHint: '0.0.0.0 = 局域网内其他电脑可挂载；127.0.0.1 = 仅本机',
      portLabel: '端口',
      secRoot: '共享目录',
      rootLabel: '共享根目录（绝对路径，支持 ~）',
      rootHint: '留空 = 默认 ~/.dsh/dsh-webdav-server/share；目录不存在会自动创建。挂载后看到的就是这个目录的内容。',
      secToken: '访问令牌',
      tokenLabel: '令牌（挂载时的密码）',
      tokenHintToken: '挂载时用户名随便填（如 dsh），密码=令牌。首次启动自动生成并持久化。',
      tokenHintUM: 'user-management 模式下令牌不参与认证，仅在用户库不可用时兜底。',
      regenerate: '重新生成',
      secMount: '挂载指南（三平台通用同一地址与凭据）',
      copy: '复制',
      copied: '已复制',
      credUser: '用户名',
      credPassToken: '密码（令牌）',
      credUserUM: '用户名 = user-management 登录名',
      credPassUM: '密码 = user-management 登录密码',
      mountMacTitle: 'macOS',
      mountMacSteps: 'Finder 按 ⌘K（前往 → 连接服务器），粘贴地址点「连接」，输入上方凭据。首次会问是否记住密码，可存钥匙串。',
      mountMacOpen: '终端唤起连接窗口',
      mountWinTitle: 'Windows',
      mountWinSteps: '文件资源管理器 → 此电脑 → 映射网络驱动器，文件夹粘贴地址、勾选「使用其他凭据」，输入上方凭据。映射失败（尤其 Win11 23H2+）先在管理员 PowerShell 依次执行下面四条再重试：',
      mountWinWebClient: '启动 WebClient 服务（Win11 23H2+ 默认停用）',
      mountWinBasic: '允许 HTTP 明文 Basic 认证（默认仅 HTTPS）',
      mountWinSize: '解除 50MB 单文件传输上限（默认 47185664 字节）',
      mountWinRestart: '重启 WebClient 使配置生效',
      mountWinAlt: '或用 RaiDrive / rclone 等客户端挂载，免系统 WebDAV 栈。',
      mountLinuxTitle: 'Linux',
      mountLinuxSteps: '安装 davfs2 后挂载（首次询问用户名密码，输入上方凭据）：',
      mountLinuxInstall: '安装 davfs2（Debian/Ubuntu，其他发行版同名包）',
      mountLinuxMount: '创建挂载点并挂载',
      mountLinuxSecrets: '免交互：把「地址 用户名 密码」写入 /etc/davfs2/secrets（chmod 600）',
      mountRclone: '三平台兜底：rclone / RaiDrive / iOS「文件」App（连接服务器）都能挂同一地址。',
      localUrl: '本机地址',
      lanUrl: '局域网地址',
      rootNow: '当前共享根',
      save: '保存',
      saved: '设置已保存，服务已按新配置重建',
      loading: '…',
      operationFailed: '操作失败',
    }

    const EN = {
      title: 'WebDAV Server',
      running: 'running',
      stopped: 'disabled',
      failed: 'start failed',
      hint: 'Turn the shared folder into a WebDAV service that Windows / macOS / Linux can mount as a local disk. Mount clients hit a dedicated port (token auth), independent of the dsh web app.',
      secService: 'Service',
      enabled: 'Enable WebDAV server',
      authModeLabel: 'Auth mode',
      authModeToken: 'Standalone token',
      authModeUM: 'user-management accounts',
      authModeTokenHint: 'Mount username can be anything; the password is the token below',
      authModeUMHint: 'Reuses user-management usernames and passwords. Accounts with TOTP enabled cannot mount — Basic auth has nowhere to enter a one-time code; use the token mode for those.',
      umUnavailable: 'user-management user store unavailable (not installed or file missing) — token auth is used as fallback',
      readOnly: 'Read-only mode',
      readOnlyHint: 'Clients can only read; uploads, deletes and renames are rejected',
      followLinks: 'Follow symlinks',
      followLinksHint: 'Allow links pointing outside the share root (off is safer but rejects valid links)',
      hostLabel: 'Listen address',
      hostHint: '0.0.0.0 = mountable from other machines on the LAN; 127.0.0.1 = this machine only',
      portLabel: 'Port',
      secRoot: 'Shared folder',
      rootLabel: 'Share root (absolute path, ~ supported)',
      rootHint: 'Empty = default ~/.dsh/dsh-webdav-server/share; missing directories are created. A mounted disk shows the contents of this folder.',
      secToken: 'Access token',
      tokenLabel: 'Token (the mount password)',
      tokenHintToken: 'Mount username can be anything (e.g. dsh); the password is the token. Auto-generated and persisted on first start.',
      tokenHintUM: 'In user-management mode the token is not used for auth; it only serves as fallback when the user store is unavailable.',
      regenerate: 'Regenerate',
      secMount: 'Mount guide (same address & credentials on all three platforms)',
      copy: 'Copy',
      copied: 'Copied',
      credUser: 'Username',
      credPassToken: 'Password (the token)',
      credUserUM: 'Username = your user-management login',
      credPassUM: 'Password = your user-management password',
      mountMacTitle: 'macOS',
      mountMacSteps: 'In Finder press ⌘K (Go → Connect to Server), paste the address, click Connect, then enter the credentials above. The first time it asks whether to remember the password in the keychain.',
      mountMacOpen: 'Open the connect dialog from a terminal',
      mountWinTitle: 'Windows',
      mountWinSteps: 'File Explorer → This PC → Map network drive, paste the address, check "Connect using different credentials", enter the credentials above. If mapping fails (especially Win11 23H2+), run the four commands below in an admin PowerShell and retry:',
      mountWinWebClient: 'Start the WebClient service (disabled by default since Win11 23H2)',
      mountWinBasic: 'Allow Basic auth over plain HTTP (HTTPS-only by default)',
      mountWinSize: 'Lift the 50MB per-file transfer cap (default 47185664 bytes)',
      mountWinRestart: 'Restart WebClient to apply',
      mountWinAlt: 'Or mount with RaiDrive / rclone, bypassing the system WebDAV stack.',
      mountLinuxTitle: 'Linux',
      mountLinuxSteps: 'Install davfs2 and mount (it asks for the credentials above the first time):',
      mountLinuxInstall: 'Install davfs2 (Debian/Ubuntu; same package name elsewhere)',
      mountLinuxMount: 'Create the mountpoint and mount',
      mountLinuxSecrets: 'Non-interactive: write "address username password" into /etc/davfs2/secrets (chmod 600)',
      mountRclone: 'Fallback everywhere: rclone / RaiDrive / the iOS Files app (Connect to Server) all mount the same address.',
      localUrl: 'Local address',
      lanUrl: 'LAN address',
      rootNow: 'Current share root',
      save: 'Save',
      saved: 'Settings saved, server rebuilt with the new config',
      loading: '…',
      operationFailed: 'Operation failed',
    }

    // ── Pure helpers ────────────────────────────────────────────────────────

    const API = '/dsh-webdav-server/api'

    async function getJson(url) {
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    }

    function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback }

    // ── Token-based stylesheet (light/dark adaptive by construction) ────────

    const STYLE = `<style>
    .dwv-page{position:relative;display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:var(--dsw-font-sm-14,14px)}
    .dwv-body{display:flex;flex-direction:column;gap:14px}
    .dwv-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .dwv-spacer{flex:1}
    .dwv-hint{color:var(--dsw-alias-label-secondary)}
    .dwv-dir{color:var(--dsw-alias-label-tertiary);font-size:var(--dsw-font-xs-13,12px)}
    .dwv-tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:11.5px}
    .dwv-tag.accent{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
    .dwv-tag.error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
    .dwv-card{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
    .dwv-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
    .dwv-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .dwv-field{display:flex;flex-direction:column;gap:4px}
    .dwv-toggle{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}
    .dwv-toggle.on{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
    .dwv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:6px 16px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--dsw-font-family);white-space:nowrap}
    .dwv-btn:hover{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover)}
    .dwv-btn:disabled{opacity:.5;cursor:not-allowed}
    .dwv-btn-primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}
    .dwv-btn-sm{min-height:26px;padding:2px 10px;font-size:12px;font-weight:400}
    .dwv-input{min-height:32px;padding:6px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;font-family:var(--dsw-font-family);outline:none;box-sizing:border-box}
    .dwv-input:focus{border-color:var(--dsw-alias-state-business-primary)}
    .dwv-input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
    .dwv-code{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2)}
    .dwv-code code{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary);word-break:break-all;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dwv-steps{display:flex;flex-direction:column;gap:6px;margin:0}
    .dwv-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:40;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:8px 18px;font-size:13px;box-shadow:var(--dsw-shadow-lv2)}
    .dwv-spin{width:22px;height:22px;border-radius:50%;border:3px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary,var(--dsw-alias-state-business-primary));animation:dwvspin .7s linear infinite}
    @keyframes dwvspin{to{transform:rotate(360deg)}}
    </style>`

    // ── Small building blocks ────────────────────────────────────────────────

    const Tag = ({ tone, children }) =>
      h('span', { className: 'dwv-tag' + (tone ? ' ' + tone : '') }, children)

    function ButtonLite({ primary, small, children, ...rest }) {
      const cls = 'dwv-btn' + (primary ? ' dwv-btn-primary' : '') + (small ? ' dwv-btn-sm' : '')
      if (prim('Button')) {
        return h(P.Button, { variant: primary ? 'primary' : 'outline', size: small ? 'sm' : 'md', className: cls, ...rest }, children)
      }
      return h('button', { className: cls, ...rest }, children)
    }

    function InToast({ text }) {
      return h('div', { className: 'dwv-toast' }, text)
    }

    // ── Settings section: the single entrance (host settings page section) ──

    function SettingsSection({ t }) {
      const [status, setStatus] = useState(null)
      const [busy, setBusy] = useState(false)
      const [toastText, setToastText] = useState(null)
      // 分态受控值（保存前只改本地，保存统一走 PUT）
      const [s, setS] = useState(null)

      const onToast = (text, ms = 3000) => { setToastText(text); setTimeout(() => setToastText(null), ms) }
      const set = (key, value) => setS(prev => ({ ...prev, [key]: value }))

      const refresh = () => getJson(API + '/status').then(d => {
        setStatus(d)
        if (d) setS({
          enabled: d.enabled, host: d.host, port: d.port, root: d.rootIsDefault ? '' : d.root,
          token: d.token, authMode: d.authMode || 'token', readOnly: d.readOnly, followLinks: d.followLinks,
        })
      }).catch(() => {})
      useEffect(() => { refresh() }, [])

      const doSave = async () => {
        setBusy(true)
        try {
          const r = await fetch(API + '/settings', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s || {}),
          })
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status)
          setStatus(d)
          onToast(t('saved'), 2600)
        } catch (e) { onToast(e.message || t('operationFailed'), 4000) }
        finally { setBusy(false) }
      }

      const doRegenerate = async () => {
        setBusy(true)
        try {
          const r = await fetch(API + '/token', { method: 'POST' })
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status)
          setStatus(d)
          set('token', d.token)
          onToast(t('copied'), 10)
        } catch (e) { onToast(e.message || t('operationFailed'), 4000) }
        finally { setBusy(false) }
      }

      const copyText = (text) => {
        try { navigator.clipboard.writeText(text); onToast(t('copied'), 1800) } catch {}
      }

      const toggle = (key, label) => h('label', { className: 'dwv-toggle' + (s && s[key] ? ' on' : '') },
        h('input', { type: 'checkbox', checked: Boolean(s && s[key]), onChange: e => set(key, e.target.checked) }), label)

      const copyRow = (label, value) => h('div', { className: 'dwv-row' },
        h('span', { className: 'dwv-dir', style: { minWidth: 76 } }, label),
        h('div', { className: 'dwv-code', style: { flex: 1, minWidth: 200 } },
          h('code', null, value),
          h(ButtonLite, { small: true, onClick: () => copyText(value) }, t('copy'))))

      const mountBlock = (titleKey, steps, extra) => h('div', { className: 'dwv-field' },
        h('div', { className: 'dwv-title' }, t(titleKey)),
        h('ul', { className: 'dwv-steps' },
          h('li', { className: 'dwv-hint' }, steps),
          extra || null))

      let body
      try {
        const urlForGuide = status && (status.urlLan || status.urlLocal)
        body = s === null
          ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: 24, color: 'var(--dsw-alias-label-secondary)' } },
              h('div', { className: 'dwv-spin' }), t('loading'))
          : h('div', { className: 'dwv-body' },
              h('div', { className: 'dwv-toolbar' },
                status && status.running
                  ? h(Tag, { tone: 'accent' }, t('running'))
                  : status && status.error ? h(Tag, { tone: 'error' }, t('failed')) : h(Tag, null, t('stopped')),
                h('span', { className: 'dwv-spacer' })),
              h('div', { className: 'dwv-hint' }, t('hint')),
              status && status.error ? h('div', { className: 'dwv-hint', style: { color: 'var(--dsw-alias-state-error-primary)' } }, status.error) : null,
              // ── 卡1：服务 ──
              h('div', { className: 'dwv-card' },
                h('div', { className: 'dwv-title' }, t('secService')),
                h('div', { className: 'dwv-row' },
                  toggle('enabled', t('enabled')),
                  toggle('readOnly', t('readOnly')),
                  toggle('followLinks', t('followLinks'))),
                h('div', { className: 'dwv-dir' }, t('readOnlyHint')),
                h('div', { className: 'dwv-dir' }, t('followLinksHint')),
                h('div', { className: 'dwv-row' },
                  h('div', { className: 'dwv-field', style: { minWidth: 240 } },
                    h('label', { className: 'dwv-dir' }, t('authModeLabel')),
                    h('select', { className: 'dwv-input', value: String(s.authMode || 'token'), style: { width: '100%' },
                      onChange: e => set('authMode', e.target.value) },
                      h('option', { value: 'token' }, t('authModeToken')),
                      h('option', { value: 'user-management' }, t('authModeUM'))),
                    h('div', { className: 'dwv-dir', style: { maxWidth: 420 } },
                      s.authMode === 'user-management' ? t('authModeUMHint') : t('authModeTokenHint')))),
                status && status.umAvailable === false
                  ? h('div', { className: 'dwv-hint', style: { color: 'var(--dsw-alias-state-error-primary)' } }, t('umUnavailable'))
                  : null,
                h('div', { className: 'dwv-row' },
                  h('div', { className: 'dwv-field', style: { flex: 1, minWidth: 200 } },
                    h('label', { className: 'dwv-dir' }, t('hostLabel')),
                    h('input', { className: 'dwv-input mono', value: String(s.host ?? ''), placeholder: '0.0.0.0',
                      onChange: e => set('host', e.target.value) }),
                    h('div', { className: 'dwv-dir' }, t('hostHint'))),
                  h('div', { className: 'dwv-field', style: { width: 140 } },
                    h('label', { className: 'dwv-dir' }, t('portLabel')),
                    h('input', { className: 'dwv-input mono', type: 'number', min: 1024, max: 65535,
                      value: num(s.port, 19087), onChange: e => set('port', Math.min(65535, Math.max(1024, num(e.target.value, 19087)))) })))),
              // ── 卡2：共享目录 ──
              h('div', { className: 'dwv-card' },
                h('div', { className: 'dwv-title' }, t('secRoot')),
                h('div', { className: 'dwv-field' },
                  h('label', { className: 'dwv-dir' }, t('rootLabel')),
                  h('input', { className: 'dwv-input mono', value: String(s.root ?? ''), placeholder: '~/.dsh/dsh-webdav-server/share',
                    onChange: e => set('root', e.target.value) }),
                  h('div', { className: 'dwv-dir' }, t('rootHint'))),
                status && status.root ? copyRow(t('rootNow'), status.root) : null),
              // ── 卡3：访问令牌 ──
              h('div', { className: 'dwv-card' },
                h('div', { className: 'dwv-title' }, t('secToken')),
                h('div', { className: 'dwv-row' },
                  h('div', { className: 'dwv-field', style: { flex: 1, minWidth: 220 } },
                    h('label', { className: 'dwv-dir' }, t('tokenLabel')),
                    h('input', { className: 'dwv-input mono', value: String(s.token ?? ''),
                      onChange: e => set('token', e.target.value) })),
                  h(ButtonLite, { disabled: busy, onClick: doRegenerate }, t('regenerate'))),
                h('div', { className: 'dwv-dir' }, s.authMode === 'user-management' ? t('tokenHintUM') : t('tokenHintToken'))),
              // ── 卡4：挂载指南 ──
              h('div', { className: 'dwv-card' },
                h('div', { className: 'dwv-title' }, t('secMount')),
                urlForGuide ? copyRow(t('lanUrl'), urlForGuide) : null,
                urlForGuide ? copyRow(t('localUrl'), status.urlLocal) : null,
                s.authMode === 'user-management'
                  ? h('div', { className: 'dwv-steps', style: { marginTop: 4 } },
                      h('li', { className: 'dwv-hint' }, t('credUserUM')),
                      h('li', { className: 'dwv-hint' }, t('credPassUM')))
                  : [copyRow(t('credUser'), 'dsh'), copyRow(t('credPassToken'), status && status.token ? status.token : '')],
                mountBlock('mountMacTitle', t('mountMacSteps'),
                  copyRow(t('mountMacOpen'), 'open ' + (urlForGuide || ''))),
                mountBlock('mountWinTitle', t('mountWinSteps'),
                  [copyRow(t('mountWinWebClient'), 'sc config WebClient start= auto && net start WebClient'),
                   copyRow(t('mountWinBasic'), 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters" /v BasicAuthLevel /t REG_DWORD /d 2 /f'),
                   copyRow(t('mountWinSize'), 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters" /v FileSizeLimitInBytes /t REG_DWORD /d 4294967295 /f'),
                   copyRow(t('mountWinRestart'), 'net stop WebClient && net start WebClient')]),
                mountBlock('mountLinuxTitle', t('mountLinuxSteps'),
                  [copyRow(t('mountLinuxInstall'), 'sudo apt install davfs2'),
                   copyRow(t('mountLinuxMount'), 'sudo mkdir -p /mnt/dsh && sudo mount -t davfs ' + (urlForGuide || '') + ' /mnt/dsh'),
                   h('li', { className: 'dwv-dir' }, t('mountLinuxSecrets'))]),
                h('div', { className: 'dwv-dir' }, t('mountRclone'))),
              h('div', { className: 'dwv-toolbar' },
                h(ButtonLite, { primary: true, disabled: busy, onClick: doSave }, t('save'))))
      } catch (renderErr) {
        ;(globalThis.__skErrors = globalThis.__skErrors || []).push('body: ' + (renderErr && renderErr.message))
        body = h('div', { className: 'dwv-card', style: { color: 'var(--dsw-alias-state-error-primary)' } },
          '\u26A0\uFE0F ' + String((renderErr && renderErr.message) || renderErr))
      }

      return h('div', { className: 'dwv-page' },
        h('div', { className: 'dwv-body' }, body),
        toastText && h(InToast, { text: toastText }),
      )
    }

    function SettingsSlotComponent(props) {
      useEffect(ensureStyles, [])
      return h(SettingsSection, { t: props.__t })
    }

    // ── Plugin plane contract ────────────────────────────────────────────────

    const CLIENT_NAME = '@weibaohui/dsh-webdav-server'

    module.exports = {
      name: CLIENT_NAME,
      inject: ['slots', 'locale'],
      __internals: { NS, ZH, EN },
      __boot(container, opts = {}) {
        ensureStyles()
        let t = opts.t || ((key) => ZH[key] ?? EN[key] ?? key)
        const root = require('react-dom/client').createRoot(container)
        root.render(h(SettingsSection, { t }))
        return root
      },
      apply(ctx) {
        let t = (key) => ZH[key] ?? EN[key] ?? key
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.locale.register(NS, 'zh', ZH)
            ctx.locale.register(NS, 'en', EN)
            const bound = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : null
            if (bound) t = (key) => bound(key) || (ZH[key] ?? EN[key] ?? key)
          }
        } catch (e) { try { console.error('[dsh-webdav-server] locale init:', e) } catch {} }
        ctx.effect(() => {
          try {
            ctx.slots.inject('settings.section', () => ctx.slots.register({
              name: 'settings.section',
              id: CLIENT_NAME,
              order: 96,
              locale: NS,
              label: () => t('title'),
              inject: () => ({}),
            }, function SettingsSectionSlot() {
              return h(SettingsSlotComponent, { __t: t })
            }))
          } catch (e) { (globalThis.__skErrors = globalThis.__skErrors || []).push('settings:' + (e && e.message)); throw e }
        }, 'dsh-webdav-server: settings section')
      },
    }

    return module.exports
  }
})
