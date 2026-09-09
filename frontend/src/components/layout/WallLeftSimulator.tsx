"use client";
import { useState } from "react";

import { RIC_SOURCES, type RicSourceId } from "@/config/ricSources";
import { selectionService } from "@/services";
import {
  ADAPTER_OPS,
  runAdapterOp,
  type AdapterOp,
  type OpResult,
} from "@/services/Adapter/adapterOps";

/**
 * 左螢幕 —— 模擬「共通性測試平台」打進 tester adapter。
 *
 * 依 docs/外部文件/後端規格/2026-08-28_共通性測試平台與tester介接之整合測項.pdf
 * 的 26 個測項(整理成 11 支 API)逐支發送,顯示狀態碼、耗時與回應,
 * 方便對照規格驗收。這是模擬器,不是給現場操作員的正式介面。
 *
 * 驅動測試成功後會把回傳的 runningId 寫進 IVT selection,中牆據此接手輪詢
 * —— 這條路徑就是之後正式串接時左端該做的事。
 */

const PARAM_LABEL: Record<string, string> = {
  scenarioId: "案例 ID",
  testcaseId: "測項 ID",
  runningId: "執行 ID",
  dutName: "待測物名稱",
  name: "名稱",
};

const METHOD_TONE: Record<string, string> = {
  GET: "sim-method--get",
  POST: "sim-method--post",
  PUT: "sim-method--put",
  DELETE: "sim-method--delete",
};

/** 目錄:DUT → 案例 → 測項,供下拉選單用。 */
type CatTestcase = { id: string; name: string };
type CatScenario = { id: string; name: string; testcases: CatTestcase[] };
type CatDut = { name: string; scenarios: CatScenario[] };

/** 取名稱時相容 v2.0 的扁平欄位與 v2.1 的 _en / _zh。 */
const pick = (o: Record<string, unknown>, base: string): string => {
  for (const k of [`${base}_en`, base, `${base}_zh`]) {
    const v = o?.[k];
    if (typeof v === "string" && v) return v;
  }
  return "";
};

/** 把 testList 回應解析成目錄;格式不如預期就回空陣列(退回手動輸入)。 */
function catalogFrom(text: string): CatDut[] {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    return data.map((d) => ({
      name: pick(d, "dutName"),
      scenarios: (Array.isArray(d?.scenarioList) ? d.scenarioList : []).map(
        (sc: Record<string, unknown>) => ({
          id: String(sc?.scenarioId ?? ""),
          name: pick(sc, "scenarioName"),
          testcases: (Array.isArray(sc?.testcaseList) ? sc.testcaseList : []).map(
            (tc: Record<string, unknown>) => ({
              id: String(tc?.testcaseId ?? ""),
              name: pick(tc, "testcaseName"),
            }),
          ),
        }),
      ),
    }));
  } catch {
    return [];
  }
}

export function WallLeftSimulator({ embedded = false }: { embedded?: boolean }) {
  const [source, setSource] = useState<RicSourceId>(RIC_SOURCES[0].id);
  const [params, setParams] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<number | null>(null);
  const [lastOp, setLastOp] = useState<AdapterOp | null>(null);
  const [result, setResult] = useState<OpResult | null>(null);
  /** #1 取回的目錄 —— 有了就把 ID 欄位換成下拉,不用手打 */
  const [catalog, setCatalog] = useState<CatDut[]>([]);
  /** 目前設給中牆看的 DUT */
  const [viewing, setViewing] = useState<string | null>(null);
  /** 驅動過的 runningId,供下拉挑選 */
  const [runIds, setRunIds] = useState<string[]>([]);

  /**
   * 改參數。dutName / scenarioId / testcaseId 這三個同時也是「中牆要顯示
   * 什麼」的識別,所以一改就寫進 selection —— 中牆立刻跟著換,不用等到
   * 驅動測試。其餘欄位(名稱、執行 ID)只是 request 參數,不同步。
   */
  const VIEW_KEYS = ["dutName", "scenarioId", "testcaseId"];
  const setParam = (k: string, v: string) => {
    setParams((prev) => {
      const next = { ...prev, [k]: v };
      // 換 DUT 時把下層選擇清掉,免得留下不屬於這台的 ID
      if (k === "dutName") {
        next.scenarioId = "";
        next.testcaseId = "";
      } else if (k === "scenarioId") {
        next.testcaseId = "";
      }
      if (VIEW_KEYS.includes(k)) syncView(next);
      return next;
    });
  };

  /** 把目前的檢視選擇寫進 IVT selection(中牆訂閱這個)。 */
  const syncView = (p: Record<string, string>) => {
    if (!p.dutName) return;
    setViewing(p.dutName);
    void selectionService
      .setSelection({
        source,
        dutName: p.dutName,
        ...(p.scenarioId ? { scenarioId: p.scenarioId } : {}),
        ...(p.testcaseId ? { testcaseId: p.testcaseId } : {}),
        href: `/interface-validation/${source === "near" ? "near-rt-ric" : "non-rt-ric"}`,
        label: p.dutName,
      })
      .catch(() => {});
  };

  /**
   * 目前選定案例底下的所有測項 —— 「驅動測試」以案例為單位,body 要帶整包
   * testcaseId(見 adapterOps #15)。目錄要先按過「取得測試案例與項目」
   * 才有,沒有就是空陣列,按鈕會被停用。
   */
  const scenarioTestcases =
    catalog
      .flatMap((d) => d.scenarios)
      .find((sc) => sc.id === params.scenarioId)?.testcases ?? [];
  const scenarioTestcaseIds = scenarioTestcases.map((tc) => tc.id).filter(Boolean);

  const fire = async (op: AdapterOp) => {
    setRunning(op.no);
    setLastOp(op);
    const res = await runAdapterOp(source, op, params, { scenarioTestcaseIds });
    setResult(res);
    setRunning(null);

    // 取得測試案例 → 存成目錄,下面的 ID 欄位就能改用下拉挑選
    if (op.no === 1) setCatalog(res.ok ? catalogFrom(res.full) : []);

    // 驅動測試成功 → 把 runningId 帶回,並寫進 selection 讓中牆接手輪詢。
    if (op.no === 15 && res.ok) {
      try {
        const data = JSON.parse(res.full);
        const list: { testCaseId?: string; testcaseId?: string; runningId: string }[] =
          data.testProject ?? [];
        const runnings = list.map((p) => ({
          testcaseId: p.testCaseId ?? p.testcaseId ?? "",
          runningId: p.runningId,
        }));
        const ids = runnings.map((r) => r.runningId).filter(Boolean);
        if (ids.length) {
          setRunIds((prev) => [...new Set([...ids, ...prev])].slice(0, 20));
          setParam("runningId", ids[0]);
        }
        if (runnings.length) {
          await selectionService
            .setSelection({
              source,
              // 中牆的測試項目是以案例分組顯示的,要知道跑的是哪一個案例
              ...(params.scenarioId ? { scenarioId: params.scenarioId } : {}),
              runnings,
              runStartedAt: new Date().toISOString(),
            })
            .catch(() => {});
        }
      } catch {
        /* 回應格式不如預期就只顯示原始內容 */
      }
    }
  };

  // 這支操作缺哪些必填參數 —— 缺就把按鈕停用,避免送出必然失敗的請求
  const missing = (op: AdapterOp) => {
    const lack = (op.needs ?? []).filter((k) => !params[k]?.trim());
    // 驅動是整個案例送出去,案例裡沒有測項就沒東西可送
    if (op.no === 15 && lack.length === 0 && scenarioTestcaseIds.length === 0)
      return ["該案例沒有測項"];
    return lack;
  };

  // 取得測試案例後,可直接把某台 DUT 設成中牆的檢視目標 —— 中牆是讀
  // selection 的 dutName/source 決定要顯示誰,這條路徑等於模擬左端的
  // 「我現在要看這台」。
  const dutNames = catalog.map((d) => d.name).filter(Boolean);
  const setWallView = (dutName: string) => setParam("dutName", dutName);

  /**
   * 各參數欄的下拉選項。回 null 代表沒有可選清單 → 退回手動輸入。
   * scenarioId 依已選的 dutName 過濾、testcaseId 再依 scenarioId 過濾,
   * 避免選到不屬於該 DUT 的 ID。
   */
  const optionsFor = (k: string): { value: string; label: string }[] | null => {
    if (k === "name") return null;                    // 新名稱一定要自己打
    if (k === "runningId")
      return runIds.length ? runIds.map((r) => ({ value: r, label: r })) : null;
    if (!catalog.length) return null;                 // 還沒按 #1

    if (k === "dutName")
      return catalog.map((d) => ({ value: d.name, label: d.name }));

    const dut = catalog.find((d) => d.name === params.dutName);
    const scenarios = (dut ? dut.scenarios : catalog.flatMap((d) => d.scenarios));

    if (k === "scenarioId")
      return scenarios.map((sc) => ({
        value: sc.id,
        label: `${sc.name || "(未命名)"} · ${sc.id}`,
      }));

    if (k === "testcaseId") {
      const scoped = params.scenarioId
        ? scenarios.filter((sc) => sc.id === params.scenarioId)
        : scenarios;
      return scoped.flatMap((sc) =>
        sc.testcases.map((tc) => ({
          value: tc.id,
          label: `${tc.name || "(未命名)"} · ${tc.id}`,
        })),
      );
    }
    return null;
  };

  const groups = [...new Set(ADAPTER_OPS.map((o) => o.group))];
  const usedParams = [...new Set(ADAPTER_OPS.flatMap((o) => o.needs ?? []))];

  return (
    <div className={`sim-root ${embedded ? "sim-root--embedded" : ""}`}>
      <header className="sim-header">
        <div className="sim-title">共通性測試平台模擬器</div>
        <div className="sim-sub">
          依「共通性測試平台與 Tester 介接之整合測項」逐支發送 · 成功 200 / 代碼 0x000
        </div>
        <div className="sim-sources">
          {RIC_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSource(s.id);
                // 不同套 tester 的 ID 不通用,換來源就清掉目錄與已填的 ID
                setCatalog([]);
                setRunIds([]);
                setParams({});
                setResult(null);
                setLastOp(null);
              }}
              className={`sim-source ${source === s.id ? "is-active" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <section className="sim-params">
        {usedParams.map((k) => {
          const opts = optionsFor(k);
          return (
            <label key={k} className="sim-param">
              <span className="sim-param-label">
                {PARAM_LABEL[k] ?? k}
                {opts && <span className="sim-param-hint">可選 {opts.length}</span>}
              </span>
              {opts ? (
                <select
                  className="sim-param-input"
                  value={params[k] ?? ""}
                  onChange={(e) => setParam(k, e.target.value)}
                >
                  <option value="">— 請選擇 —</option>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="sim-param-input"
                  value={params[k] ?? ""}
                  onChange={(e) => setParam(k, e.target.value)}
                  placeholder={k === "name" ? "自行輸入" : "先按 #1 取得清單"}
                />
              )}
            </label>
          );
        })}
      </section>

      {dutNames.length > 0 && (
        <section className="sim-view">
          <div className="sim-view-label">設為中牆檢視</div>
          <div className="sim-view-list">
            {dutNames.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWallView(n)}
                className={`sim-view-btn ${viewing === n ? "is-active" : ""}`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      <nav className="sim-ops">
        {groups.map((g) => (
          <div key={g} className="sim-group">
            <div className="sim-group-name">{g}</div>
            {ADAPTER_OPS.filter((o) => o.group === g).map((op) => {
              const lack = missing(op);
              return (
                <button
                  key={op.no}
                  type="button"
                  disabled={running !== null || lack.length > 0}
                  onClick={() => fire(op)}
                  title={
                    lack.length
                      ? `需要先填:${lack.map((k) => PARAM_LABEL[k] ?? k).join("、")}`
                      : `${op.method} ${op.path}`
                  }
                  className={`sim-op ${lastOp?.no === op.no ? "is-last" : ""}`}
                >
                  <span className="sim-op-no">#{op.no}</span>
                  <span className={`sim-method ${METHOD_TONE[op.method]}`}>{op.method}</span>
                  <span className="sim-op-label">
                    {op.label}
                    {/* 驅動是整包送出,先讓操作者看到這次會跑幾項 */}
                    {op.no === 15 && scenarioTestcaseIds.length > 0 && (
                      <span className="sim-op-count"> · {scenarioTestcaseIds.length} 項</span>
                    )}
                  </span>
                  <span className="sim-op-err">{op.errorCode}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <section className="sim-result">
        <div className="sim-result-head">
          <span className="sim-result-title">
            {lastOp ? `#${lastOp.no} ${lastOp.label}` : "回應"}
          </span>
          {result && (
            <span className={`sim-status ${result.ok ? "is-ok" : "is-fail"}`}>
              {result.status || "連線失敗"} · {result.ms}ms
            </span>
          )}
        </div>
        {lastOp && (
          <div className="sim-result-url">
            {lastOp.method} {lastOp.path}
          </div>
        )}
        <pre className="sim-result-body">
          {running !== null
            ? "送出中…"
            : (result?.text ?? "尚未送出任何請求 —— 點上面的操作開始。")}
        </pre>
      </section>
    </div>
  );
}
