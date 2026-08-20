type Level = "debug" | "info" | "warn" | "error";

const LEVELS: readonly Level[] = ["debug", "info", "warn", "error"];

const consoleByLevel: Record<Level, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function log(level: Level, message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV === "production" && level === "debug") return;
  consoleByLevel[level](`[vitrine:${level}] ${message}`, ...args);
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
} as const;

export type { Level };
export { LEVELS };