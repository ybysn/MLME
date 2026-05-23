import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // 构建分包：将大型第三方依赖拆出主入口，消除 chunk size 告警
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // 只处理 node_modules，业务代码回退给 rollup 自动决定
          if (!id.includes("node_modules")) return undefined;

          // React 运行时
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return "react-vendor";
          }

          // Milkdown 编辑器内核
          if (/node_modules\/@milkdown\//.test(id)) {
            return "milkdown-vendor";
          }

          // ProseMirror 独立分包（Milkdown 底层，避免与 Mermaid 循环依赖）
          if (/node_modules\/prosemirror-/.test(id)) {
            return "prosemirror-vendor";
          }

          // Markdown 解析/渲染：markdown-it / highlight.js / KaTeX
          if (/node_modules\/(markdown-it|highlight\.js|katex)/.test(id)) {
            return "markdown-vendor";
          }

          // Mermaid 图表核心 + 图形布局依赖
          if (/node_modules\/(mermaid|d3-|dagre|cytoscape|elkjs)/.test(id)) {
            return "mermaid-vendor";
          }

          // Tauri API
          if (/node_modules\/@tauri-apps\//.test(id)) {
            return "tauri-vendor";
          }

          // 未匹配的 node_modules 交给 rollup 自动管理，避免循环依赖
          return undefined;
        },
      },
    },
  },
}));
