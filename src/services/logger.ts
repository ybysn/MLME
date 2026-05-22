/**
 * 模块职责：分层日志系统，通过 localStorage 开关控制调试输出。
 * 日志格式：[ShadowMarkdown][scope] message payload
 * 开关：localStorage "shadowMarkdown.debugLogs" = "1" 开启 / "0" 关闭
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem("shadowMarkdown.debugLogs") === "1";
  } catch {
    return true; // localStorage 不可用时默认开启
  }
}

function safePayload(payload: unknown): unknown {
  if (payload === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return String(payload);
  }
}

function log(level: LogLevel, scope: string, message: string, payload?: unknown) {
  if (!isDebugEnabled()) return;
  const prefix = `[ShadowMarkdown][${scope}]`;
  const safe = safePayload(payload);
  const fn = console[level] as Function;
  if (safe !== undefined) {
    fn(`${prefix} ${message}`, safe);
  } else {
    fn(`${prefix} ${message}`);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, payload?: unknown) => log("debug", scope, message, payload),
    info: (message: string, payload?: unknown) => log("info", scope, message, payload),
    warn: (message: string, payload?: unknown) => log("warn", scope, message, payload),
    error: (message: string, payload?: unknown) => log("error", scope, message, payload),
  };
}
