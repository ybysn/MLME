# Image Drop Test

## 图片拖拽插入约定

当用户将本地图片拖入编辑器时：

1. 图片会被复制到当前 Markdown 文件同名的 `.assets` 目录。
2. Markdown 中自动插入相对路径的图片语法。

## 示例

如果当前文件路径为 `C:\Notes\demo.md`：

- 图片目录：`C:\Notes\demo.assets\`
- 拖入 `screenshot.png` 后，文件被复制为 `demo.assets\image-xxxx.png`
- Markdown 中插入：
  ![image-xxxx.png](demo.assets/image-xxxx.png)

## 注意事项

- 必须在已保存的 Markdown 文件中才能拖入图片。
- 未保存的新文档拖入图片时会提示先保存。
- 支持格式：png, jpg, jpeg, gif, webp, svg。
- 拖入非图片文件会被忽略。

> 本文件为测试约定文档，实际图片拖拽需手动测试。
