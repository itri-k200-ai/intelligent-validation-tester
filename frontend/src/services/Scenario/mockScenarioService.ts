import type { Paginated } from "@/types/common";
import type {
  ScenarioFilters,
  TestCase,
  TestScenario,
  TestScenarioInput,
} from "@/types/scenario";

// Near-RT RIC 連接介面驗證的 mock 案例(對齊後端 seed,mock demo image 也看得到)。
const mockCases: TestCase[] = [
  {
    id: "mc-e2-1", scenario: "sc-ric-if", case_id: "E2-SETUP-01", name: "E2 Setup 建立",
    priority: "P0", interface: "E2", oran_release: "R003", spec_url: "",
    preconditions: "探針可經 SCTP 連到 RIC 的 E2term。",
    test_steps: "1. 探針以 SCTP 連上 E2term\n2. 送 E2 Setup Request\n3. 等待回應",
    expected_result: "RIC 回 E2 Setup Response。",
    pass_criteria: "收到 E2 Setup Response 且 Global RIC ID 合法。",
    spec_sections: ["O-RAN.WG3.E2AP-v03.00 §8.3.1"], tags: [],
  },
  {
    id: "mc-a1-1", scenario: "sc-ric-if", case_id: "A1-PT-01", name: "A1 Policy Type 建立與查詢",
    priority: "P0", interface: "A1", oran_release: "R003", spec_url: "",
    preconditions: "a1mediator A1-P 端點可用。",
    test_steps: "1. PUT policytype\n2. GET policytypes 應含該 id",
    expected_result: "Policy type 建立成功且可查詢。",
    pass_criteria: "PUT 回 201/200,清單包含建立的 id。",
    spec_sections: ["O-RAN.WG2.A1AP-v03.01 §A1-P"], tags: [],
  },
  {
    id: "mc-o1-1", scenario: "sc-ric-if", case_id: "O1-NETCONF-01", name: "O1 NETCONF 連線與取得設定",
    priority: "P0", interface: "O1", oran_release: "R003", spec_url: "",
    preconditions: "o1mediator NETCONF 可達。",
    test_steps: "1. NETCONF over SSH 交握\n2. <get-config> source=running",
    expected_result: "取得 running 設定。",
    pass_criteria: "交握成功,回合法 XML。",
    spec_sections: ["O-RAN.WG10.O1-Interface §NETCONF"], tags: [],
  },
];

const seed: TestScenario[] = [
  {
    id: "sc1", name: "地下停車場 RSRP 量測",
    site: "s1", site_name: "Taipei Lab", site_region: "domestic",
    site_location: { lat: 25.0342, lng: 121.5645 },
    source_dut: "d1", source_dut_name: "SMO-A", source_dut_type: "SMO",
    validation_type: "data-validation", dut_type: "SMO", ai_case: "CCO",
    category: "underground",
    collected_at: "2026-04-15T09:00:00Z", row_count: 10230,
    description: "", parameters: {}, created_at: new Date().toISOString(),
  },
  {
    id: "sc2", name: "地面層人流壅塞",
    site: "s1", site_name: "Taipei Lab", site_region: "domestic",
    site_location: { lat: 25.0342, lng: 121.5645 },
    source_dut: "d2", source_dut_name: "Near-RT RIC", source_dut_type: "Near-RT RIC",
    validation_type: "data-validation", dut_type: "Near-RT RIC", ai_case: "Load Balance",
    category: "ground-floor",
    collected_at: "2026-04-18T14:30:00Z", row_count: 5821,
    description: "", parameters: {}, created_at: new Date().toISOString(),
  },
];

const store = new Map<string, TestScenario>(seed.map((s) => [s.id, s]));

export const mockScenarioService = {
  async list(filters: ScenarioFilters = {}): Promise<Paginated<TestScenario>> {
    await new Promise((r) => setTimeout(r, 120));
    let items = [...store.values()];
    if (filters.validation_type) items = items.filter((s) => s.validation_type === filters.validation_type);
    if (filters.category) items = items.filter((s) => s.category === filters.category);
    if (filters.dut_type) items = items.filter((s) => s.dut_type === filters.dut_type);
    if (filters.ai_case) items = items.filter((s) => s.ai_case === filters.ai_case);
    if (filters.site) items = items.filter((s) => s.site === filters.site);
    return { items, total: items.length, page: 1, limit: items.length || 20 };
  },
  async get(id: string): Promise<TestScenario> {
    const s = store.get(id);
    if (!s) throw new Error("Scenario not found");
    return s;
  },
  async create(input: TestScenarioInput): Promise<TestScenario> {
    const id = `mock-${Date.now()}`;
    const sc: TestScenario = {
      id,
      name: input.name,
      site: input.site, site_name: null, site_region: null, site_location: null,
      source_dut: input.source_dut ?? null, source_dut_name: null, source_dut_type: null,
      validation_type: input.validation_type,
      dut_type: input.dut_type ?? "", ai_case: input.ai_case ?? "",
      category: input.category,
      collected_at: input.collected_at ?? null,
      row_count: input.row_count ?? null,
      description: input.description ?? "", parameters: input.parameters ?? {},
      created_at: new Date().toISOString(),
    };
    store.set(id, sc);
    return sc;
  },
  async update(id: string, input: Partial<TestScenarioInput>): Promise<TestScenario> {
    const s = await this.get(id);
    const next = { ...s, ...input } as TestScenario;
    store.set(id, next);
    return next;
  },
  async remove(id: string): Promise<void> {
    store.delete(id);
  },
  async findInterfaceScenario(dutType: string): Promise<TestScenario | null> {
    if (dutType !== "Near-RT RIC") return null;
    return {
      id: "sc-ric-if", name: "Near-RT RIC 連接介面驗證",
      site: null, site_name: null, site_region: null, site_location: null,
      source_dut: null, source_dut_name: null, source_dut_type: null,
      validation_type: "interface-validation", dut_type: "Near-RT RIC", ai_case: "",
      category: "ground-floor", collected_at: null, row_count: null,
      description: "", parameters: {}, created_at: new Date().toISOString(),
    };
  },
  async listCases(scenarioId: string): Promise<TestCase[]> {
    return scenarioId === "sc-ric-if" ? mockCases : [];
  },
};
