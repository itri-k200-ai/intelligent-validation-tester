/**
 * Engine i18n dictionary — UI chrome strings ONLY (buttons, status,
 * errors, auth, section labels).
 *
 * Domain-specific copy (app name, hero title/subtitle, feature cards,
 * suggested prompts, capability descriptions) lives in
 * `domain/config.json` and is fetched at runtime via `useAppConfig()`.
 * Adding domain copy here will leak app identity into the engine and
 * break the "swap domain by editing one file" promise.
 */

export type Lang = "en" | "zh";

export const LANG_KEY = "agent-app-lang";

type Dict = Record<string, Record<Lang, string>>;

export const dict: Dict = {
  // Sidebar / shell — brand text comes from useAppConfig(); these are
  // only the layout strings (button labels, tab names).
  "sidebar.new":        { en: "+ New",             zh: "+ 新對話" },
  "sidebar.new.title":  { en: "New conversation",  zh: "開新對話" },

  // Tabs (names of the four sidebar panes)
  "tab.capabilities":   { en: "Capabilities",  zh: "能力" },
  "tab.outputs":        { en: "Outputs",       zh: "產出" },
  "tab.sessions":       { en: "Sessions",      zh: "對話" },
  "tab.knowledge":      { en: "Knowledge",     zh: "知識" },

  // Outputs panel — neutral "artifact" wording so it fits any domain
  // (code projects, reports, contracts, structured data, …).
  "outputs.intro": {
    en: "Artifacts the agent has produced. Archives are downloadable; directories are the full output trees on disk.",
    zh: "agent 產出的成品。Archive 可下載；directory 是磁碟上的完整目錄。",
  },
  "outputs.empty": {
    en: "Nothing produced yet.",
    zh: "尚未產出任何成品。",
  },
  "outputs.archive":         { en: "archive",   zh: "壓縮檔" },
  "outputs.source":          { en: "source",    zh: "原始檔" },
  "outputs.files":           { en: "files",     zh: "檔" },
  "outputs.download":        { en: "Download",  zh: "下載" },
  "outputs.delete.tooltip":  { en: "Delete",    zh: "刪除" },
  "outputs.delete.title":    { en: "Delete artifact", zh: "刪除成品" },
  "outputs.delete.confirm": {
    en: "Delete this artifact? The directory and any archive will be removed. This cannot be undone.",
    zh: "刪除這項成品？目錄與對應壓縮檔都會被移除，無法復原。",
  },

  // Sessions
  "sessions.empty": {
    en: "No conversations yet — click + New to start.",
    zh: "尚無對話 — 點 + 新對話 開始。",
  },
  "sessions.msg":              { en: "msg",      zh: "則" },
  "sessions.delete.confirm": {
    en: "Delete this conversation? This cannot be undone.",
    zh: "刪除此對話？無法復原。",
  },
  "sessions.delete.title":     { en: "Delete conversation", zh: "刪除對話" },
  "sessions.delete.tooltip":   { en: "Delete",   zh: "刪除" },
  "sessions.label.prefix":     { en: "Session",  zh: "對話" },
  "sessions.rename.tooltip":   { en: "Rename",   zh: "改名" },
  "sessions.rename.hint": {
    en: "Press Enter to save · Esc to cancel · double-click title to edit",
    zh: "Enter 儲存、Esc 取消（雙擊標題也可編輯）",
  },

  "common.confirm":  { en: "Delete",  zh: "確認刪除" },
  "common.cancel":   { en: "Cancel",  zh: "取消" },

  // Knowledge sidebar panel
  "knowledge.intro": {
    en: "Three knowledge layers: System Prompt (core rules) · Sub-agents (delegatable specialists) · Persistent Memory (accumulated across sessions).",
    zh: "三層知識：System Prompt（核心規則）· Sub-agents（可委派的專家）· Persistent Memory（跨 session 累積）。",
  },
  "memory.field.trigger":  { en: "Triggered by",   zh: "為什麼會記下" },
  "memory.field.apply":    { en: "How it applies", zh: "下次怎麼用" },

  // Knowledge full page
  "kn.title":        { en: "How the agent learns", zh: "她是怎麼學的" },
  "kn.subtitle": {
    en: "Each correction becomes a permanent rule. Each conversation trains future behavior.",
    zh: "每一次糾正都變成她的規則；每一場對話都在訓練她的下一次反應。",
  },
  "kn.back":              { en: "← Back to chat",    zh: "← 回到對話" },
  "kn.openFull":          { en: "Open full view",    zh: "開啟完整視圖" },
  "kn.openGrowth":        { en: "View growth timeline", zh: "看成長時間軸" },
  "kn.stat.memory.long":     { en: "Lessons learned",      zh: "學到的事" },
  "kn.stat.sessions.long":   { en: "Training conversations", zh: "訓練過的對話" },
  "kn.stat.subagents.long":  { en: "Specialist sub-agents",  zh: "專長 sub-agents" },
  "kn.section.prompt":       { en: "Hard-coded rules",       zh: "寫死的規則" },
  "kn.section.subagents":    { en: "Delegatable specialists", zh: "可委派的專家" },
  "kn.section.timeline":     { en: "Teaching timeline",       zh: "教學時間線" },
  "kn.section.timeline.hint": {
    en: "Every entry is a moment the operator taught the agent something and it kept the lesson.",
    zh: "下面每一條都是「使用者糾正了她一次，她把這次的經驗永遠記住了」。",
  },
  "kn.field.before":  { en: "Before",   zh: "原本問題" },
  "kn.field.after":   { en: "After",    zh: "改進方式" },

  "knowledge.stat.memory":    { en: "Knowledge",   zh: "累積知識" },
  "knowledge.stat.sessions":  { en: "Sessions",    zh: "訓練對話" },
  "knowledge.stat.subagents": { en: "Sub-agents",  zh: "Sub-agents" },

  "knowledge.layer1.kicker": { en: "Layer 1",       zh: "第一層" },
  "knowledge.layer1.title":  { en: "System Prompt", zh: "System Prompt" },
  "knowledge.layer1.hint": {
    en: "Core instructions injected on every turn: identity, behavior, safety.",
    zh: "每次推理前注入的核心指令：身分、行為、安全邊界。",
  },
  "knowledge.layer1.body": {
    en: "Identity, behavioral conventions, vocabulary whitelist/blacklist.",
    zh: "身分、行為準則、術語白／黑名單。",
  },
  "knowledge.layer1.view":  { en: "View full text",        zh: "看全文" },
  "knowledge.layer1.empty": { en: "No system prompt found.", zh: "無 system prompt。" },

  "knowledge.layer2.kicker": { en: "Layer 2",    zh: "第二層" },
  "knowledge.layer2.title":  { en: "Sub-agents", zh: "Sub-agents" },
  "knowledge.layer2.hint": {
    en: "Specialist agents the main agent can delegate to via tool-call.",
    zh: "主 agent 透過 tool-call 委派給對應的專長 sub-agent 執行。",
  },
  "knowledge.layer2.view":  { en: "View definition",       zh: "看定義" },
  "knowledge.layer2.empty": { en: "No sub-agents registered.", zh: "尚未註冊 sub-agent。" },

  "knowledge.layer3.kicker": { en: "Layer 3",            zh: "第三層" },
  "knowledge.layer3.title":  { en: "Persistent Memory",  zh: "Persistent Memory" },
  "knowledge.layer3.hint": {
    en: "Items the agent autonomously wrote during conversations; survives across sessions.",
    zh: "對話過程中由 agent 自行判斷寫入的條目，跨 session 持久化。",
  },
  "knowledge.layer3.empty": {
    en: "No memories yet — accumulates as the agent learns.",
    zh: "尚無累積記憶 — 與 agent 互動 / 糾正後自動寫入。",
  },
  "knowledge.layer3.view": { en: "View", zh: "展開" },

  "memory.feedback.title":   { en: "Behavior corrections", zh: "行為修正" },
  "memory.feedback.hint": {
    en: "Rules written after user feedback. Influence future responses.",
    zh: "使用者糾正後寫入的規則，影響後續回應。",
  },
  "memory.project.title":    { en: "Project knowledge", zh: "專案知識" },
  "memory.project.hint": {
    en: "Design decisions, team context, domain facts.",
    zh: "本專案的設計決策、團隊脈絡、領域常識。",
  },
  "memory.reference.title":  { en: "Operational reference", zh: "操作參考" },
  "memory.reference.hint": {
    en: "Tool locations, procedures, external resources.",
    zh: "工具位置、操作流程、外部資源指標。",
  },

  "knowledge.runtime.kicker":  { en: "Runtime",        zh: "Runtime" },
  "knowledge.runtime.title":   { en: "System info",    zh: "系統資訊" },
  "knowledge.runtime.model":   { en: "Model",          zh: "模型" },
  "knowledge.runtime.convs":   { en: "Conversations",  zh: "對話數" },
  "knowledge.runtime.convs.fmt": {
    en: "{s} sessions / {m} messages",
    zh: "{s} 場 / {m} 則",
  },

  // Chat — chrome only. Hero copy comes from useAppConfig().
  "chat.initializing":  { en: "Initializing…", zh: "建立 session 中…" },
  "chat.placeholder": {
    en: "Describe what you want… (Shift+Enter for newline, drag files to attach)",
    zh: "描述你要什麼…（Shift+Enter 換行，可拖檔附加）",
  },
  "chat.send":    { en: "Send",        zh: "送出" },
  "chat.attach":  { en: "Attach file", zh: "附加檔案" },

  "chat.status.uploading":     { en: "Uploading…",                zh: "上傳中…" },
  "chat.status.attached":      { en: "{n} file(s) attached",       zh: "已附加 {n} 個檔案" },
  "chat.status.upload.error":  { en: "Upload failed: {msg}",       zh: "上傳失敗：{msg}" },
  "chat.status.calling":       { en: "Calling agent…",             zh: "呼叫 agent…" },
  "chat.status.reconnecting":  {
    en: "Connection dropped — reconnecting (#{attempt})…",
    zh: "連線中斷 — 重連中 (#{attempt})…",
  },
  "chat.status.done":          { en: "Done",                       zh: "完成" },
  "chat.status.error":         { en: "Error (exit {code})",        zh: "錯誤 (exit {code})" },
  "chat.status.error.msg":     { en: "Error: {msg}",               zh: "錯誤：{msg}" },

  // Growth page — neutral "artifact" wording so it fits any domain.
  "growth.title":    { en: "Agent growth", zh: "Agent 成長歷程" },
  "growth.subtitle": {
    en: "Every rule we taught, every memory it kept, every artifact it produced — in one timeline.",
    zh: "我們教過的每一條規則、它記下的每一條筆記、它做出的每一件成品 — 都在這條時間軸上。",
  },
  "growth.stat.memory":   { en: "Self-learned notes", zh: "自學筆記" },
  "growth.stat.prompt":   { en: "Prompt rules size",  zh: "規則文件大小" },
  "growth.stat.subagent": { en: "Sub-agents",         zh: "子 agent" },
  "growth.stat.persona":  { en: "Personas",           zh: "Personas" },
  "growth.stat.types":    { en: "Artifact types",     zh: "成品類型" },
  "growth.stat.sessions": { en: "Conversations",      zh: "對話次數" },
  "growth.stat.turns":    { en: "Rounds",             zh: "回合數" },
  "growth.stat.events":   { en: "Recorded actions",   zh: "記錄的動作" },
  "growth.timeline":      { en: "Timeline",           zh: "時間軸" },
  "growth.kind.memory":     { en: "Memory",            zh: "自學筆記" },
  "growth.kind.rule":       { en: "Rule update",       zh: "規則更新" },
  "growth.kind.milestone":  { en: "Milestone",         zh: "里程碑" },
  "growth.kind.generated":  { en: "Artifact produced", zh: "產出成品" },
  "growth.empty":           { en: "No events yet.",    zh: "還沒有任何事件。" },

  // Common
  "common.empty.dash":         { en: "—",      zh: "—" },
  "common.empty.placeholder":  { en: "(empty)", zh: "（空）" },

  // Auth
  "auth.title":     { en: "Sign in",                                   zh: "登入" },
  "auth.subtitle": {
    en: "Single-user access. Enter the password to continue.",
    zh: "單一使用者存取。輸入密碼以繼續。",
  },
  "auth.password":  { en: "Password",                                  zh: "密碼" },
  "auth.submit":    { en: "Sign in",                                   zh: "登入" },
  "auth.error":     { en: "Wrong password. Try again.",                zh: "密碼錯誤，請再試。" },
  "auth.logout":    { en: "Sign out",                                  zh: "登出" },
};

export function tr(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  if (!entry) return key;
  let s = entry[lang] ?? entry.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

// `relTime` / `fmtSize` belong to the format module; re-exported here for
// callers that still import from i18n. New code should import directly
// from `@/lib/format`.
export { relTime, fmtSize } from "./format";
