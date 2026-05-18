import type { Paginated } from "@/types/common";
import type { Dut, DutFilters, DutInput, InterfaceTestResult } from "@/types/dut";

import { baselineStore } from "../DataValidation/mockStore";

const seed: Dut[] = [
  {
    id: "d1", site: "s1", site_name: "Taipei Lab", site_environment: "indoor",
    name: "SMO-A", type: "SMO",
    endpoint: "https://smo-a.example.com",
    interfaces: ["O1", "A1"],
    status: "online", response_time_ms: 120, data_format: "NETCONF",
    last_check: new Date().toISOString(), created_at: new Date().toISOString(),
  },
  {
    id: "d2", site: "s1", site_name: "Taipei Lab", site_environment: "indoor",
    name: "Near-RT RIC", type: "Near-RT RIC",
    endpoint: "https://ric.example.com",
    interfaces: ["A1", "E2"],
    status: "online", response_time_ms: 80, data_format: "REST",
    last_check: new Date().toISOString(), created_at: new Date().toISOString(),
  },
  {
    id: "d3", site: "s2", site_name: "Hsinchu Field", site_environment: "outdoor",
    name: "xApp-Traffic", type: "xApp",
    endpoint: "https://xapp.example.com",
    interfaces: ["A1"],
    status: "offline", response_time_ms: null, data_format: "",
    last_check: null, created_at: new Date().toISOString(),
  },
];

const store = new Map<string, Dut>(seed.map((d) => [d.id, d]));

export const mockDutService = {
  async list(filters: DutFilters = {}): Promise<Paginated<Dut>> {
    await new Promise((r) => setTimeout(r, 150));
    let items = [...store.values()];
    if (filters.type) items = items.filter((d) => d.type === filters.type);
    if (filters.status) items = items.filter((d) => d.status === filters.status);
    if (filters.site) items = items.filter((d) => d.site === filters.site);
    if (filters.has_baseline === true) items = items.filter((d) => baselineStore.has(d.id));
    if (filters.has_baseline === false) items = items.filter((d) => !baselineStore.has(d.id));
    return { items, total: items.length, page: 1, limit: items.length || 20 };
  },
  async get(id: string): Promise<Dut> {
    const d = store.get(id);
    if (!d) throw new Error("DUT not found");
    return d;
  },
  async create(input: DutInput): Promise<Dut> {
    const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const dut: Dut = {
      ...input, id, status: "offline", response_time_ms: null,
      data_format: "", last_check: null, created_at: new Date().toISOString(),
    };
    store.set(id, dut);
    return dut;
  },
  async update(id: string, input: Partial<DutInput>): Promise<Dut> {
    const d = await this.get(id);
    const next = { ...d, ...input };
    store.set(id, next);
    return next;
  },
  async remove(id: string): Promise<void> {
    store.delete(id);
  },
  async testInterface(id: string, interfaces: string[]): Promise<InterfaceTestResult> {
    await new Promise((r) => setTimeout(r, 500));
    const results: InterfaceTestResult["results"] = {};
    for (const iface of interfaces) {
      results[iface] = { ok: Math.random() > 0.1, error: null };
    }
    const d = await this.get(id);
    const ok = Object.values(results).every((r) => r.ok);
    store.set(id, { ...d, status: ok ? "online" : "error", last_check: new Date().toISOString() });
    return { dut_id: id, ok, results };
  },
  async healthcheckAll(): Promise<{ ok: boolean }> {
    await new Promise((r) => setTimeout(r, 400));
    for (const [id, d] of store) {
      const ok = Math.random() > 0.2;
      store.set(id, { ...d, status: ok ? "online" : "error", last_check: new Date().toISOString() });
    }
    return { ok: true };
  },
};
