# H3 官方提示词编译边界

本文件是最终 H3 字段和语法的唯一权威。导演分析、片段 ID、文件路径、状态机和验收说明都留在生产包中，不进入 H3 字段。

## 语言

所有非对白 rewrite 字段使用英文。对白、歌词和画面可见文字保留批准版本的原语言。`workingLang` 可以是中文，但不能改变最终 H3 正文语言。

## Base modes

T2VA、I2VA、FL2VA、L2VA 的字段必须严格按此顺序：

```text
integrated_multimodal_description
overall_soundscape
non_diegetic_music
```

### T2VA

不写图片对齐句，直接输出三个字段。

### I2VA

三个字段之前使用：

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.
```

Picture 1 必须是真实第一帧，并属于 Shot 1。先建立图中风格、人物、构图、场景和空间，再向前发展动作。

### FL2VA

使用官方句式：

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.
```

默认优先单镜头连续到达尾帧；多镜头只有在明确需要时使用。

### L2VA

使用官方句式：

```text
How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.
```

Picture 1 是目标尾帧。正文从合理的较早状态收敛到该画面。

## Ref2VA

字段必须严格按此顺序：

```text
subject_definitions
summary
retention_analysis
detailed_description
overall_soundscape
non_diegetic_music
```

- `subject_definitions`：逐项定义 `<Subject N>`、`<Picture N>`、`<Video N>`、`<Audio N>` 的含义和作用。
- `summary`：以方括号任务类型开头，用一个英文段落概括生成任务和引用关系。
- `retention_analysis`：逐标签说明 fully_preserved、partially_preserved、attribute_transfer、weak_reference、copy 或 reference 等实际关系。
- `detailed_description`：按播放顺序写镜头、人物、动作、对白和同步声音；不能退化为剧情摘要。
- `overall_soundscape`：只总结环境与物理声音，不重复完整对白。
- `non_diegetic_music`：只写观众侧配乐；无配乐时明确 `None.`。

## 镜头与时间

- 使用 `[Shot 1]`、`[Shot 2]`。
- 切镜在新镜头开头写明确时间，例如 `[Shot 2] At 00:05.000, ...`。
- 片段内动作、对白和镜头变化必须装进总时长。
- 换景使用可见、可听和有时刻的编辑切镜；不得写内部说明“接上一段”。

## 说话人与对白

- 按目标视频中第一次实际发声顺序分配稳定 `(S1)`、`(S2)`。
- 引用人物说话时使用 `<Subject N> (Sx)`。
- 完整对白只写在 `<d>` 中：`<d>[English] Stay behind me.</d>`。
- 台词字符串必须与批准台账完全相同。不要把完整对白重复到 soundscape 或 music。
- 画外说话保持同一 speaker ID 并明确 `off-screen`；voice-over 要明确且画内嘴部保持不说话状态。

## 引用与上传映射

每个出现在 H3 字段中的 `<Picture N>`、`<Subject N>`、`<Video N>` 和 `<Audio N>` 都必须在 `assetMap` 中绑定实际上传资产。一个标签全程只代表一个来源角色。

禁止把其他平台的 `@Image1`、`@Video1`、Seedance/Higgsfield 参数或自定义标签带入 H3。

## 清洁提示词

禁止写入段号、任务状态、验证结果、本地文件路径、“上一段”“下一段”“previous segment”等内部承接词、被拒 take、API、工作流、ComfyUI 节点和上传目录元数据。

用 `<Picture 1>` 和具体可见状态表达连续性，而不是描述生产流程。
