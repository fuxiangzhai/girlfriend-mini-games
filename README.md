# 拍拍俱乐部 · 隔空拍脸

游戏入口是 `index.html`。点头像就能试玩。点「开启摄像头」并授权，把张开的手掌快速横扫过画面中间。支持左右两向挥手。点「换我的照片」可选择 JPG、PNG 或 WebP 等浏览器支持的照片。

照片只在当前页面使用。摄像头画面在浏览器内处理，切换到其他标签页时会关闭摄像头。素材、手部识别模型和运行时包含在站点里。

## GitHub Pages

将解压后的内容提交到目标仓库的发布分支根目录。在仓库 **Settings → Pages** 选择 **Deploy from a branch**，选对应分支和 **/(root)**。访问 GitHub Pages 提供的 HTTPS 地址使用摄像头。网页及资源路径支持发布在仓库子路径下。

本地开发也可以在该目录运行 `python -m http.server 8000`，然后访问 `http://localhost:8000/`。

## 实现

- `assets/game.js` 处理头像、分数、动画和音效。
- `assets/camera.js` 处理相机权限、MediaPipe 推理和手部骨架预览。
- `assets/swipe.js` 根据张开的手掌、短时间内的横向速度和中线交叉判断挥拍。
- `assets/vision/` 包含 Google MediaPipe Tasks Vision 0.10.14、Hand Landmarker Float16 v1 模型及运行时代码的 Apache 2.0 许可文本。

默认头像 `assets/mascot.png` 使用内置 ImageGen 生成。生成提示词如下。

> Create one transparent PNG game sticker, a chest-up portrait of a goofy, sheepish young adult East Asian boyfriend character, facing the camera. He has tousled near-black navy hair, warm peach skin, a tiny crooked apologetic grin, one slightly raised eyebrow, pink blush with a few hatch lines, amber orange hoodie. Shoulders and chest end in smooth curved silhouette so he looks like an isolated die-cut sticker. Bold irregular dark almost-black comic ink outlines, wide warm cream sticker border around the complete silhouette, flat vector-like 2D cel colors, playful contemporary indie arcade game illustration with restrained Ben-Day halftone accents, polished clean contour, oversized head. Center him and fill the square frame with slight empty padding on every side. Genuinely transparent outside his cutout. No words, letters, scenery, extra props, outer rays, floating objects, circles behind him, or extra people.
