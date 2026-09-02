# H3 短剧总导演

**H3 Drama Director · 剧本转连续短剧片段的 Codex Skill**

把单集或连续短剧剧本拆成可生产、可验证、可串行接力的 MiniMax H3 视频片段。默认规格为 `120 秒 = 8 段 × 15 秒`，也支持不跨场的 `scene-safe` 可变段数模式。

## 它解决什么问题

- 剧本节拍按场次和顺序完整覆盖，每个节拍恰好认领一次。
- 剧本批准对白建立不可变台账，逐字保留原文，不翻译、不改写、不删减、不擅自补写。
- 每段经过八步导演契约：空间调度、视线与轴线、动作因果、表演、灯光、声音、运镜和段尾状态。
- 运镜使用有叙事动机的景别、角度、运动和终点，并过滤不属于 H3 的其他平台语法。
- 按 H3 官方字段和标签编译：`<Subject N>`、`<Picture N>`、`<d>[Language] ...</d>`。
- 生成采用“批量规划、串行投产”：只有验收通过的真实尾帧，才能解锁下一段的首帧重编译。
- 生成后审查对白、口型、人物一致性、道具、银幕方向、光线、尾帧和整集拼接，不把未验收片段接入连续性链路。

## 核心工作流

```text
剧本 / 批准对白
        ↓
节拍解析与切段（一次规划完整集）
        ↓
导演调度与八步契约
        ↓
H3 官方格式编译 + 确定性校验
        ↓
片段 N 生成与验收
        ↓ KEEP：提取真实尾帧并观察物理状态
        ↓
片段 N+1 以真实尾帧重新编译后再投产
        ↓
只拼接已验收片段，完成整集审查
```

## 对白硬规则

有对白的节拍必须同时出现在片段对白表和最终 H3 提示词中，并与剧本批准版本逐字一致。画内对白必须安排可见嘴部和足够发声时间；剧本有对白时禁止使用静音或“无可辨识对白”指令。对白无法自然装入时长，必须重新切段或调整规格，不能删词或强行加速。

## 视觉增强边界

可以增加天气、材质反馈、非因果特效、背景生命、灯光和表演微动作，但必须单列为 `visualEmbellishments` 并声明 `narrativeImpact: "none"`。不得新增对白、信息、动机、关键道具、角色介入、胜负结果、时间地点或事件顺序。

## 在 Codex 中安装

直接克隆到 Codex Skills 目录：

```powershell
git clone https://github.com/egguy886/h3-drama-director.git "$env:USERPROFILE\.codex\skills\h3-drama-director"
```

或将本仓库目录复制到该位置。刷新或重启 Codex 后，使用：

```text
Use $h3-drama-director to turn this episode script into a validated H3 production package.
```

## 多平台适配

本 Skill 采用通用 Agent Skills 目录结构：`SKILL.md` 加上 `references/` 和 `scripts/`。因此规则、参考文档和 H3 提示词编译逻辑可以迁移到 Codex、Claude.ai、Claude Code、Claude API 以及 Google Antigravity。平台差异主要在安装入口和本地脚本执行环境。

- **Codex**：将整个仓库目录放入 Codex Skills 目录；`agents/openai.yaml` 提供 Codex 的界面显示元数据。
- **Claude.ai**：将 `SKILL.md`、`references/`、`scripts/` 打包上传到 Settings → Capabilities → Skills；仓库级 `README.md` 不必放进 Skill 包。
- **Claude Code / Claude API**：通过对应的 Skills 目录或 API/Agent SDK 的 Skill 管理入口导入同一份 Skill。API 方式是否能执行本地脚本，取决于宿主是否提供相应的代码执行能力。
- **Antigravity**：项目级放入 `.agents/skills/h3-drama-director/`，全局放入 `~/.gemini/config/skills/h3-drama-director/`；SDK 可通过 `skills_paths` 指向该目录。

跨平台边界：`SKILL.md`、参考文档和提示词规则是可移植的；内置校验与 handoff 脚本需要 Node.js 18+；`agents/openai.yaml` 是 Codex 界面元数据，其他平台可忽略；本 Skill 不内置视频生成 API。

规范参考：[Anthropic Agent Skills 指南](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) · [Google Antigravity Skills 文档](https://antigravity.google/docs/skills)


## 本地校验

仓库内的确定性脚本只负责生产包校验、对白 SHA-256、真实尾帧接力和自测，不会自行调用付费视频 API：

```powershell
node scripts/h3-drama-director.mjs validate <episode-package.json>
node scripts/h3-drama-director.mjs validate <episode-package.json> --check-assets
node scripts/h3-drama-director.mjs checksum <dialogue-text-file>
node scripts/h3-drama-director.mjs handoff <episode-package.json> --segment M01 --take T01 --frame <accepted-tail-frame.png> --state <observed-state.json> --out <new-package.json>
node scripts/selftest.mjs
```

## 仓库结构

```text
SKILL.md                         Codex 加载的主规则
agents/openai.yaml               Codex 界面显示名与默认提示
references/schema.md              规格与生产包 Schema
references/story-and-dialogue.md 剧情节拍与对白 Canon
references/directing-and-continuity.md 导演契约与真实尾帧接力
references/h3-compilation.md     H3 官方提示词编译边界
references/review.md              片段与整集审查规则
references/provenance.md          来源、裁决与边界
scripts/h3-drama-director.mjs    校验、校验和与 handoff 工具
scripts/selftest.mjs              回归测试
```

## 责任边界

本 Skill 负责剧本解析、切段规划、导演调度、H3 提示词编译、确定性校验和生成结果审查。调用付费视频 API、批量生成、重试和发布，仍需当前任务的明确授权，并应在投产前确认必要视觉资产和对白版本完备。

## 来源与许可证

本版本整合剧本转片段分镜、导演调度、H3 官方提示词结构及镜头语言方法；规则来源和适用边界见 [`references/provenance.md`](references/provenance.md)。

本项目采用 MIT License，详见 [`LICENSE`](LICENSE)。
