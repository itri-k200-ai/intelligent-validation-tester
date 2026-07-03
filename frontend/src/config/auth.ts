// ── 登入功能開關 ─────────────────────────────────────────────
// 目前使用情境只有單一使用者、沒有使用者管理需求,先把登入「關掉」:
// app 開啟時會用下面的預設身分在背後自動登入,不會出現登入頁。
//
// 登入頁、登入 API、守衛邏輯全部保留(沒有刪除)—— 之後若要做
// 「多使用者管理」,把 LOGIN_ENABLED 改回 true 就恢復正常登入流程。
export const LOGIN_ENABLED = false;

// LOGIN_ENABLED=false 時,背後自動登入用的預設帳密(對應 seed 的 admin)。
// mock build(NEXT_PUBLIC_USE_MOCK=true)不會用到這個 —— 它在 authStore
// 直接帶假身分,連自動登入都不必打。
export const AUTO_LOGIN_CREDENTIALS = { identifier: "admin", password: "admin" };
