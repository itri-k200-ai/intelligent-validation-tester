"use client";
import { useQuery } from "@tanstack/react-query";

import { DEFAULT_RIC_SOURCE, type RicSourceId } from "@/config/ricSources";
import { ricBackend } from "@/services/Backend/ricBackendService";

export type RicDut = {
  dut_uuid: string;
  dut_name: string;
  dut_kind: string;
  dut_product: string;
  dut_version: string;
  dut_description: string;
  dut_mcc: string;
  dut_mnc: string;
  dut_gnb_id: string;
  dut_cell_id: string;
  dut_status: string;
};

export type RicDutEndpoint = {
  dut_endpoint_uuid: string;
  dut_endpoint_interface: string;
  dut_endpoint_address: string;
  dut_endpoint_username: string;
  dut_endpoint_status: string;
};

export type RicDutDetail = {
  dut: RicDut | null;
  endpoints: RicDutEndpoint[];
};

/**
 * 用左牆選的 dutName 去 RICtester back_end 反查完整 DUT + 介面連線端點。
 * 中/右牆的「受測物明細」來源。
 */
export function useRicDutDetail(dutName: string | null, source?: RicSourceId) {
  const query = useQuery({
    queryKey: ["ric", "dut-detail", source ?? DEFAULT_RIC_SOURCE, dutName],
    enabled: !!dutName,
    queryFn: async (): Promise<RicDutDetail> => {
      const duts = await ricBackend.duts({ dut_name: dutName }, source);
      const dut = (duts[0] as RicDut) ?? null;
      if (!dut) return { dut: null, endpoints: [] };
      const endpoints = (await ricBackend.dutEndpoints(
        { f_dut_uuid: dut.dut_uuid },
        source,
      )) as RicDutEndpoint[];
      return { dut, endpoints };
    },
  });
  return {
    detail: query.data ?? { dut: null, endpoints: [] },
    isLoading: query.isLoading,
  };
}
