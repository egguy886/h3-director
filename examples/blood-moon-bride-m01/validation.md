# EP001 M01｜H3 Director V02 验证报告

## Skill

- Skill 目录：`C:\Users\egguy\.codex\skills\h3-director`
- `quick_validate.py`：PASS
- `SKILL.md`：139 行，无未完成占位符
- UI 元数据：PASS

## 验证脚本

- 脚本：`scripts/validate_h3_prompt.py`
- Python 语法编译：PASS
- T2VA 最小正例：PASS
- I2VA 最小正例：PASS
- FL2VA 最小正例：PASS
- 错误字段顺序、跳号 Shot 和超时切点反例：正确判定 FAIL

## 旧版 M01 V01

判定：FAIL。

主要原因：旧稿把 Base 模式的图片对齐行、未加字段头的 Subject 定义和三字段 `integrated_multimodal_description` 混合在一起；若按 Ref2VA 使用，它不符合官方六字段结构。Dario 被直接编号为 S2，但当前片段没有更早的 S1 说话事件。

## 新版 M01 H3 Director V02

判定：PASS，无错误、无警告。

- 模式：Ref2VA
- 时长：15秒
- 字段顺序：`subject_definitions → summary → retention_analysis → detailed_description → overall_soundscape → non_diegetic_music`
- Shot：4个
- 切点：3.000秒、7.000秒、11.000秒
- Picture：1–6 连续
- Subject：1–3 连续
- 说话人：S1
- 对白块：1个
- `detailed_description`：493个英文词，位于官方通常建议的350–500范围
- 配乐：`N/A`


