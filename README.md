# @weibaohui/dsh-webdav-server

[![npm version](https://img.shields.io/npm/v/@weibaohui/dsh-webdav-server.svg)](https://www.npmjs.com/package/@weibaohui/dsh-webdav-server)
[![license](https://img.shields.io/npm/l/@weibaohui/dsh-webdav-server.svg)](https://github.com/weibaohui/dsh-webdav-server/blob/main/LICENSE)

dsh 插件 · WebDAV 服务器：把一个共享目录变成 **Windows / macOS / Linux 都能挂载成本地磁盘**的 WebDAV 服务。独立端口 + 访问令牌认证，可选只读，共享根目录/端口/令牌全部可视化配置，设置页自带三平台挂载指南。

## 这是干什么的

mount 协议选型的结论是：**WebDAV 是三平台都能挂载、服务端又最容易自研的方案**（SMB 三端原生但服务端无法嵌入；NFS 的 Windows 客户端在 Home 版缺失）。本插件用 [nephele](https://github.com/sciactive/nephele)（RFC 4918 全量实现的 Node.js WebDAV 框架）+ 官方文件系统适配器，把 dsh 里的一个目录变成标准 WebDAV 共享：

- 挂载后它就是**一块本地盘**：资源管理器 / Finder / 文件管理器里直接拖拽、双击编辑、另存，所有改动实时落到 dsh 机器上的共享目录；
- 与 dsh 网页、其他插件完全独立（自己的端口、自己的认证），宿主挂了它也跟着挂（插件生命周期内运行）；
- 典型用法：把 dsh 会话工作区/知识库目录共享给局域网里的其他电脑、iPad（Files.app 原生支持 WebDAV）、手机等。

## 安装

```sh
dsh plugin add github:weibaohui/dsh-webdav-server
```

重启 dsh 后，打开 **设置 → WebDAV 服务器**。

## 快速上手

1. 设置页确认服务**运行中**（默认已启用）；
2. 复制设置页里的**局域网地址**（默认 `http://<你的IP>:19087/`）和**访问令牌**；
3. 在另一台电脑按设置页的挂载指南挂载：**用户名随便填**（如 `dsh`），**密码 = 令牌**。

三平台完整挂载步骤（含 Windows WebClient 服务与注册表修复命令、Linux davfs2 免交互配置）都内置在设置页的「挂载指南」卡片里，地址和凭据会自动代入，可直接复制执行。

首次启动令牌自动生成并持久化（settings 服务持久化到 `~/.dsh/settings.yaml` 的 `dsh-webdav-server` 节；服务缺席时退回 `~/.dsh/dsh-webdav-server/token` 文件），可随时在设置页重新生成。

## 共享目录（根目录）

| 配置 | 默认 | 说明 |
|---|---|---|
| 共享根目录 | `~/.dsh/dsh-webdav-server/share` | 挂载盘看到的就是这个目录的内容；目录不存在自动创建；支持 `~` 展开 |
| 监听地址 | `0.0.0.0` | 局域网可挂载；改 `127.0.0.1` 则仅本机 |
| 端口 | `19087` | 1024–65535 |
| 认证模式 | `独立令牌` | 见下节「认证：独立令牌 or user-management 账号」 |
| 只读模式 | 关 | 开启后上传/删除/改名一律 403 |
| 跟随软链接 | 开 | 关闭后共享根外的软链接会被拒绝 |

想共享别的东西，把根目录指过去即可，例如 dsh 会话工作区、`~/.dsh/kb`（知识库）、任何 absolute path。

> ⚠️ 安全提示：根目录指到哪，挂载者（持有凭据的人）就能读写到哪。别把整个 HOME 指出去；只读共享公开目录时记得开只读模式。

## 认证：独立令牌 or user-management 账号

两种认证模式，设置页一键切换：

- **独立令牌**（默认）：用户名任意，密码=访问令牌（首次启动自动生成，可随时重新生成）。零依赖，开箱即用。
- **user-management 账号**：直接复用 [user-management](https://github.com/weibaohui/user-management) 的登录用户名密码，不用另发凭据。注意事项：
  - 开启两步验证（TOTP）的账号**无法挂载**——Basic 认证没有地方输入动态码，这类用户请用独立令牌模式；
  - 被禁用的账号同样拒绝；
  - 密码修改后，已验证的旧凭据最多再有效 5 分钟（凭据判定缓存）；
  - user-management 未安装或用户库损坏时**自动回退令牌认证**，不会把人锁死在外面。

## 三平台挂载速查

设置页里也有一份带实际地址和令牌的版本。

### macOS

- Finder 按 `⌘K`（前往 → 连接服务器）→ 输入 `http://<ip>:19087/` → 连接 → 用户名任意、密码填令牌；
- 或终端 `open http://<ip>:19087/` 直接唤起连接窗口；
- 卸载：Finder 侧栏弹出，或 `diskutil unmount /Volumes/<名称>`。

### Windows

1. 文件资源管理器 → 此电脑 → **映射网络驱动器** → 文件夹填 `http://<ip>:19087/`，勾选「使用其他凭据」→ 用户名任意、密码填令牌。

2. 失败先看这里（WebDAV 重定向器的历史包袱，均为一次性配置）：

   | 症状 | 解法（管理员 PowerShell / 注册表） |
   |---|---|
   | Win11 23H2+ 映射无反应 | WebClient 服务默认停用：`sc config WebClient start= auto && net start WebClient` |
   | 明文 HTTP 弹密码框后反复要求重输 | Basic 认证默认只走 HTTPS，HTTP 需 `HKLM\SYSTEM\CurrentControlSet\Services\WebClient\Parameters\BasicAuthLevel = 2`（DWORD）后重启 WebClient |
   | 大于 50MB 的文件拷不动 | 同路径 `FileSizeLimitInBytes = 4294967295`（默认 47185664）后重启 WebClient |
   | 改完不生效 | `net stop WebClient && net start WebClient`（改注册表后必须重启服务） |

3. 嫌麻烦的替代路线：[RaiDrive](https://www.raidrive.com/)、[rclone mount](https://rclone.org/commands/rclone_mount/)（`rclone mount :webdav: X: --vfs-cache-mode writes`）都能挂同一个地址。

### Linux

```sh
sudo apt install davfs2            # 或对应发行版包管理器
sudo mkdir -p /mnt/dsh
sudo mount -t davfs http://<ip>:19087/ /mnt/dsh
# 用户名任意，密码 = 令牌
```

免交互：把 `http://<ip>:19087/ dsh <令牌>` 写入 `/etc/davfs2/secrets`（chmod 600）。

> iOS / iPadOS 的「文件」App → 连接服务器 原生支持同样的地址和凭据。

## 配置持久化与热生效

设置存在宿主 settings 服务的 `dsh-webdav-server` 节（`~/.dsh/settings.yaml`），也可直接手改——插件每 3 秒做一次指纹比对，目录/端口/令牌/只读任一变化都会自动重建监听器，无需重启 dsh。

## 开发

```sh
npm install
npm run build:client   # 生成 client/bundle.js
npm test               # 引擎全链路（真实 nephele 监听器）+ 客户端契约
```

协议正确性由 nephele 保证（RFC 4918 全量），本仓测试覆盖认证门禁、只读 403、PROPFIND/PUT/GET/MKCOL/COPY/MOVE/DELETE 全链路与配置清洗。

## 许可

MIT
