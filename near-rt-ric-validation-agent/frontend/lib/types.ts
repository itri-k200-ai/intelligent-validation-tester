/**
 * API response types — shared across components / hooks.
 * Keep this file free of runtime code.
 */

export type Persona = {
  slug: string;
  display_name: string;
  description: string;
  controls_overlay: Record<string, unknown>;
  source_file: string;
  synced_at: string;
};

export type Session = {
  id: string;
  title: string;
  claude_session_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type Message = {
  id: number;
  role: "user" | "assistant" | "tool" | "system";
  content: { text?: string } & Record<string, unknown>;
  created_at: string;
};

export type Instance = {
  id: string;
  session: string | null;
  name: string;
  persona: string;
  controls: Record<string, unknown>;
  output_path: string;
  status: "draft" | "generated" | "error";
  created_at: string;
  updated_at: string;
};

export type GeneratedItem = {
  name: string;
  path: string;
  size: number;
  file_count?: number;
  mtime: number;
  download_url: string;
  format: string;
  xapp_type?: string;
  persona?: string;
  notes?: string;
  based_on?: string;
  session_id?: string;
};

export type FileEntry = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  content: string;
  title?: string;
  description?: string;
  kind?: string;
  why?: string;
  how?: string;
};

export type Knowledge = {
  prompt: FileEntry | null;
  subagents: FileEntry[];
  memory: { dir: string; entries: FileEntry[]; index: string };
};

export type AgentInfo = {
  claude_version: string;
  claude_config_dir: string;
  memory_dir: string;
  repo_root: string;
  session_count?: number;
  message_count?: number;
  instance_count?: number;
};

export type TurnSummary = {
  id: string;
  session: string;
  status: "running" | "done" | "error" | "interrupted";
  started_at: string | null;
  ended_at: string | null;
  user_message_text: string;
};

export type GrowthEvent = {
  ts: string;
  kind: "memory" | "rule" | "milestone" | "generated";
  title: string;
  desc: string;
  source: string;
  icon: string;
};

export type Growth = {
  stats: {
    memory_count: number;
    prompt_size_bytes: number;
    subagent_count: number;
    persona_count: number;
    artifact_types_generated: number;
    total_sessions: number;
    total_turns: number;
    total_messages: number;
    total_turn_events: number;
  };
  timeline: GrowthEvent[];
};
