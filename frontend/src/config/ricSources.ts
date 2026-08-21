// ── RICtester 來源(可同時接多套獨立部署的 tester)────────────────
//
// 10.194.87.120 上跑著數套彼此獨立的 RICtester(各自一組 front-end /
// back-end / adapter / DB),依受測物種類分開:
//
//   NearRICTester  back_end :5000  adapter :5100  → Lab Near-RT RIC(E2/A1/O1)
//   NonRICTester   back_end :5010  adapter :5110  → Lab Non-RT RIC(A1/EI/SME/R1/DME/AIML)
//   (xApp tester   back_end :5020  adapter :5120  → 目前不接)
//
// IVT nginx 把每一套代理到自己的路徑前綴,前端同時抓取後合併顯示。
// 要新增/移除一套:改這裡 + deploy/nginx.conf.template + deploy/.env,
// 其餘程式不用動。
export type RicSourceId = "near" | "non";

export type RicSource = {
  id: RicSourceId;
  /** 牆上顯示的來源名稱(左牆分組標題)。 */
  label: string;
  /** 經 IVT nginx 的路徑前綴;adapter 走 {base}/autoTest/*、back_end 走 {base}/api/back_end/*。 */
  base: string;
};

export const RIC_SOURCES: RicSource[] = [
  { id: "near", label: "Near-RT RIC", base: "/ric/near" },
  { id: "non", label: "Non-RT RIC", base: "/ric/non" },
];

export const DEFAULT_RIC_SOURCE: RicSourceId = "near";

export function ricSourceBase(id: RicSourceId | null | undefined): string {
  return RIC_SOURCES.find((s) => s.id === id)?.base ?? RIC_SOURCES[0].base;
}

export function ricSourceLabel(id: RicSourceId | null | undefined): string {
  return RIC_SOURCES.find((s) => s.id === id)?.label ?? "";
}
