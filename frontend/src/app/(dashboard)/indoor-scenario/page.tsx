import { FieldTestScenarioContainer } from "@/components/FieldTest/FieldTestScenarioContainer";

/** 舊 href:左螢幕直接指定室內情境;畫面與 /smart-network 相同,牆上仍可切換 */
export default function IndoorScenarioPage() {
  return <FieldTestScenarioContainer initial="indoor" />;
}
