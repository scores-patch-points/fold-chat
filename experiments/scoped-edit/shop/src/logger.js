const LEVELS = ["debug", "info", "warn", "error"];

export function createLogger(minLevel = "info") {
  const lines = [];
  const min = LEVELS.indexOf(minLevel);
  const log = (level, msg) => {
    if (LEVELS.indexOf(level) >= min) lines.push("[" + level + "] " + msg);
  };
  return { log, lines };
}
