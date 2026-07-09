import type { DutType, Region } from "./common";

export type ValidationType = "data-validation" | "intelligence-validation" | "interface-validation";

export type ScenarioCategory = "underground" | "ground-floor" | "high-floor";

export const SCENARIO_CATEGORY_LABEL: Record<ScenarioCategory, string> = {
  underground: "地下樓層",
  "ground-floor": "地面樓層",
  "high-floor": "高樓層",
};

export const VALIDATION_TYPE_LABEL: Record<ValidationType, string> = {
  "data-validation": "資料品質驗證",
  "intelligence-validation": "智慧程度驗證",
  "interface-validation": "連接介面驗證",
};

export type TestScenario = {
  id: string;
  name: string;
  site: string | null;
  site_name: string | null;
  site_region: Region | null;
  site_location: { lat: number; lng: number } | null;
  source_dut: string | null;
  source_dut_name: string | null;
  source_dut_type: DutType | null;
  validation_type: ValidationType;
  dut_type: string;
  ai_case: string;
  category: ScenarioCategory;
  collected_at: string | null;
  row_count: number | null;
  description: string;
  parameters: Record<string, unknown>;
  created_at: string;
};

export type TestScenarioInput = {
  name: string;
  site: string;
  source_dut?: string | null;
  validation_type: ValidationType;
  dut_type?: string;
  ai_case?: string;
  category: ScenarioCategory;
  collected_at?: string | null;
  row_count?: number | null;
  description?: string;
  parameters?: Record<string, unknown>;
};

export type TestCase = {
  id: string;
  scenario: string;
  case_id: string;
  name: string;
  priority: "P0" | "P1" | "P2";
  interface: string;
  oran_release: string;
  spec_url: string;
  preconditions: string;
  test_steps: string;
  expected_result: string;
  pass_criteria: string;
  spec_sections: string[];
  tags: string[];
};

export type ScenarioFilters = {
  validation_type?: ValidationType;
  category?: ScenarioCategory;
  dut_type?: string;
  ai_case?: string;
  site?: string;
  page?: number;
  limit?: number;
};
