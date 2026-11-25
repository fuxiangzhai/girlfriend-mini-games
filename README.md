# 女友小游戏

从 `index.html` 选游戏。每个游戏页面都能通过顶部导航切换。

| 游戏 | 玩法 |
| --- | --- |
| [隔空拍脸](slap.html) | 点击头像，或者开启摄像头，让漫画手掌跟随手部动作挥拍。 |
| [捏泡泡纸](bubble-wrap.html) | 点一下捏爆一颗气泡。一张有 36 颗，可以随时换纸。 |
| [翻牌配对](memory.html) | 翻开两张水果卡片，找齐 6 对。 |
| [接星星](catch-stars.html) | 点按或拖动篮子，接住一轮落下的 12 颗星星。 |

默认头像是发布时提供的照片。游玩时临时更换的照片只在当前页面使用。摄像头画面在浏览器内处理，切换到其他标签页时会关闭摄像头。素材、手部识别模型和运行时包含在站点里。

## GitHub Pages

将解压后的内容提交到目标仓库的发布分支根目录。在仓库 **Settings → Pages** 选择 **Deploy from a branch**，选对应分支和 **/(root)**。访问 GitHub Pages 提供的 HTTPS 地址使用摄像头。网页及资源路径支持发布在仓库子路径下。

本地开发也可以在该目录运行 `python -m http.server 8000`，然后访问 `http://localhost:8000/`。

## 实现

- `assets/game.js` 处理头像、分数和打击动画。
- `assets/camera.js` 处理相机权限、MediaPipe 推理和手部位置投影。
- `assets/hand-model.js` 根据手部节点绘制手掌轮廓、手指和光影。
- `assets/swipe.js` 根据掌心移动速度及轨迹与头像的接触判断挥拍。
- `assets/vision/` 包含 Google MediaPipe Tasks Vision 0.10.14、Hand Landmarker Float16 v1 模型及运行时代码的 Apache 2.0 许可文本。
- `assets/bubble-wrap.js`、`assets/memory.js` 和 `assets/catch-stars.js` 分别实现三款点按游戏。
- `assets/sound.js` 提供站内通用的音效开关和音效合成。
