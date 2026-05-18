import type { DutType, Interface } from "./common";
import type { Environment } from "./site";

export type DutStatus = "online" | "offline" | "error";

export type AccessMode =
  | "on_site"
  | "remote_vpn"
  | "remote_public"
  | "shipped"
  | "simulator_local"
  | "sandbox_only"
  | "unknown";

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  on_site: "本地實驗室自接",
  remote_vpn: "遠端 VPN",
  remote_public: "公網 IP + jump host",
  shipped: "對方寄機器來",
  simulator_local: "本機模擬器",
  sandbox_only: "純沙箱 / 紙上",
  unknown: "未指定",
};

export const DEFAULT_INTERFACES: Record<DutType, Interface[]> = {
  SMO: ["O1", "A1"],
  "Near-RT RIC": ["A1", "E2"],
  "Non-RT RIC": ["A1", "O1"],  // Non-RT 在 SMO 內透過 A1 對外 + O1 拉資料
  xApp: ["E2"],
  rApp: ["A1", "O1"],
};

export const AVAILABLE_INTERFACES: Record<DutType, Interface[]> = {
  SMO: ["O1", "A1"],
  "Near-RT RIC": ["A1", "E2", "O1"],
  "Non-RT RIC": ["A1", "O1"],
  xApp: ["E2"],
  rApp: ["A1", "O1"],
};

export type Dut = {
  id: string;
  site: string;
  site_name?: string;
  site_environment?: Environment;
  name: string;
  type: DutType;
  endpoint: string;
  interfaces: Interface[];
  status: DutStatus;
  response_time_ms: number | null;
  data_format: string;
  last_check: string | null;
  created_at: string;
  // backend 一定有預設（access_mode=unknown / access_notes=""），但 TS 上
  // 標 optional 讓 mock data 跟舊 fixture 不用全補。
  access_mode?: AccessMode;
  access_notes?: string;
  vendor?: string;
  model?: string;
  firmware_version?: string;
  serial_number?: string;
  deployed_at?: string | null;
  contact_email?: string;
  config_snapshot?: Record<string, unknown>;
};

export type DutInput = Omit<Dut,
  "id" | "site_name" | "site_environment" | "status" | "response_time_ms" | "data_format" | "last_check" | "created_at">;

export type DutFilters = {
  type?: DutType;
  status?: DutStatus;
  site?: string;
  has_baseline?: boolean;
  page?: number;
  limit?: number;
};

export type InterfaceTestResult = {
  dut_id: string;
  ok: boolean;
  results: Record<string, { ok: boolean; error: string | null }>;
};
