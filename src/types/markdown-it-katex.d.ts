declare module "markdown-it-katex" {
  import type { PluginWithOptions } from "markdown-it";
  const mk: PluginWithOptions<{ throwOnError?: boolean; errorColor?: string }>;
  export default mk;
}
