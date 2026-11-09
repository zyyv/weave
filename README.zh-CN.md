# Weave · 资源库

[English](README.md) · 简体中文

一款 macOS 桌面应用，用于浏览、整理和导出本地资源目录中的文件。将图片、视频、语音和文档集中到一个资源库，默认自动识别普通目录与微信会话资源，提供对应的浏览方式和内置媒体预览。

基于 Go 与 MyGo，使用系统 WKWebView。打包后的应用无需 Electron、Node.js 或 Go 运行环境。

## 安装与首次打开

需要 macOS 12 或更新版本。下载与 Mac 芯片匹配的安装包：`arm64` 适用于 Apple 芯片，`amd64` 适用于 Intel；请以 Release 实际提供的文件为准。

1. 从本项目 GitHub Releases 下载 `.dmg` 文件并打开。
2. 将 **Weave.app** 拖入 **Applications（应用程序）**，从「应用程序」中启动 Weave，安装完成后推出磁盘映像。也可下载 ZIP，解压后将 Weave.app 放入「应用程序」。
3. 如果首次启动被拦截，在尝试打开后，前往 **系统设置 → 隐私与安全性 → 仍要打开**，按提示验证身份并确认打开。旧版 macOS 的入口为「系统偏好设置 → 安全性与隐私 → 通用」。系统会将此 App 保存为例外，之后通常可以直接打开。

**注意：当前版本仅使用本地 ad-hoc 签名，没有 Apple Developer ID 签名，也未通过 Apple 公证。** 手动放行仅适用于你确认来源可信且未被篡改的安装包；步骤见 [Apple 官方说明](https://support.apple.com/zh-cn/102445)。如果提示「App 已损坏」或包含恶意软件，请先停止安装、重新下载并反馈具体提示，不要直接当作普通的开发者身份提示处理。

## 本地构建

在 macOS 上安装 Go（版本见 `go.mod`）和 Node.js 22.12 或更新版本，然后运行：

```sh
npm ci
./build.sh
```

脚本从 `package.json` 读取版本，生成 `build/Weave.app`、`build/Weave-v<版本>-macOS-<架构>.dmg` 和 `.zip`，默认使用本机 Go 目标架构（Apple 芯片通常为 `arm64`），并校验应用签名与 DMG 校验和。请使用脚本生成的包；通过 Documents 同步目录直接复制 `.app` 可能影响签名元数据。

## 开发预览

执行 `npm ci` 后，运行 `npm run dev` 启动带开发工具的桌面应用；运行 `npm run dev:browser` 在浏览器中预览，前端修改后刷新即可。

开发模式通过 `--dev` 开关启用。在「设置 → 数据与存储」点击「重播教程（开发）」，即可从第一步反复预览，无需清空数据源或引导完成记录。最后点击「完成预览」结束。普通启动与打包应用默认关闭开发工具。

## 功能

| 功能 | 可以做什么 |
| --- | --- |
| 资源浏览 | 普通目录按真实文件夹层级浏览（包含空文件夹），支持面包屑导航；微信资源按会话浏览。两种来源均可平铺全部文件，切换网格与列表，按修改时间、大小或名称排序；会话内按日期分组浏览。 |
| 目录识别 | 默认自动识别。在「设置 → 数据与存储」查看自动识别结果与当前使用模式；识别有误时可手动选择普通目录或微信会话资源，也可恢复自动识别。模式及分组偏好按资源根目录分别保存。 |
| 搜索与整理 | 搜索文件名、标签，以及已绑定的会话名称或账号；组合类型、会话和收藏筛选，会话内支持多选文件类型。为资源添加收藏和标签，方便再次查找。 |
| 预览与播放 | 查看图片、配对的原图与缩略图、文件详情、格式化 Markdown、TXT 和 CSV、连续滚动的 PDF，以及内置的 Word、Excel 和 PowerPoint 预览。预览可全屏查看，按 Esc 返回详情。源码支持语法高亮，可用 Oxfmt 格式化支持的文件。音视频支持进度调整、音量和倍速控制，音频支持波形定位； SILK、AMR-NB 语音在本地解码。 |
| 会话命名 | 将目录标识手动关联到已确认的联系人、群聊或自定义名称，支持 JSON 批量导入；不同资源根目录的绑定分别保存。 |
| 文件导出 | 在 Finder 中定位文件，或通过系统目录选择弹窗，将最多 200 个选中资源复制到目标目录。导出命名为 `资源ID_原文件名`，不覆盖已有文件。 |

界面支持简体中文与 English、深色／浅色／跟随系统外观、三套配色，以及舒适／紧凑密度，偏好自动保存。虚拟滚动、缩略图缓存和后台音频解码用于改善大资源库的浏览体验。

## 本地数据与限制

Weave 仅读取源目录，不删除、移动、重命名或写入其中的文件。预览、播放和语音解码在本机完成，不发起外网请求。本地服务仅监听 `127.0.0.1`，使用随机端口和应用访问路径。Office 渲染器使用独立的本地来源。

管理信息单独保存在 `~/Library/Application Support/Weave/`：

| 文件 | 内容 |
| --- | --- |
| `marks.json` | 收藏与标签 |
| `source.txt` | 选择的资源目录 |
| `settings.json` | 偏好设置、各资源目录的模式与浏览偏好、会话绑定 |

- **会话名称需要手动绑定。** 不解密联系人或会话数据库，不根据目录哈希猜测姓名，也不验证账号归属。
- **预览能力取决于文件格式。** 加密 DAT / PIC 图片及不支持的媒体编码无法预览。SILK / AMR-NB 解码上限为每个文件 16 MiB、解码后音频 15 分钟，不支持 AMR-WB；原文件仍可导出。
- **文档预览。** PDF 支持连续滚动。内置 Office 渲染器在本机直接打开 DOC/DOCX、XLS/XLSX 和 PPT/PPTX，无需另外安装办公软件。Office 预览为只读，文件上限为 100 MiB，复杂文档的排版可能与原件有差异。
- **文本与源码预览。** TXT、Markdown、CSV 和源码最多预览前 128 KiB。Markdown 的链接和图片只显示文字，HTML 按源码显示。内置 Oxfmt 支持格式化完整的 JS、TS、HTML、CSS、JSON、YAML、TOML、GraphQL、Vue 和 MDX 等文件。格式化只影响预览。
- **日期与可用性取决于本地文件。** 文件修改时间不一定等于消息发送时间；从源目录清理的文件无法继续预览或导出，可重新扫描刷新列表。

## Credit

Weave 使用了以下开源项目：

| 依赖 | 用途 |
| --- | --- |
| [Hugeicons](https://icon-sets.iconify.design/hugeicons/) · `@iconify-json/hugeicons` 1.2.35 | 界面与播放器图标，以本地 SVG 随应用打包。[MIT](frontend/vendor/hugeicons/LICENSE.txt)。 |
| [MyGo](https://github.com/egoist/mygo) · 0.7.4 | macOS 桌面应用外壳与系统 WKWebView 集成。 |
| [WaveSurfer.js](https://github.com/katspaugh/wavesurfer.js) · 8.0.5 | 音频播放与波形定位。[BSD-3-Clause](frontend/vendor/wavesurfer/LICENSE)。 |
| [Video.js](https://github.com/videojs/video.js) · 10.3.0 | 使用 Neutral 皮肤的视频播放，打包自 `@videojs/cdn`。[Apache-2.0](frontend/vendor/videojs/APACHE-LICENSE-2.0.txt)；[上游声明](frontend/vendor/videojs/LICENSE)。 |
| [silk-wasm](https://github.com/idranme/silk-wasm) · 3.7.1 |  SILK 语音的本地解码。[MIT](frontend/vendor/SILK-LICENSE.txt)。 |
| [benz-amr-recorder](https://github.com/BenzLeung/benz-amr-recorder) · 1.1.5 | 使用其 Worker 源码在本地解码 AMR-NB。[MIT 与解码器许可声明](frontend/vendor/AMR-LICENSE.txt)。 |
| [x18n](https://github.com/x18n-dev/x18n) | 开发期间的中英文翻译管理。 |

媒体依赖均打包在本地。SILK 模块与 WebAssembly 文件保持原样；AMR 解码器的 CommonJS 工厂改为独立 Worker 包装，未使用麦克风或录音 API，并保留解码器许可声明。Video.js 的生产 JS / CSS 与 WaveSurfer 的 ESM 文件均保留原始文件及许可证，包来源与完整性哈希记录在各自的 `VENDORED.json` 中。播放与解码使用本地资源，不启用分析或远端媒体服务。
