import { authService as realAuth } from "./Auth/authService";
import { mockAuthService } from "./Auth/mockAuthService";
import { dataQualityService as realDataQuality } from "./DataValidation/dataQualityService";
import { mockDataQualityService } from "./DataValidation/mockDataQualityService";
import { dutService as realDut } from "./Dut/dutService";
import { mockDutService } from "./Dut/mockDutService";
import { mockOverviewService } from "./Overview/mockOverviewService";
import { overviewService as realOverview } from "./Overview/overviewService";
import { mockScenarioService } from "./Scenario/mockScenarioService";
import { scenarioService as realScenario } from "./Scenario/scenarioService";
import { mockSelectionService } from "./Selection/mockSelectionService";
import { selectionService as realSelection } from "./Selection/selectionService";
import { mockSitesService } from "./Site/mockSitesService";
import { sitesService as realSites } from "./Site/sitesService";
import { mockValidationRunService } from "./ValidationRun/mockValidationRunService";
import { validationRunService as realValidationRun } from "./ValidationRun/validationRunService";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const authService = USE_MOCK ? mockAuthService : realAuth;
export const overviewService = USE_MOCK ? mockOverviewService : realOverview;
export const dutService = USE_MOCK ? mockDutService : realDut;
export const sitesService = USE_MOCK ? mockSitesService : realSites;
export const dataQualityService = USE_MOCK ? mockDataQualityService : realDataQuality;
export const scenarioService = USE_MOCK ? mockScenarioService : realScenario;
// 牆選擇:mock 走前端 BroadcastChannel(單機 demo);real 走後端
// /api/selection + WS /ws/selection(跨電腦,別團隊左 app 才能連動)。
export const selectionService = USE_MOCK ? mockSelectionService : realSelection;
export const validationRunService = USE_MOCK ? mockValidationRunService : realValidationRun;
