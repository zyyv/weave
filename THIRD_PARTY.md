# 本地播放器与语音解码依赖

- silk-wasm 3.7.1：https://github.com/idranme/silk-wasm ，MIT。`frontend/vendor/silk.mjs` 与 `silk.wasm` 为 npm 包原始文件，许可证见同目录 SILK-LICENSE.txt。
- benz-amr-recorder 1.1.5：https://github.com/BenzLeung/benz-amr-recorder ，MIT。仅使用其 AMR-NB worker 解码源文件；将 CommonJS 工厂包装改为自执行，以静态 worker 形式加载，未使用麦克风和录音 API。许可证见同目录 AMR-LICENSE.txt；解码源码包含底层实现的许可声明，保留原文。

语音只在本地静态 Web Worker 中解码。SILK 的 Emscripten/Embind 运行时需要动态函数和 WebAssembly；仅给这两个静态解码 worker 配置相关 CSP 权限，主页面保持不允许动态脚本执行。


- Video.js `@videojs/cdn` 10.3.0：https://github.com/videojs/video.js ，Apache-2.0。音频与视频使用官方 Neutral 专用皮肤，发布文件位于 `frontend/vendor/videojs/`；保留原始生产 JS / CSS，省略开发构建、source map 和类型声明。npm 归档 SHA-512 与固定来源记录在 `VENDORED.json`，原作者及商标声明见 `LICENSE`，完整许可证见 `APACHE-LICENSE-2.0.txt`。运行时只加载本地文件，不启用分析、远端嵌入或云媒体服务。


- WaveSurfer.js 8.0.5：https://github.com/katspaugh/wavesurfer.js ，BSD-3-Clause。独立音频播放器使用官方单文件 ESM 分发；原始文件、完整许可证及已核验的 npm SHA-512 记录位于 `frontend/vendor/wavesurfer/`。使用 MediaElement 播放；微信语音预计算波形在本地 Worker 完成，避免主线程再次遍历整段 PCM。Video.js 保留用于视频。
