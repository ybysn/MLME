# Image Roundtrip Test Cases

## 1. 基本 PNG 图片

![test png](image_roundtrip.assets/test_png.png)

## 2. 中文路径 JPEG 图片

![测试中文jpg](image_roundtrip.assets/测试中文.jpg)

## 3. JFIF 图片

![jfif format](image_roundtrip.assets/image-000000001a2b3c4d.jfif)

## 4. WebP 图片

![webp image](image_roundtrip.assets/image-000000005e6f7g8h.webp)

## 5. 多张图片 + 段落混排

正常段落文本，包含一些 Markdown 格式。

这是第二段，**加粗**和*斜体*。

![图片A](image_roundtrip.assets/screenshot_001.png)

在两张图片之间的段落。

> 引用块中的图片
> ![引用图片](image_roundtrip.assets/inline_ref.jpg)

列表项：
- 项目 1
- 项目 2
- ![列表图片](image_roundtrip.assets/list_icon.svg)

## 6. 代码块不应被识别为图片

```markdown
![不应被解析](fake.assets/nope.png)
```
