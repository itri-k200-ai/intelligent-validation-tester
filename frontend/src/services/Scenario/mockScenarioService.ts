import type { Paginated } from "@/types/common";
import type { ScenarioFilters, TestScenario, TestScenarioInput } from "@/types/scenario";

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
};
