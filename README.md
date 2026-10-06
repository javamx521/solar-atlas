# 太阳系图谱 · Solar System Atlas

轻量、双语的三维太阳系探索器。浏览太阳、八大行星和冥王星，切换观察视图，搜索天体并打开中英文档案。当前界面专注星空与天体，不显示任务目录或发射时间线。

## 本地运行

需要 Node.js 20 或更新版本，不需要安装运行依赖。

```sh
npm run serve
```

打开 http://127.0.0.1:4173 。可用 `PORT=8080 npm run serve` 更换端口。开发服务器只监听本机，且仅提供公开网页资源，不暴露 `.git`、测试或配置文件。

请通过 HTTP 服务器运行，勿直接双击 HTML；天体档案需要读取本地 JSON。

## 检查与测试

```sh
npm run check        # JS 语法、HTML 引用、JSON、数据、UI 控制逻辑与本地服务器测试
npm test            # Node 内置测试套件
npm run test:browser # 可选 Playwright 浏览器回归
```

本次环境的本地预览访问受到限制。经授权发布后，已在云端浏览器检查公开站点及档案降级交互，但该浏览器无法创建 WebGL 上下文，因此三维渲染、着色器与 GPU 性能仍未验证（2026-10-06）。静态、数据、控制逻辑、相机数学和服务器测试共 30 项通过。

浏览器回归需要已有 Playwright 和 Chromium，项目不会自动下载或安装它们。自动识别常规 Playwright 安装及当前执行环境的预装路径。其他位置可设置：

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

测试覆盖桌面和手机布局、10 个天体档案、中英文切换、中文/英文/拼音首字母搜索、三个视图、Esc 关闭、R 复位、无 WebGL 降级，以及运行资源是否有缺失或外部依赖。截图默认保存在系统临时目录 `solar-atlas-smoke`，可用 `SMOKE_ARTIFACT_DIR` 指定其他目录。`npm run check` 不需要浏览器依赖，也不访问网络。

## 文件结构

- `index.html`：网页结构
- `src/styles.css`：响应式界面样式
- `src/atlas.js`：天体目录、搜索、语言和档案交互
- `src/scene.js`：Three.js 场景、动画和相机控制
- `src/boot.js`：启动与降级处理
- `data/bodies.json`：天体摘要、物理参数、大气、地貌与文章
- `data/provenance.json`：数据来源、检查范围与限制
- `assets/`：本地行星贴图
- `vendor/`：本地 Three.js 文件与相应许可说明
- `tests/`：零依赖开发服务器、静态检查和回归测试

`data/missions.json` 和 `data/aliases.json` 仅作历史资料保留，当前天体界面不需要加载它们。

## 科学与数据说明

这是用于探索和科普的视觉模型，不是精密星历软件。天体半径、相对距离、轨道和动画速度采用展示比例；“实时”视图不表示经过天文星历校准的当前位置。大气比例及物理参数常为近似值，地貌坐标有示意位置。

每个天体提供可访问的 NASA 官方事实页，以及针对已核实修订的来源。数据测试保证结构与基本范围，不等于对全部历史叙述、数值和动态状态作了完整科学审校。请参阅 `data/provenance.json`。

本轮已纠正地球大氧化事件与现代含氧量混淆、范艾伦带风险表述、亚马孙“供氧比例”表述，以及地月潮汐导致日长增加的世纪/年单位错误。太阳观测内容也包含明确的安全提示：普通太阳镜与烟熏玻璃不能安全观日。

## 资源与许可

行星贴图原始归属 Solar System Scope / INOVE，采用 CC BY 4.0；具体来源及本地处理说明请以资源目录中的署名文件为准。Three.js 的第三方许可须与 `vendor/three.min.js` 一同保留。数据里的 NASA、CNSA、CAS 等来源是资料出处，不表示这些机构背书本项目。

## English quick start

Run `npm run serve`, then visit http://127.0.0.1:4173. No runtime dependency installation or build step is required. `npm run check` runs the built-in static and data tests; `npm run test:browser` is an optional Playwright suite. The app is a planet-focused educational visualization, with illustrative scales and motion rather than a precision ephemeris. Mission JSON files remain archival only.
