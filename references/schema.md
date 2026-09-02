# 生产包 Schema 与规格

## Profile

默认 `fixed-delivery`：

```json
{
  "name": "fixed-delivery",
  "episodeTargetSeconds": 120,
  "segmentCount": 8,
  "segmentSeconds": 15,
  "segmentMaxSeconds": 15
}
```

必须正好有 `segmentCount` 个片段，每段时长等于 `segmentSeconds`。一段跨两个场次时必须填写：

```json
{
  "editorialCut": {
    "atSeconds": 7.2,
    "fromSceneId": "SC01",
    "toSceneId": "SC02"
  }
}
```

换景时刻必须位于片段内部，前后场次必须与 `sceneIds` 一致。不得用过渡蒙太奇掩盖未声明的跨场。

`scene-safe` 示例：

```json
{
  "name": "scene-safe",
  "episodeTargetSeconds": 120,
  "segmentTargetSeconds": 13.5,
  "segmentMaxSeconds": 15
}
```

片段数量由场次边界、对白容量和戏剧转折决定。`ceil(episodeTargetSeconds / segmentMaxSeconds)` 只是理论最少段数。每段只能包含一个 `sceneId`。

## 顶层结构

```json
{
  "specVersion": "1.0",
  "episodeId": "EP001",
  "profile": {},
  "source": { "scenes": [] },
  "dialogueLedger": [],
  "segments": [],
  "production": {
    "currentSegmentId": "M01",
    "assemblyStatus": "NOT_READY"
  }
}
```

## 场次与节拍

```json
{
  "id": "SC01",
  "slugline": "INT. REPAIR SHOP - NIGHT",
  "sourceLocation": "episode-01.md:12",
  "beats": [
    {
      "id": "B001",
      "type": "action",
      "text": "Lucas drops the wrench and turns toward the alarm."
    },
    {
      "id": "B002",
      "type": "dialogue",
      "speaker": "Lucas",
      "text": "Stay behind me.",
      "language": "English",
      "delivery": "on_screen"
    }
  ]
}
```

节拍 ID 在整集内唯一。`type` 至少区分 `action`、`dialogue`、`reveal`、`transition` 和 `reaction`。不得把两个会分别改变权力、信息或动作状态的事件压成一个节拍。

## 对白台账

```json
{
  "beatId": "B002",
  "speaker": "Lucas",
  "sourceDialogue": "Stay behind me.",
  "approvedDialogue": "Stay behind me.",
  "language": "English",
  "delivery": "on_screen",
  "checksum": "<sha256-of-approvedDialogue>"
}
```

如果用户批准翻译或本地化，保留原 `sourceDialogue`，把批准版本写入 `approvedDialogue`，并记录项目自己的批准标识。不得覆盖原文。

## 片段结构

```json
{
  "id": "M01",
  "status": "PLANNED",
  "durationSeconds": 15,
  "sceneIds": ["SC01"],
  "beatIds": ["B001", "B002"],
  "dramaticJob": "Lucas chooses to protect Elara instead of escaping.",
  "narrativeEntry": "The alarm starts while both are exposed.",
  "narrativeExit": "Lucas places himself between Elara and the threat.",
  "dialogue": [],
  "visualEmbellishments": [],
  "directorContract": {},
  "h3Prompt": {
    "mode": "I2VA",
    "alignmentInstruction": "...",
    "fields": {},
    "assetMap": {}
  },
  "takes": [],
  "continuity": {}
}
```

`beatIds` 是不可变剧情区。`visualEmbellishments`、镜头和调度不得改变这些节拍的事实、顺序和结果。

## 状态机字段

```text
PLANNED -> WAITING_FOR_HANDOFF -> RECOMPILE -> GENERATION_READY
-> GENERATED -> ACCEPTED
                   |-> RETAKE
                   |-> REWRITE
```

验收 take：

```json
{
  "acceptedTake": {
    "id": "T03",
    "status": "ACCEPTED",
    "tailFramePath": "accepted/M01_T03_tail.png",
    "observedState": {
      "characters": "Lucas stands frame left, facing right.",
      "props": "Wrench remains in his right hand.",
      "light": "Cold rain light comes from frame right.",
      "screenDirection": "Lucas faces and travels right."
    }
  }
}
```

下一段 incoming：

```json
{
  "sourceSegmentId": "M01",
  "sourceTakeId": "T03",
  "framePath": "accepted/M01_T03_tail.png",
  "observedState": {},
  "promptCompiledForTakeId": null,
  "requiresPromptRecompile": true
}
```

回填后状态为 `RECOMPILE`。重写开场状态与 H3 正文并通过校验后，才把 `promptCompiledForTakeId` 设为 `sourceTakeId`、`requiresPromptRecompile` 设为 `false`，再进入 `GENERATION_READY`。
