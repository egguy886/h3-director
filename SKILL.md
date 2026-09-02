---
name: h3-drama-director
description: 把单集或连续短剧剧本拆成可配置的 H3 视频片段，锁定剧情节拍与逐字对白，完成导演调度、官方 H3 提示词编译、真实尾帧串行接力和成片验收。适用于剧本转整集 H3 生产包；不用于普通单镜头润色或未经授权直接调用视频生成 API。
---

# H3 短剧总导演

把剧本变成可生产、可验证、可串行接力的 H3 整集方案。默认交付规格是 `120 秒 = 8 段 × 15 秒`，同时支持不跨场的可变段数模式。

## 权威顺序

发生冲突时按以下顺序裁决：

1. 用户批准的剧本、对白版本和交付规格。
2. 本 Skill 的 H3 官方格式规则。
3. 剧情全覆盖、导演调度、连续性和验收规则。
4. 运镜、表演、灯光和动作设计方法。

不得用镜头创意覆盖剧情事实，不得用其他视频平台语法覆盖 H3 语法。

## 按阶段读取

- 开始解析剧本、选择规格或切段时，读取 [schema.md](references/schema.md) 和 [story-and-dialogue.md](references/story-and-dialogue.md)。
- 安排表演、空间、运镜、段尾交接或返修时，读取 [directing-and-continuity.md](references/directing-and-continuity.md)。
- 编译任何 H3 提示词前，必须读取 [h3-compilation.md](references/h3-compilation.md)。这是最终格式唯一权威。
- 检查提示词、生成片段或整集拼接时，读取 [review.md](references/review.md)。
- 需要核对规则来源和可迁移边界时，读取 [provenance.md](references/provenance.md)。

## 必须执行的工作流

1. 把剧本解析成按场次排序的原子节拍。保留场次、动作、说话人、对白原文、对白语言、画内/画外属性和源位置。
2. 建立不可变的对白台账。默认 `approvedDialogue` 必须与 `sourceDialogue` 完全相同，并计算 SHA-256；未经用户明确批准，不得翻译、改写、删减或增加。
3. 选择生产 profile：
   - 默认 `fixed-delivery`：严格 8 段，每段 15 秒；必要时允许一段内有一次明确的编辑换景。
   - `scene-safe`：每段不超过 15 秒且绝不跨场，段数自动。
4. 一次规划完整集。每个源节拍必须被恰好一段认领，顺序不变；先检查对白容量，再设计镜头。
5. 每段只设一个主要戏剧任务和一个可见转折，并填写八步导演契约。
6. 分离不可变剧情与可变连续性：节拍、对白、结果不可动；Picture 1、开场物理状态、镜头起点和局部调度等待真实尾帧回填。
7. 按官方 H3 模式编译提示词。非对白正文使用英文；对白保持批准版本及原语言，逐句写入 `<d>[Language] ...</d>`。
8. 运行确定性校验。任何错误都必须修复；语义警告需要人工或模型复核。
9. 生成必须串行推进。段 N 只有在验收为 KEEP 后才能输出真实尾帧和观察状态；该 handoff 令段 N+1 进入 `RECOMPILE`，不得直接进入投产态。
10. 段 N+1 根据真实首帧重新编译开场描述和调度，将 `promptCompiledForTakeId` 写成来源 take ID，再次校验通过后才可标记 `GENERATION_READY`。
11. 逐段检查实际对白、口型、人物、道具、银幕方向、光线和尾帧。被拒或被替代的 take 永远不得进入接力链。
12. 只拼接已验收片段，再做整集剧情、对白音频、声画同步和段间衔接审查。

## 对白硬门禁

- 有对白的节拍必须在片段对白表和 H3 `<d>` 中各出现一次且完全一致。
- 画内对白必须安排可见嘴部和足够发声时间；画外音或旁白必须由剧本明确标注。
- 源节拍有对白时，禁止出现 `No intelligible dialogue` 或任何等价静音指令。
- 对白装不进规定时长时，重新切段或更换 profile；不得靠删词、改词或不自然加速解决。

## 视觉增强边界

视觉增强必须单列为 `visualEmbellishments`，使用允许类型并声明 `narrativeImpact: "none"`。可以增强天气、材质反馈、非因果特效、背景生命、灯光和表演微动作；不得新增对白、信息、动机、关键道具、角色介入、胜负结果、时间地点或事件顺序。

## 本地校验命令

```powershell
node scripts/h3-drama-director.mjs validate <episode-package.json>
node scripts/h3-drama-director.mjs validate <episode-package.json> --check-assets
node scripts/h3-drama-director.mjs checksum <dialogue-text-file>
node scripts/h3-drama-director.mjs handoff <episode-package.json> --segment M01 --take T01 --frame <accepted-tail-frame.png> --state <observed-state.json> --out <new-package.json>
```

`handoff` 只写显式 `--out`，不得覆盖输入包。运行测试：

```powershell
node scripts/selftest.mjs
```

## 停止条件

遇到以下任一情况，不得继续投产：剧本或批准对白版本不明确；对白容量超限；必要资产缺失；H3 字段或标签不合法；上一段没有验收通过的真实尾帧；下一段尚未针对该 take 重新编译；生成片段实际对白与台账不一致。

本 Skill 负责规划、编译、校验和审查。调用付费视频 API、批量生成、重试和发布仍需当前任务的明确授权。
