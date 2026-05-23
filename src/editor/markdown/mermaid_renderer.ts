/**
 * 模块职责：Mermaid 图表渲染服务。
 * 输入：container HTMLElement + theme。
 * 输出：将 container 内 .mermaid-block 替换为 SVG。
 */
import mermaid from "mermaid";

let initialized = false;

function ensureInit(theme: "light" | "dark") {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });
    initialized = true;
  }
}

/**
 * 渲染 container 内所有 .mermaid-block 元素为 SVG。
 * 渲染失败时显示错误提示，不影响其他内容。
 */
export async function renderMermaidBlocks(
  container: HTMLElement,
  theme: "light" | "dark",
): Promise<void> {
  ensureInit(theme);

  const blocks = container.querySelectorAll<HTMLElement>(".mermaid-block");
  for (const block of blocks) {
    const source = block.getAttribute("data-mermaid-source") ?? "";
    if (!source.trim()) continue;

    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const { svg } = await mermaid.render(id, source);
      block.innerHTML = svg;
      block.classList.remove("mermaid-block");
      block.classList.add("mermaid-rendered");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const short = msg.length > 200 ? msg.slice(0, 200) + "..." : msg;
      block.innerHTML = `<pre class="mermaid-error"><code>${escapeHtml(source)}</code><p class="mermaid-error__msg">Mermaid 渲染失败: ${escapeHtml(short)}</p></pre>`;
      block.classList.add("mermaid-error-block");
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
