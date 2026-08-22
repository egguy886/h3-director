# EP001 M01 资产上传表｜H3 Director V02

六张图片全部启用，顺序不可交换。H3 的 Picture 编号从 1 开始，ComfyUI 的 `ref_image` 编号从 0 开始。

| H3标签 | 文件 | 主要职责 | 不得转移 | ComfyUI输入 |
|---|---|---|---|---|
| `<Picture 1>` | `01_PICTURE1_YACHT_EXPLOSION_BLAST.png` | Shot 1 爆炸规模、现代游艇空间、Wren 外翻轨迹关键帧 | 不锁死为静止首帧，不取代人物卡身份 | `ref_image_0` |
| `<Picture 2>` | `02_PICTURE2_DARIO_FLAMES_REACH.png` | Shot 2 同一船舷上的奔跑、跪地、伸手构图 | 不改变 Dario 的锁定脸与服装 | `ref_image_1` |
| `<Picture 3>` | `03_PICTURE3_DARIO_AMBER_EYES_CLOSEUP.png` | Shot 3 Dario 火光近景、琥珀眼与表演尺度 | 不把近景背景当成新场景 | `ref_image_2` |
| `<Picture 4>` | `04_PICTURE4_SLIPPING_FINGERTIPS.png` | Shot 4 手指接触、栏杆边缘、海面深度关系 | 不复制额外手臂或人物 | `ref_image_3` |
| `<Picture 5>` | `05_PICTURE5_WREN_TORN_BLOOD_BRIDE_CARD.png` | Wren 脸、身材、湿发、破损染血婚纱身份 | 不转移灰背景、四格布局和中性站姿 | `ref_image_4` |
| `<Picture 6>` | `06_PICTURE6_DARIO_TAILORED_BLACK_SUIT_CARD.png` | Dario 脸、体型、黑色西装身份 | 不转移灰背景、四格布局和静态站姿 | `ref_image_5` |

`ref_image_6` 与 `ref_image_7` 保持空置或旁路；旧音频节点不要接入当前 Conditioning。


