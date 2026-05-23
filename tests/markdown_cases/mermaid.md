# Mermaid Diagram Test Cases

## 1. Flowchart

```mermaid
flowchart TD
  A[开始] --> B{是否完成}
  B -->|是| C[提交]
  B -->|否| D[继续]
  D --> B
```

## 2. Sequence Diagram

```mermaid
sequenceDiagram
  participant 用户
  participant 编辑器
  用户->>编辑器: 输入 Markdown
  编辑器-->>用户: 渲染图表
  用户->>编辑器: 保存文件
  编辑器-->>用户: 保存成功
```

## 3. Class Diagram

```mermaid
classDiagram
  class Animal {
    +name: string
    +eat(): void
  }
  class Dog {
    +bark(): void
  }
  Animal <|-- Dog
```

## 4. State Diagram

```mermaid
stateDiagram-v2
  [*] --> 空闲
  空闲 --> 编辑中: 开始编辑
  编辑中 --> 空闲: 停止输入
  编辑中 --> 保存中: Ctrl+S
  保存中 --> 空闲: 保存成功
  保存中 --> 保存中: 重试
```

## 5. Mermaid 语法错误（应显示错误不崩溃）

```mermaid
flowchart TD
  A --> B
  B -->>
```

## 6. 非 mermaid 代码块（应继续高亮）

```mermaidx
flowchart TD
  A --> B
```

```ts
const foo = "not mermaid";
```

## 7. 包含尖括号的 mermaid 代码（安全验证）

```mermaid
flowchart TD
  A["<script>alert(1)</script>"] --> B["<div onclick='...'>"]
```
