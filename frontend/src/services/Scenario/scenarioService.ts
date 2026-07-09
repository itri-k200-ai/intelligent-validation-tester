import type { Paginated } from "@/types/common";
import type {
  ScenarioFilters,
  TestCase,
  TestScenario,
  TestScenarioInput,
} from "@/types/scenario";

import { apiClient } from "../api/client";

export const scenarioService = {
  // 某 DUT 類型的「連接介面驗證」scenario(P1:拿它底下的案例清單)
  async findInterfaceScenario(dutType: string): Promise<TestScenario | null> {
    const { data } = await apiClient.get("/scenarios/", {
      params: { validation_type: "interface-validation", dut_type: dutType },
    });
    return data.items?.[0] ?? null;
  },
  async listCases(scenarioId: string): Promise<TestCase[]> {
    const { data } = await apiClient.get("/test-cases/", {
      params: { scenario: scenarioId, limit: 100 },
    });
    return data.items ?? [];
  },
  async list(filters: ScenarioFilters = {}): Promise<Paginated<TestScenario>> {
    const { data } = await apiClient.get("/scenarios/", { params: filters });
    return data;
  },
  async get(id: string): Promise<TestScenario> {
    const { data } = await apiClient.get(`/scenarios/${id}/`);
    return data;
  },
  async create(input: TestScenarioInput): Promise<TestScenario> {
    const { data } = await apiClient.post("/scenarios/", input);
    return data;
  },
  async update(id: string, input: Partial<TestScenarioInput>): Promise<TestScenario> {
    const { data } = await apiClient.patch(`/scenarios/${id}/`, input);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/scenarios/${id}/`);
  },
};
