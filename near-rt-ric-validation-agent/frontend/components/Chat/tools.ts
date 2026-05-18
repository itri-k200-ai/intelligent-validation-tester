/**
 * Translate a Claude `tool_use` block into a short human-readable line
 * for the live-activity indicator. Pure: caller decides where to render.
 */

function shortenPath(p: string): string {
  if (!p) return "";
  return p.length > 60 ? "…" + p.slice(-58) : p;
}

export function describeToolUse(name: string, input: unknown): string {
  const i = (input as Record<string, unknown>) || {};
  const s = (k: string) => (typeof i[k] === "string" ? (i[k] as string) : "");
  switch (name) {
    case "Bash":
      return `$ ${s("description") || s("command").split("\n")[0].slice(0, 80)}`;
    case "Read":
      return `Read ${shortenPath(s("file_path"))}`;
    case "Write":
      return `Write ${shortenPath(s("file_path"))}`;
    case "Edit":
    case "MultiEdit":
      return `Edit ${shortenPath(s("file_path"))}`;
    case "Glob":
      return `Find: ${s("pattern")}`;
    case "Grep":
      return `Search: "${s("pattern")}"`;
    case "Task":
      return `→ ${s("subagent_type") || "agent"}: ${s("description").slice(0, 60)}`;
    case "WebFetch":
      return `Fetch ${s("url")}`;
    case "WebSearch":
      return `Search web: "${s("query")}"`;
    case "TodoWrite":
      return "Update todo list";
    default:
      return name;
  }
}
