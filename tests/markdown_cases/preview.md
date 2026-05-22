# Preview Test Cases

## H2 - 二级标题

### H3 - 三级标题333

Normal paragraph text with **bold**, *italic*, and `inline code` styles.
This paragraph has multiple lines with soft breaks.

Another paragraph here.

## Blockquote

> This is a blockquote.
> It can span multiple lines.

## Lists

### Unordered

- First item
- Second item
  - Nested item
- Third item

### Ordered

1. First step
2. Second step
3. Third step

## Table

| Name  | Type   | Description    |
|-------|--------|--------------- |
| title | string | Document title |
| count | number | Item count     |
| done  | bool   | Is completed   |

## Code Block

```typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}
```

## Links

Visit [GitHub](https://github.com) or https://example.com for more info.

## Image

![Test Image](./test.png)

## Horizontal Rule

---

## HTML Sanity Check

The following HTML should NOT be executed, only shown as plain text:

<script>alert("XSS")</script>

<div onclick="alert('clicked')">Should not be clickable</div>

Normal text after HTML fragments should still render correctly.

## Mixed Content

This section has **bold** text, *italic* text, and `code` mixed together
with a [link](https://example.com) and more **bold** text at the end.
