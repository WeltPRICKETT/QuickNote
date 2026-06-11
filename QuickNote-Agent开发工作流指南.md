# QuickNote 开发工作流指南（Agent 执行规范）

> 本文档面向执行开发任务的 AI Agent / 工程师，定义一款跨平台 Markdown 快速便签应用的完整开发工作流。文档持有者（产品负责人）拥有所有需求决策权。阅读顺序：先通读第 0–2 章建立全局认知，再按第 6 章的阶段顺序执行。

---

## 0. 产品定义（一句话）

一款**全局快捷键秒开、即开即写、Markdown 即时渲染**的极简便签/沉浸式写作应用。定位介于 Spotlight 式速记（如 Heynote / Antinote）与轻量 Obsidian 之间。Windows 与 macOS 双端，可打包为便携 EXE 与 DMG。

### 核心体验三原则（所有设计决策的最终仲裁标准）

1. **快**：从按下快捷键到光标可输入 ≤ 300ms（冷启动 ≤ 1.5s，热唤醒 ≤ 150ms）。
2. **美**：UI 与动效达到 Linear / Arc / Raycast 级别的精致度，而非"工程师审美"。
3. **不打扰**：默认无侧边栏、无工具栏、无弹窗，一切高级功能通过命令面板与快捷键触达。

---

## 1. 技术选型（已决策，Agent 不得擅自更换）

| 层 | 选型 | 理由 |
|---|---|---|
| 应用框架 | **Tauri 2.x** | 包体 ~5MB 级、内存占用低、原生全局快捷键插件、支持 Windows portable EXE 与 macOS DMG；Rust 后端为后期高性能扩展（全文索引、文件监听）留足空间 |
| 前端框架 | **React 18 + TypeScript (strict)** | 生态最大，便于产品负责人后期自行扩展 |
| 构建 | **Vite** | 快速 HMR |
| 编辑器内核 | **CodeMirror 6** | Obsidian 同款内核；通过 Decoration/WidgetType 实现 Live Preview（混合渲染：光标所在行显示源码，其余行渲染样式），这是"像 Obsidian 一样"的关键 |
| Markdown 解析 | @codemirror/lang-markdown + Lezer；导出/全渲染场景用 unified (remark/rehype) | 编辑态与阅读态分离 |
| 样式 | **Tailwind CSS 4 + CSS Variables 主题层** | 主题热切换 |
| 动效 | **Motion (framer-motion 12+)** + CSS spring | 窗口内动效；窗口级动效用原生 API |
| 状态管理 | Zustand | 轻、可持久化 |
| 数据存储 | 本地 `.md` 纯文本文件（用户可见目录）+ SQLite（tauri-plugin-sql）做元数据/全文索引 | 数据主权归用户，与 Obsidian vault 可互通 |
| 全局快捷键 | tauri-plugin-global-shortcut | 双端一致 |
| 托盘/菜单栏 | Tauri tray API | 常驻后台，热唤醒的前提 |

**禁止事项**：不得引入 Electron；不得使用重型 UI 组件库（MUI/AntD）；不得把笔记存进不透明数据库格式。

---

## 2. 信息架构与交互模型

### 2.1 双模式窗口

- **Quick Capture 模式（默认）**：无边框小窗（约 680×420，可记忆尺寸），屏幕居中偏上弹出，失焦自动隐藏（可配置），`Esc` 隐藏。打开即新建/续写"今日速记"。
- **Focus 写作模式**：`Cmd/Ctrl+Shift+F` 或拖拽窗口边缘放大进入；窗口变为常规可调大小窗口，行宽限制 ~70ch，打字机滚动（当前行垂直居中可选），隐藏一切 chrome。

### 2.2 笔记模型

- 一条便签 = 一个 `.md` 文件，文件名 `YYYY-MM-DD-HHmmss-slug.md`，frontmatter 存 `created / updated / pinned / tags`。
- 默认笔记目录：`~/QuickNotes`（首次启动引导选择，可指向 Obsidian vault 子目录实现互通）。
- 自动保存：停笔 500ms 防抖写盘；无"保存"按钮概念。

### 2.3 核心快捷键（默认值，全部可改）

| 动作 | 快捷键 |
|---|---|
| 全局唤醒/隐藏 | `Alt+Space`（Win）/ `Option+Space`（Mac） |
| 新建便签 | `Cmd/Ctrl+N` |
| 命令面板 | `Cmd/Ctrl+K` |
| 笔记切换器（模糊搜索） | `Cmd/Ctrl+P` |
| 钉住窗口（取消失焦隐藏） | `Cmd/Ctrl+Shift+P` |
| 专注模式 | `Cmd/Ctrl+Shift+F` |

### 2.4 命令面板是唯一的"高级功能入口"

所有非高频功能（导出、主题切换、设置、标签管理、插件操作）全部收进 `Cmd+K` 面板，UI 上不出现常驻按钮。

---

## 3. UI / 动效规范（验收最严格的一章）

### 3.1 视觉基调

- 默认双主题：`Paper`（暖白纸感 + 墨色文字）与 `Midnight`（深空灰蓝 + 低饱和强调色），跟随系统切换。
- 字体：UI 用系统字体栈；正文默认 `Inter` + 中文 `思源宋体/黑体可切`；等宽 `JetBrains Mono`。所有字体本地打包，不走网络。
- 圆角 12–16px、窗口毛玻璃（mac 用 vibrancy，Win11 用 Mica/Acrylic，旧系统降级为纯色）、1px 高光描边。
- 间距系统 4px 网格；行高 1.7；正文字号默认 16px 可调。

### 3.2 动效清单（逐条验收）

| 场景 | 动效 | 参数基准 |
|---|---|---|
| 窗口唤醒 | 缩放 0.96→1 + 透明度 0→1 + 轻微上移 | spring, ~180ms, 无回弹过冲超过 2% |
| 窗口隐藏 | 反向，~120ms | 必须比出现更快 |
| Live Preview 行渲染切换 | 源码↔渲染 交叉淡入 ≤ 80ms | 不允许布局跳动（提前测量高度） |
| 命令面板 | 下落 8px + 淡入，列表项 stagger 15ms | |
| 笔记切换 | 内容区横向 12px 位移 + 淡入淡出 | |
| 复选框/任务勾选 | 路径描边动画 + 文字划线生长 | 用户最高频的"爽点"，必须打磨 |
| 光标 | 平滑移动光标（smooth caret，类似 Cursor 编辑器） | 可在设置关闭 |

**性能红线**：所有动画 60fps；只允许动画 `transform/opacity`；任何引发 layout thrash 的实现直接打回。

### 3.3 必读技能

若执行环境提供 `frontend-design` / `theme-factory` 类技能文档，开工前必须先读，避免做出"模板感"界面。

---

## 4. 可扩展性架构（为产品负责人后期二次开发设计）

1. **分层**：`core（Rust：文件IO/索引/快捷键）` ↔ `bridge（Tauri commands，全部带 TS 类型定义）` ↔ `ui（React）`。UI 不直接碰文件系统。
2. **内部插件机制（v1 即落地）**：
   - 前端定义 `EditorExtension` 注册表：任何功能（如代码高亮主题、斜杠命令、模板）以 CodeMirror Extension + manifest 的形式注册，可在设置中开关。
   - 事件总线：`note:created / note:saved / app:shown / app:hidden` 等生命周期钩子。
3. **外部脚本插件（v2 预留，不实现）**：架构上保证渲染层可加载沙箱化 JS 插件（参考 Obsidian plugin API 的 onload/onunload 模型），v1 只需保证目录结构与 API 边界不堵死这条路。
4. 所有模块单一职责、禁止循环依赖；公开 API 全部写 TSDoc。

---

## 5. 打包与分发

- **Windows**：Tauri bundler 产出 NSIS 安装包 + **portable 单文件 EXE**（`bundle.windows.nsis` + portable target；验证免安装运行、配置写入 EXE 同级 `./data` 而非 AppData——portable 模式检测逻辑必须实现）。
- **macOS**：DMG（含拖入 Applications 引导背景图），Universal Binary（aarch64 + x86_64）。无签名证书时输出 ad-hoc 签名版并在 README 写明绕过 Gatekeeper 的方法。
- CI：GitHub Actions matrix（windows-latest / macos-latest），tag 触发自动出包并附 SHA256。
- 自动更新：v1 不做，预留 tauri-plugin-updater 配置位。

---

## 6. 执行阶段与验收门（Agent 按序执行，每阶段结束必须停下交付检查点）

### Phase 0 — 脚手架（0.5 天）
Tauri2+React+TS+Tailwind 初始化；双端能起空窗口；ESLint/Prettier/严格 TS；CI 骨架。
**验收**：双平台 `tauri dev` 跑通，`tauri build` 出包成功。

### Phase 1 — 窗口与唤醒体验（1–2 天）
全局快捷键、托盘常驻、无边框窗口、失焦隐藏、钉住、窗口出入场动效、毛玻璃。
**验收**：热唤醒 ≤150ms；动效逐条对照 3.2 表。

### Phase 2 — 编辑器内核（3–4 天，最重）
CodeMirror 6 + Live Preview 混合渲染（标题/粗斜体/列表/任务/引用/代码块/链接/分割线/行内代码/高亮）；自动保存；中文输入法组合输入无异常（**IME 测试为硬性验收项**）。
**验收**：与 Obsidian Live Preview 行为逐项对比清单通过；万字文档输入无可感知延迟。

### Phase 3 — 笔记管理（2 天）
文件读写、笔记切换器（模糊搜索）、命令面板、SQLite 全文索引、frontmatter、pinned。
**验收**：1000 条笔记搜索响应 <50ms。

### Phase 4 — 主题/设置/专注模式（2 天）
双主题、设置面板（字体/字号/快捷键自定义/笔记目录迁移）、Focus 模式、打字机滚动。

### Phase 5 — 扩展架构落地 + 打包发布（2 天）
EditorExtension 注册表 + 事件总线 + 2 个示例内部插件（如"斜杠命令插入模板"、"字数统计状态条"）；双端正式出包；写 `ARCHITECTURE.md` 与插件开发 `EXTENDING.md`。
**验收**：产品负责人按 EXTENDING.md 能在 30 分钟内写出一个 hello-world 扩展。

### 每阶段通用 Definition of Done
- 代码可构建、无 TS error、关键逻辑有测试（Rust 端 unit test，前端 vitest）。
- 提交检查点报告：完成项 / 偏离项及理由 / 截图或录屏 / 下阶段风险。
- **任何需求层面的取舍（而非实现细节）必须暂停并向产品负责人提问，不得自行决定。**

---

## 7. 明确的非目标（防 scope creep）

- ❌ 双链/图谱/多 vault/同步服务/移动端/协作 —— 全部不做。
- ❌ WYSIWYG 富文本（必须保持纯 Markdown 源文件）。
- ❌ 账号系统、云端、遥测。
- 好想法一律记入 `PARKING_LOT.md`，不进 v1。

## 8. 开放问题（开工前需产品负责人确认）

1. 默认笔记目录是否直接指向现有 Obsidian vault？（影响首启引导设计）
2. Quick Capture 是"每次唤醒新建一条"还是"续写当日同一条"？（建议后者+`Cmd+N`新建，待确认）
3. 强调色偏好（影响主题 token 初始值）。
4. Windows 端是否需要兼容 Win10（影响 Mica 降级策略）。
