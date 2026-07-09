// ── 登入已移除 ─────────────────────────────────────────────
// 沒有登入頁、不需手動登入。但後端 API 仍要求 JWT,所以 app 開啟時會用
// 下面的預設身分在背後「自動登入」拿 token(使用者不會看到)。
// mock build(NEXT_PUBLIC_USE_MOCK=true)連自動登入都不打 —— authStore
// 直接帶假身分。
export const AUTO_LOGIN_CREDENTIALS = { identifier: "admin", password: "admin" };
