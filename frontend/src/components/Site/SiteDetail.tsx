"use client";
import { Settings2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CollapsibleCard } from "@/components/common/CollapsibleCard";
import { RightWingSlots } from "@/components/layout/RightWingSlots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSiteTopology } from "@/hooks/Site/useSiteTopology";
import { useIsEditing } from "@/stores/editModeStore";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { Site, SiteCamera } from "@/types/site";

import { CameraList } from "./CameraList";
import { EditModeToggle } from "./EditModeToggle";
import { HlsPlayer } from "./HlsPlayer";
import { SiteSettingsDialog } from "./SiteSettingsDialog";
import { SiteLayoutCanvas } from "./SiteLayoutCanvas";
import { StationList } from "./StationList";
import { TopologyCanvas } from "./TopologyCanvas";
import { TopologyLinkEditor } from "./TopologyLinkEditor";


const ENV_LABEL: Record<string, string> = { indoor: "室內", outdoor: "室外" };

export function SiteDetail({ site }: { site: Site }) {
  const { data, isLoading } = useSiteTopology(site.id);
  const stations = data?.stations ?? [];
  const links = data?.links ?? [];
  const gnbStations = stations.filter((s) => s.node_type === "gnb");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 電視牆模式:點地圖上的攝影機 → state 升到這裡,右邊 panel 直接 render 播放器
  // (取代原本的 Dialog)。一般模式 selectedCamera 永遠 null,SiteLayoutCanvas
  // 內部 fallback 到 Dialog 行為。
  const [selectedCamera, setSelectedCamera] = useState<SiteCamera | null>(null);
  const isEditing = useIsEditing();
  const isWall = useIsWallMode();

  // 切換場域時清空選中的攝影機,避免上一個 site 的串流停留在 panel 上
  useEffect(() => {
    setSelectedCamera(null);
  }, [site.id]);

  return (
    <div className={isWall ? "site-wall-root" : "space-y-4"}>
      {/* 電視牆模式:把網元 / 攝影機 / 拓樸 從主牆移到右副牆下半三格 slot,
          主牆只留場域基本資訊 + 實體地圖,內容不需捲動或折疊。 */}
      {isWall && (
        <RightWingSlots
          dut={
            <SlotPanel title="網元" subtitle={`${stations.length} 個`}>
              <StationList siteId={site.id} stations={stations} />
            </SlotPanel>
          }
          equip={
            <SlotPanel title="攝影機">
              <CameraList siteId={site.id} />
            </SlotPanel>
          }
          method={
            <SlotPanel title="邏輯拓樸" subtitle="SMO → RIC → gNB">
              {isLoading ? (
                <div className="text-white/40 text-sm">載入中…</div>
              ) : (
                <TopologyCanvas stations={stations} links={links} />
              )}
            </SlotPanel>
          }
        />
      )}

      <Card className={isWall ? "site-info-card" : undefined}>
        <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-lg font-semibold truncate">{site.name}</span>
            <Badge tone={site.environment === "outdoor" ? "blue" : "gray"}>
              {ENV_LABEL[site.environment] ?? site.environment}
            </Badge>
            {site.address && (
              <span className="text-sm text-white/60 truncate">{site.address}</span>
            )}
            <Badge tone={site.floor_plan_url ? "green" : "gray"}>
              {site.floor_plan_url ? "已設平面圖" : "網格底"}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" /> 場域設定
              </Button>
            )}
            {/* 電視牆模式:檢視/編輯切換併入這列,省下原本 PageHeader 的垂直空間 */}
            {isWall && <EditModeToggle />}
          </div>
        </CardContent>
      </Card>
      <SiteSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        site={site}
      />

      {/* 電視牆模式:地圖 + 攝影機播放器並排;一般模式只有地圖一張卡 */}
      <div className={isWall ? "site-wall-main-row" : undefined}>
        <Card className={isWall ? "site-map-card" : undefined}>
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between">
              <CardTitle>實體地圖</CardTitle>
              <p className="text-xs text-white/60">
                gNB {gnbStations.length} · 點攝影機圖示播放
              </p>
            </div>
          </CardHeader>
          <CardContent className={isWall ? "site-map-card-body p-0" : undefined}>
            <SiteLayoutCanvas
              siteId={site.id}
              floorPlanUrl={site.floor_plan_url || undefined}
              stations={stations}
              onCameraSelect={isWall ? setSelectedCamera : undefined}
              selectedCameraId={isWall ? (selectedCamera?.id ?? null) : null}
            />
          </CardContent>
        </Card>

        {isWall && (
          <Card className="site-camera-card">
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle>
                  攝影機即時影像
                  {selectedCamera && (
                    <span className="ml-3 text-base text-white/70 font-normal">
                      {selectedCamera.name}
                    </span>
                  )}
                </CardTitle>
                {selectedCamera && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCamera(null)}
                  >
                    <X className="w-4 h-4 mr-1" /> 取消選取
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="site-camera-card-body p-0">
              {selectedCamera?.hls_url ? (
                <HlsPlayer src={selectedCamera.hls_url} />
              ) : (
                <div className="site-camera-placeholder">
                  <Video className="w-24 h-24 text-white/30" strokeWidth={1.25} />
                  <p className="site-camera-placeholder-title">尚未選擇攝影機</p>
                  <p className="site-camera-placeholder-hint">
                    點地圖上任一攝影機圖示開始播放即時串流
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 一般模式才顯示這些(電視牆下都到右副牆 slot 了) */}
      {!isWall && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CollapsibleCard
              title="邏輯拓樸"
              subtitle="SMO → RIC → gNB"
            >
              {isLoading ? (
                <div className="text-white/40 text-sm">載入中…</div>
              ) : (
                <TopologyCanvas stations={stations} links={links} />
              )}
            </CollapsibleCard>

            <div className="min-w-0 space-y-4">
              <CollapsibleCard
                title="網元"
                subtitle={`${stations.length} 個`}
              >
                <StationList siteId={site.id} stations={stations} />
              </CollapsibleCard>

              <CollapsibleCard title="攝影機">
                <CameraList siteId={site.id} />
              </CollapsibleCard>
            </div>
          </div>

          <CollapsibleCard
            title="拓樸連線"
            subtitle={`${links.length} 條`}
            defaultOpen={false}
          >
            <TopologyLinkEditor
              siteId={site.id}
              stations={stations}
              links={links}
            />
          </CollapsibleCard>
        </>
      )}
    </div>
  );
}

// 右副牆 slot 內部的小排版:標題列 + 內容捲動區
function SlotPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{title}</span>
        {subtitle && <span className="text-base text-white/60">{subtitle}</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
