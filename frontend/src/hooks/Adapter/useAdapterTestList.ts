"use client";
import { useQuery } from "@tanstack/react-query";

import { adapterService, type AdapterDut } from "@/services/Adapter/adapterService";

/**
 * RICtester adapter 的完整測試清單(DUT → scenario → testcase)。
 * 電視牆左選單的資料來源。
 */
export function useAdapterTestList() {
  const query = useQuery({
    queryKey: ["adapter", "testList"],
    queryFn: (): Promise<AdapterDut[]> => adapterService.testList(),
    refetchInterval: 15000,
  });
  return {
    duts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
