/**
 * Removes ANSI escape codes (used for color in terminals) from a string.
 * @param {string} text - The text to sanitize.
 * @returns {string} The sanitized text.
 */
const removeAnsiCodes = (text) => {
  // Regex to match ANSI escape codes
  return text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
};

/**
 * Parses a raw Kubernetes log line, removes the timestamp, and strips ANSI color codes.
 * @param {string} logLine - The raw log line from Kubernetes.
 * @returns {string} A clean, human-readable log message.
 */
const parseLogLine = (logLine) => {
  if (!logLine) {
    return "";
  }

  // 1. Remove ANSI codes first to simplify further processing
  let cleanLine = removeAnsiCodes(logLine);

  // 2. Remove the Kubernetes timestamp (format: 2025-08-26T15:35:24.827476808Z)
  // This regex matches an ISO-like timestamp followed by a Z and a space.
  cleanLine = cleanLine.replace(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[Zz]?\s*/,
    ""
  );

  return cleanLine.trim();
};

export { parseLogLine, removeAnsiCodes };
