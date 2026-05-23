# Math Formula Test Cases (KaTeX)

## 1. 行内公式

质能方程 $E = mc^2$ 是物理学基本公式。

勾股定理 $a^2 + b^2 = c^2$ 描述直角三角形。

## 2. 块级公式

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

## 3. 中文混排

能量公式 $E = mc^2$ 表示质量和能量关系。

根据泰勒展开 $f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n$。

## 4. 多行公式

$$
\begin{aligned}
\nabla \times \vec{E} &= -\frac{\partial \vec{B}}{\partial t} \\
\nabla \times \vec{B} &= \mu_0 \vec{J} + \mu_0 \epsilon_0 \frac{\partial \vec{E}}{\partial t}
\end{aligned}
$$

## 5. 错误公式（不应崩溃）

\$ \frac{1}{0 未闭合大括号

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2
$$

## 6. 普通美元符号（不应误判为公式）

这个商品价格是 \$100，第二件半价。

收入范围在 $50-$100 之间。

这段代码中 `$scope` 是 AngularJS 的概念。

## 7. 代码块中的美元符号（不应渲染）

```ts
const price = 100;
const formatted = `$${price}`;
const expression = "$x + y$";
```

```bash
echo "Cost: $100"
```

