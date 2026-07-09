"""Seed 一組 Near-RT RIC 連接介面驗證的測試案例(A1 / E2 / O1),
內容對齊 O-RAN 規格與 RICtester 的案例形態。scenario 綁 dut_type=
'Near-RT RIC'、validation_type='interface-validation',所以任何
Near-RT RIC DUT 都適用這組案例。"""

from django.db import migrations

SCENARIO = {
    "name": "Near-RT RIC 連接介面驗證",
    "validation_type": "interface-validation",
    "dut_type": "Near-RT RIC",
    "category": "ground-floor",
    "description": "Near-RT RIC 的 E2 / A1 / O1 介面互通性與健康驗證案例。",
}

CASES = [
    {
        "case_id": "E2-SETUP-01",
        "name": "E2 Setup 建立",
        "interface": "E2",
        "priority": "P0",
        "oran_release": "R003",
        "preconditions": "探針可經 SCTP 連到 RIC 的 E2term;已設定 gNB 身分(MCC/MNC/gNB ID)。",
        "test_steps": "1. 探針以 SCTP 連上 E2term\n2. 冒充 gNB 送出 E2 Setup Request(帶 Global gNB ID 與 RAN Functions)\n3. 等待 RIC 回應",
        "expected_result": "RIC 回 E2 Setup Response,帶正確的 Global RIC ID。",
        "pass_criteria": "收到 E2 Setup Response(非 E2 Setup Failure),且 Global RIC ID 欄位存在且合法。",
        "spec_sections": ["O-RAN.WG3.E2AP-v03.00 §8.3.1"],
    },
    {
        "case_id": "E2-SUB-01",
        "name": "E2 Subscription 與 RIC Indication",
        "interface": "E2",
        "priority": "P1",
        "oran_release": "R003",
        "preconditions": "E2 Setup 已完成;目標 RAN Function 支援 REPORT 服務。",
        "test_steps": "1. 送 RIC Subscription Request(event trigger + action=REPORT)\n2. 等 RIC Subscription Response\n3. 觀察後續是否收到 RIC Indication",
        "expected_result": "收到 RIC Subscription Response(admitted),並週期性收到 RIC Indication。",
        "pass_criteria": "Subscription 成功(有 admitted action),且在時限內至少收到 1 筆 RIC Indication。",
        "spec_sections": ["O-RAN.WG3.E2AP-v03.00 §8.2.1"],
    },
    {
        "case_id": "A1-PT-01",
        "name": "A1 Policy Type 建立與查詢",
        "interface": "A1",
        "priority": "P0",
        "oran_release": "R003",
        "preconditions": "a1mediator A1-P 端點可用(HTTP)。",
        "test_steps": "1. PUT /a1-p/policytypes/{id}(帶 policy type schema)\n2. GET /a1-p/policytypes 應含該 id\n3. GET /a1-p/policytypes/{id} 取回 schema",
        "expected_result": "Policy type 建立成功且可查詢。",
        "pass_criteria": "PUT 回 201/200,且 policytypes 清單包含建立的 id。",
        "spec_sections": ["O-RAN.WG2.A1AP-v03.01 §A1-P"],
    },
    {
        "case_id": "A1-POLICY-01",
        "name": "A1 Policy 實例建立與強制",
        "interface": "A1",
        "priority": "P1",
        "oran_release": "R003",
        "preconditions": "對應的 A1 Policy Type 已存在。",
        "test_steps": "1. PUT policy instance(帶 policy type + policy body)\n2. GET policy status\n3. 確認狀態轉為 ENFORCED",
        "expected_result": "Policy 實例被 RIC/xApp 接受並強制執行。",
        "pass_criteria": "GET status 在時限內回 ENFORCED(非 NOT_ENFORCED)。",
        "spec_sections": ["O-RAN.WG2.A1AP-v03.01 §Policy Status"],
    },
    {
        "case_id": "O1-NETCONF-01",
        "name": "O1 NETCONF 連線與取得設定",
        "interface": "O1",
        "priority": "P0",
        "oran_release": "R003",
        "preconditions": "o1mediator NETCONF(SSH)可達;已設定帳密。",
        "test_steps": "1. 建立 NETCONF over SSH session、交換 <hello>\n2. 送 <get-config>(source=running)\n3. 解析回傳的 config",
        "expected_result": "NETCONF session 建立,取得 running 設定。",
        "pass_criteria": "SSH/NETCONF 交握成功,<get-config> 回合法 XML(含 O-RAN YANG 節點)。",
        "spec_sections": ["O-RAN.WG10.O1-Interface §NETCONF"],
    },
    {
        "case_id": "O1-PM-01",
        "name": "O1 效能量測(PM)檔案讀取",
        "interface": "O1",
        "priority": "P2",
        "oran_release": "R003",
        "preconditions": "O1 NETCONF 連線正常;PM 收集已啟用。",
        "test_steps": "1. 訂閱/拉取 PM 量測檔\n2. 下載最新一筆 PM file\n3. 驗證檔案格式與計數器欄位",
        "expected_result": "取得 PM 檔且格式正確。",
        "pass_criteria": "成功取得至少 1 筆 PM file,且必要計數器欄位存在。",
        "spec_sections": ["O-RAN.WG10.O1-Interface §PM"],
    },
]


def seed(apps, schema_editor):
    TestScenario = apps.get_model("scenarios", "TestScenario")
    TestCase = apps.get_model("scenarios", "TestCase")
    scenario, _ = TestScenario.objects.get_or_create(
        validation_type=SCENARIO["validation_type"],
        dut_type=SCENARIO["dut_type"],
        name=SCENARIO["name"],
        defaults={
            "category": SCENARIO["category"],
            "description": SCENARIO["description"],
        },
    )
    for c in CASES:
        TestCase.objects.get_or_create(
            scenario=scenario,
            case_id=c["case_id"],
            defaults={
                "name": c["name"],
                "interface": c["interface"],
                "priority": c["priority"],
                "oran_release": c["oran_release"],
                "preconditions": c["preconditions"],
                "test_steps": c["test_steps"],
                "expected_result": c["expected_result"],
                "pass_criteria": c["pass_criteria"],
                "spec_sections": c["spec_sections"],
            },
        )


def unseed(apps, schema_editor):
    TestScenario = apps.get_model("scenarios", "TestScenario")
    TestScenario.objects.filter(
        validation_type=SCENARIO["validation_type"],
        dut_type=SCENARIO["dut_type"],
        name=SCENARIO["name"],
    ).delete()  # cascade 刪掉底下 cases


class Migration(migrations.Migration):

    dependencies = [
        ("scenarios", "0007_testcase_interface_oran_release_spec_url"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
