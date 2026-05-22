# Preview Test Cases

#### **`*****## H2 - 二级标题*****`**

### H3 - 三级标题333

Normal paragraph text with **bold**, *italic*, and `inline code` styles.
This paragraph has multiple lines with soft breaks.

Another paragraph here.三

<br />

## Blockquote黑金沙空间黑沙洞天

> This is a blockquote.四is
> It can span multiple lines.三

## ListsPreview Test Cases

\*\*\*\*\*## H2 - 二级标题\*\*\*\*\*

H3 - 三级标题333

Normal paragraph text with bold, italic, and inline code styles. This paragraph has multiple lines with soft breaks.

<br />

Another paragraph here.三

<br />

Blockquote

This is a blockquote.四is It can span multiple lines.三

<br />

Listsd皇家空军刷卡

Unordered

First item

<br />

Second item

<br />

Nested item

<br />

Third item

<br />

Ordered

1\.

First step

<br />

2\.

Second step

<br />

3\.

Third step

<br />

Table

￼￼

Name

<br />

Type

<br />

Description

<br />

title

<br />

string

<br />

Document title

<br />

count

<br />

number

<br />

Item count

<br />

done

<br />

bool

<br />

is completed

<br />

Code Block

interface User {

&#x20; name: string;

&#x20; age: number;

}

<br />

function greet(user: User): string {

&#x20; return \`Hello, \${user.name}!\`;

}

Links

Visit GitHub or <https://example.com> for more info.

<br />

Image

￼

Horizontal Rule

HTML Sanity Check

The following HTML should NOT be executed, only shown as plain text:

<br />

\<script>alert("XSS")\</script>￼

<br />

\<div onclick="alert('clicked')">Should not be clickable\</div>￼

<br />

Normal text after HTML fragments should still render correctly.

<br />

Mixed Content

This section has bold text, italic text, and code mixed together with a link and more bold text at the end.

<br />

### Unordered

* First item

* Second item

  * Nested item

* Third item

### Ordered

1. First step
2. Second step
3. Third step

## Table

| Name  | Type   | Description    |
| ----- | ------ | -------------- |
| title | string | Document title |
| count | number | Item count     |
| done  | bool   | is completed   |

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

Visit [GitHub](https://github.com) or <https://example.com> for more info.

## Image

![image-000000006a106ca9-2bdc.png](preview.assets/image-000000006a106ca9-2bdc.png)


## Horizontal Rule

***

## HTML Sanity Check

The following HTML should NOT be executed, only shown as plain text:

<script>alert("XSS")</script>

<div onclick="alert('clicked')">Should not be clickable</div>

Normal text after HTML fragments should still render correctly.

## Mixed Content

This section has **bold** text, *italic* text, and `code` mixed together
with a [link](https://example.com) and more **bold** text at the end.
