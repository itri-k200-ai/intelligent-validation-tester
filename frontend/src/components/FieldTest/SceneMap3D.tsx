"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { FieldScene } from "@/hooks/FieldTest/useFieldTestScene";

/** 平面公尺座標(x 向東、y 向北),跟 FieldScene 同一個原點 */
type XY = { x: number; y: number };

export type SceneTrack = { key: string; color: string; points: XY[] };

/**
 * 室外路線圖(3D):平台場景的建築依實際高度立起來,草坪、道路貼地,
 * 兩趟軌跡畫在地面上,無人機放在實際高度並往地面拉一條垂直線。
 *
 * 座標換算:場景的 (x 東, y 北, 高) → three.js 的 (X, Y 上, Z) = (x, 高, -y)。
 * 視角固定從西南斜上方俯瞰(同版面規劃圖),自動框住「軌跡 + 無人機」;
 * 還沒有位置資料時框住場景的綠地(草坪)。
 *
 * 只在資料變動時重畫一次(牆上沒有人在轉視角,不需要每一幀都畫)。
 */
/**
 * 取景往原本畫面左邊偏移多少(以取景半徑為單位)。調大 = 看得更左邊、無人機更靠右。
 * 現在取景已經把基站算進去,不需要再偏移去看基站那棟,所以是 0。
 */
const PAN_LEFT = 0;
/** 取景四周留白:畫面寬 / 高的這個比例不放東西,基站與無人機不會貼在邊上。調小 = 拉得更近 */
const FRAME_MARGIN = 0.12;
/** 取景半徑下限(公尺):只有一個點時不要拉到太近 */
const MIN_RADIUS_M = 45;
/** 相機繞垂直軸轉多少(弧度)。負的 = 從上面看順時針 = 地圖在畫面上逆時針轉 */
const VIEW_TURN_RAD = -Math.PI / 2;

/**
 * 固定在場景裡的基站位置(52 館屋頂的兩個角)。
 *
 * 座標是場景的公尺座標:x 向東、y 向北,原點 = scene.center(121.0465286, 24.7735643)。
 * alt 是離地高度,52 館的樓高是 24 m,所以圖示就立在屋頂上。
 * 位置是從牆上的截圖反推的 —— 把鏡頭參數重算一遍、把 17 棟建築的屋頂角投影到
 * 畫面上比對,兩個紅圈都落在同一棟(建築 #1,中心 (−126, 96)、94×94 m)的這兩個角。
 *
 * 要調整就改這裡:x 加 = 往東、y 加 = 往北,單位是公尺。
 */
/** 基站圖示的顏色與大小(公尺)。暖色是為了跟青色的建築、綠色的草坪分開。 */
const BS_COLOR = "#FFC56B";
const BS_SIZE = 10;

const BASE_STATIONS: {
  x: number;
  y: number;
  alt: number;
  label: string;
  /** 訊號覆蓋範圍(扇形):朝哪個方位(度,正北 0、順時針)、張角(度)、半徑(公尺)、顏色 */
  coverage: { azimuth: number; width: number; range: number; color: string };
}[] = [
  // 覆蓋範圍依現場提供的示意圖換算(docs/除錯截圖/df804bc3-…png):
  //   A(畫面左邊那顆,青色)朝東南偏東、往草坪那一側張開;B(右邊那顆,黃色)朝南偏東
  //   (依現場回饋調過:150° → 170° → 165°)。
  // 圖上是透視過的畫面,換算時已經把「往畫面深處」的距離還原(仰角約 46°)。要微調就改這裡。
  { x: -105, y: 80, alt: 24, label: "基站 A", coverage: { azimuth: 123, width: 84, range: 170, color: "#22E5F2" } },
  { x: -147, y: 49, alt: 24, label: "基站 B", coverage: { azimuth: 165, width: 80, range: 170, color: "#FFD33D" } },
];
/** 覆蓋範圍裡的虛線同心弧,每隔幾公尺一圈 */
const COVERAGE_RING_M = 34;

export function SceneMap3D({
  scene,
  tracks,
  uav,
  pixelRatio = 1,
}: {
  scene: FieldScene;
  tracks: SceneTrack[];
  /** 無人機目前位置;altM 是相對起飛點的高度(上游 alt_rel) */
  uav: (XY & { altM?: number | null }) | null;
  /**
   * 畫布的像素比。牆面維持 1(版面 px 已經是實體像素的 3 倍);
   * 一般 / 手機版傳 devicePixelRatio,不然在高解析螢幕上會糊。
   */
  pixelRatio?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer;
    world: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dynamic: THREE.Group;
    uav: UavMarker;
    render: () => void;
  } | null>(null);
  // 畫面上「現在」的無人機位置與取景;新資料進來時從這裡滑到新的目標(見下面的動態段)
  const shown = useRef<View | null>(null);
  const lastAt = useRef<number | null>(null);
  /** 目前要入鏡的點(見 fitRadius)—— 換了尺寸要照新的長寬比重算取景 */
  const framePts = useRef<THREE.Vector3[] | null>(null);

  // ── 靜態:renderer、光線、地面、草坪、道路、建築(場景變了才重建)──
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // 牆面的版面 px 已經是實體像素的 3 倍,不必再乘裝置像素比(預設 1)
    renderer.setPixelRatio(pixelRatio);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const world = new THREE.Scene();
    world.add(new THREE.HemisphereLight(0xdfefff, 0x1a2635, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-400, 600, 300);
    world.add(sun);

    // 地面鋪到 20 km 見方:斜著看時地面的邊界一定在畫面外(之前只比場景大一點,
    // 透視下會看到一塊深色多邊形的邊)
    // ── 配色(參考他館的 3D 地圖)────────────────────────────────────────
    // 城市一律中性灰、不上色,薄荷綠只留給「測試區」與軌跡 —— 建築原本是飽和的
    // 青色(0x35b8ad),跟軌跡、基站、無人機同一個色系,整張圖糊成一片分不出主次。
    // 底仍保持暗色(牆面是暗底的戰情室),但從帶藍的 navy 換成中性灰,灰色建築才站得住。
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20_000, 20_000),
      new THREE.MeshLambertMaterial({ color: 0x2a2f36 }),
    );
    ground.rotation.x = -Math.PI / 2;
    world.add(ground);

    // 綠地 = 測試區:半透明薄荷 + 亮青邊框,一眼看得出驗測發生在哪一塊
    for (const g of scene.greens) {
      const shape = flatShape(g);
      const mesh = new THREE.Mesh(
        shape,
        new THREE.MeshBasicMaterial({
          color: 0x7fe3dd,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.y = 0.3;
      world.add(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(shape),
        new THREE.LineBasicMaterial({ color: 0x3fd0c9, transparent: true, opacity: 0.85 }),
      );
      edge.position.y = 0.35;
      world.add(edge);
    }
    for (const r of scene.roads) {
      // 帶狀面的法線方向不一定朝上,用不受光的材質,顏色才不會忽明忽暗
      const mesh = new THREE.Mesh(ribbon(r.map(([x, y]) => ({ x, y })), 7), new THREE.MeshBasicMaterial({ color: 0x9aa5b1 }));
      mesh.position.y = 0.5;
      world.add(mesh);
    }
    const buildingMat = new THREE.MeshLambertMaterial({ color: 0x8e9aa8 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.5 });
    for (const bd of scene.buildings) {
      const geo = extruded(bd.footprint, bd.height ?? 15);
      world.add(new THREE.Mesh(geo, buildingMat));
      world.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    }

    const dynamic = new THREE.Group();
    world.add(dynamic);
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 30_000);
    const render = () => renderer.render(world, camera);
    // UAV 圖示:沿用右牆「測試設備」的無人機圖(neon 線稿,透明背景)
    const uavTexture = new THREE.TextureLoader().load("/images/dut/uav.png", render);
    uavTexture.colorSpace = THREE.SRGBColorSpace;
    const uav = uavMarker(uavTexture);
    world.add(uav.group);

    // 基站:位置固定,所以放在靜態的 world 裡(dynamic 每次更新會被清空)。
    //
    // 圖示沿用右牆「測試設備」的基站圖,但要重新上色 —— 原圖是青色線稿
    // (主色 rgb(96,224,224)),跟建築同一個色系,擺在屋頂上分不出來。
    // 單純給 SpriteMaterial.color 是相乘,青色乘暖色只會變濁,所以在 canvas 上用
    // source-in 把整個圖形換成 BS_COLOR,只保留原本的輪廓與鏤空。
    const bsSprite = new THREE.TextureLoader().load("/images/dut/base-station.png", (tex) => {
      const img = tex.image as HTMLImageElement;
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const g = cv.getContext("2d");
      if (g) {
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = "source-in";
        g.fillStyle = BS_COLOR;
        g.fillRect(0, 0, cv.width, cv.height);
        tex.image = cv;
        tex.needsUpdate = true;
      }
      render();
    });
    bsSprite.colorSpace = THREE.SRGBColorSpace;
    for (const bs of BASE_STATIONS) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: bsSprite, depthTest: false }),
      );
      sprite.scale.set(BS_SIZE, BS_SIZE, 1);
      // 圖示底部對齊屋頂:sprite 是以中心定位的,所以往上抬半個高度
      sprite.position.set(bs.x, bs.alt + BS_SIZE / 2, -bs.y);
      sprite.renderOrder = 9;
      world.add(sprite);
      // 不畫屋頂的底座圓環(依前端回饋)—— 圖示縮小之後,環反而比圖示還搶眼
      world.add(coverageSector(bs));
    }
    ctx.current = { renderer, world, camera, dynamic, uav, render };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // 取景距離跟長寬比有關,換了尺寸要照新的長寬比重算、重放一次鏡頭
      if (shown.current) {
        const v = shown.current;
        if (framePts.current)
          shown.current = { ...v, radius: Math.max(MIN_RADIUS_M, fitRadius(camera, v.cx, v.cy, framePts.current)) };
        placeCamera(camera, shown.current);
      }
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      ro.disconnect();
      ctx.current = null;
      shown.current = null;
      world.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      uavTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [scene, pixelRatio]);

  // ── 動態 1:軌跡(筆數變了才重建)──
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    // 先釋放上一輪的幾何與材質再清掉 —— 回放時軌跡一直在長,只 clear() 的話
    // GPU 記憶體會一直漲(牆是整天開著的)
    c.dynamic.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    c.dynamic.clear();

    tracks.forEach((t, i) => {
      if (t.points.length < 2) return;
      const mesh = new THREE.Mesh(ribbon(t.points, 2), new THREE.MeshBasicMaterial({ color: t.color }));
      // 兩趟走同一條路,放在同一個高度會互相閃爍 —— 後面那趟墊高一點,重疊處以它為準
      mesh.position.y = 1.2 + i * 0.6;
      mesh.renderOrder = i + 1;
      c.dynamic.add(mesh);
    });
    c.render();
  }, [scene, tracks]);

  // ── 動態 2:無人機與視角 ──
  // 位置是輪詢來的(約每 1~2 秒一筆),直接套上去無人機會一格一格跳、鏡頭也跟著抖。
  // 這裡從「畫面上現在的樣子」花「上一筆到這一筆的時間」滑到新的位置與取景,
  // 下一筆進來時剛好接上(做法同 RouteMap 的 LiveMarker)。
  // 一次跳很遠(切換歷史紀錄)或第一次出現就直接到位,不要看它飛越整個園區。
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    // 位置暫時拿不到(/live 一次逾時、回放某幾筆沒有經緯度)時不要馬上把無人機藏起來 ——
    // 會「突然不見」。停在最後的位置,連續 UAV_HOLD_MS 都沒有位置才藏
    // (從來沒出現過的話照常往下,用軌跡 / 草坪取景)
    if (!uav && c.uav.group.visible) {
      const hide = window.setTimeout(() => {
        c.uav.group.visible = false;
        c.render();
      }, UAV_HOLD_MS);
      return () => window.clearTimeout(hide);
    }
    c.uav.group.visible = !!uav;

    // 視角:只以「兩個基站 + 無人機」三者為主(依現場要求:旁邊的建築不用露出來,資訊太干擾)。
    // 軌跡不算進取景 —— 整條飛行軌跡會把畫面撐大,兩側就多出一大片建築。
    // 沒有無人機位置時改用軌跡最後一點;連軌跡都沒有就框基站 + 「大草坪」(場景原點就在草坪上,
    // 找包含原點的那塊綠地。不能框全部綠地:它們散在整個園區,鏡頭會退到很遠)
    const lastTrack = tracks.at(-1)?.points.at(-1) ?? null;
    const focusUav = uav ?? (lastTrack ? { ...lastTrack, altM: null } : null);
    const lawn = scene.greens.find((g) => contains(g, 0, 0));
    // 要入鏡的點(含高度:基站在屋頂上、無人機在空中,只看地面位置會把它們切到畫面外)
    const frame3d = [
      // 基站:圖示四周也留一點,不要貼在畫面邊上
      ...BASE_STATIONS.flatMap((b) => [
        new THREE.Vector3(b.x, b.alt + BS_SIZE * 1.5, -b.y),
        new THREE.Vector3(b.x + BS_SIZE, b.alt, -b.y),
        new THREE.Vector3(b.x - BS_SIZE, b.alt, -b.y),
        new THREE.Vector3(b.x, b.alt, -b.y + BS_SIZE * 1.5),
        new THREE.Vector3(b.x, b.alt, -b.y - BS_SIZE * 1.5),
      ]),
      // 無人機:不只中心點,整個圖示四周再多留一點都要入鏡,不會貼在畫面邊上
      ...(focusUav
        ? uavRoom(focusUav.x, focusUav.y, Math.max(5, focusUav.altM ?? 30))
        : (lawn ?? [[-60, -60], [60, 60]]).map(([x, y]) => new THREE.Vector3(x, 0, -y))),
    ];
    // 置中:把每個點沿著視線投到地面上再取中點 —— 在空中的無人機,畫面上看起來比它的地面位置
    // 高很多,只用地面座標置中,畫面會整個偏一邊
    const dir = viewDir();
    const onGround = frame3d.map((p) => p.clone().addScaledVector(dir, -p.y / dir.y));
    const gx = onGround.map((p) => p.x);
    const gy = onGround.map((p) => -p.z);
    const cx = (Math.min(...gx) + Math.max(...gx)) / 2;
    const cy = (Math.min(...gy) + Math.max(...gy)) / 2;
    const prev = shown.current;
    framePts.current = frame3d;
    const to: View = {
      cx,
      cy,
      // 照相機實際的視角算:剛好讓這些點都落在畫面內、四周留 FRAME_MARGIN
      radius: Math.max(MIN_RADIUS_M, fitRadius(c.camera, cx, cy, frame3d)),
      ux: uav?.x ?? prev?.ux ?? 0,
      uy: uav?.y ?? prev?.uy ?? 0,
      // 高度拿不到時放 30 m(常見的測試高度),至少離地 5 m 才看得出是在空中
      alt: uav ? Math.max(5, uav.altM ?? 30) : (prev?.alt ?? 30),
    };

    const now = performance.now();
    const gap = lastAt.current == null ? 0 : now - lastAt.current;
    lastAt.current = now;
    const far = !prev || Math.hypot(to.ux - prev.ux, to.uy - prev.uy) > to.radius;
    const duration = far || !gap ? 0 : Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, gap));

    const paint = (v: View) => {
      shown.current = v;
      placeUav(c.uav, v);
      placeCamera(c.camera, v);
      c.render();
    };
    if (!duration || !prev) {
      paint(to);
      return;
    }
    const from = prev;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - now) / duration);
      const mix = (key: keyof View) => from[key] + (to[key] - from[key]) * k;
      paint({ cx: mix("cx"), cy: mix("cy"), radius: mix("radius"), ux: mix("ux"), uy: mix("uy"), alt: mix("alt") });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scene, tracks, uav]);

  return (
    <div
      ref={hostRef}
      className="relative min-h-0 flex-1 overflow-hidden rounded-2xl"
      aria-label="測試路徑 3D 地圖"
      role="img"
    />
  );
}

/** 一次滑行最短 / 最長多久(毫秒),見「動態 2」 */
const GLIDE_MIN_MS = 150;
const GLIDE_MAX_MS = 3000;
/** 位置拿不到時,無人機停在原地多久才藏起來 */
const UAV_HOLD_MS = 15_000;

/** 畫面上的無人機位置(ux, uy, 高度 alt)與取景(中心 cx, cy、半徑 radius),都是公尺 */
type View = { cx: number; cy: number; radius: number; ux: number; uy: number; alt: number };

type UavMarker = { group: THREE.Group; sprite: THREE.Sprite; drop: THREE.Mesh };

/**
 * 無人機標記:圖示 + 往地面的垂直柱 + 地面上的投影圈(看得出它在哪一點的上空)。
 * 只建一次,之後只改位置 —— 每秒重建一份的話,滑行時每一格都要重新配 GPU 記憶體。
 */
function uavMarker(texture: THREE.Texture): UavMarker {
  const group = new THREE.Group();
  group.visible = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(22, 22, 1);
  sprite.renderOrder = 10;
  // WebGL 的線寬固定 1px,牆上看不見,所以用一根細圓柱;高度 1,依飛行高度縮放
  const drop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0x80ffe8, transparent: true, opacity: 0.7 }),
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3, 4.6, 40),
    new THREE.MeshBasicMaterial({ color: 0x80ffe8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.4;
  group.add(sprite, drop, ring);
  return { group, sprite, drop };
}

function placeUav(m: UavMarker, v: View) {
  m.group.position.set(v.ux, 0, -v.uy);
  m.sprite.position.y = v.alt;
  m.drop.scale.y = v.alt;
  m.drop.position.y = v.alt / 2;
}

/** 從西南方、仰角約 40° 看過去,框住以 (cx, cy) 為中心、半徑 radius 的範圍 */
/** 無人機圖示四周要保留的空間(公尺,從圖示中心算;圖示本身約 22 m 見方)。調大 = 無人機離畫面邊緣更遠 */
const UAV_ROOM_M = 14;

/** 無人機圖示周圍要入鏡的幾個點:上下左右前後各 UAV_ROOM_M */
function uavRoom(x: number, y: number, alt: number): THREE.Vector3[] {
  const r = UAV_ROOM_M;
  return [
    new THREE.Vector3(x, alt + r, -y),
    new THREE.Vector3(x, Math.max(0, alt - r), -y),
    new THREE.Vector3(x + r, alt, -y),
    new THREE.Vector3(x - r, alt, -y),
    new THREE.Vector3(x, alt, -y + r),
    new THREE.Vector3(x, alt, -y - r),
  ];
}

/** 相機的視線方向(從目標指向相機)。fitRadius 與 placeCamera 共用,兩邊才算得一致 */
function viewDir() {
  return new THREE.Vector3(-0.45, 0.72, 0.52).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), VIEW_TURN_RAD);
}

/**
 * 讓 pts 剛好都入鏡(四周留 FRAME_MARGIN)需要的取景半徑 —— 照 placeCamera 的反算。
 * 每個點投影到相機的右 / 上方向,算出「離目標多遠時它剛好落在畫面邊緣」,取最遠的那個。
 */
function fitRadius(camera: THREE.PerspectiveCamera, cx: number, cy: number, pts: THREE.Vector3[]) {
  const dir = viewDir();
  const forward = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tanV = Math.tan(((camera.fov / 2) * Math.PI) / 180) * (1 - FRAME_MARGIN);
  const tanH = tanV * Math.max(camera.aspect, 0.1);
  const target = new THREE.Vector3(cx, 0, -cy);
  let dist = 1;
  for (const p of pts) {
    const d = p.clone().sub(target);
    const depth = d.dot(forward);
    dist = Math.max(dist, Math.abs(d.dot(right)) / tanH - depth, Math.abs(d.dot(up)) / tanV - depth);
  }
  // placeCamera:dist = radius / tan(fov/2) / min(1, aspect) × 1.05 → 反過來
  return ((dist * Math.tan(((camera.fov / 2) * Math.PI) / 180)) * Math.min(1, camera.aspect)) / 1.05;
}

function placeCamera(camera: THREE.PerspectiveCamera, v: View) {
  const fit = v.radius / Math.tan(((camera.fov / 2) * Math.PI) / 180);
  const dist = (fit / Math.min(1, camera.aspect)) * 1.05;
  // 原本的視角方向。取景中心(下面的 PAN_LEFT)以它為準算,轉向時看的還是同一塊地方
  const base = new THREE.Vector3(-0.45, 0.72, 0.52).normalize();
  // 取景整個往原本畫面的左邊帶 —— 右邊那棟建築不需要看,要看的是左邊那棟。
  // 無人機因此不會固定在正中央(室內的 AMR 地圖本來也不是置中的)。
  // 畫面右方在世界座標的方向 = 視線方向 × 上方向;視線是 -base,算出來是 (bz, 0, -bx)。
  // 位移量以取景半徑為單位,所以軌跡範圍變大時位移會等比例跟著變,構圖不會跑掉。
  const screenRight = new THREE.Vector3(base.z, 0, -base.x).normalize();
  const target = new THREE.Vector3(v.cx, 0, -v.cy).addScaledVector(screenRight, -PAN_LEFT * v.radius);
  // 相機繞垂直軸轉 VIEW_TURN_RAD(依現場要求:整張地圖在畫面上逆時針轉 90°。
  // 相機順時針繞過去,看起來就是地圖逆時針轉)
  const dir = viewDir();
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
}

/**
 * 一個基站的訊號覆蓋範圍:屋頂高度上的一片扇形(依現場示意圖)——
 *   填色:靠近基站最亮、往外漸淡(頂點透明度,扇心 0.5 → 外緣 0.08)
 *   外框:兩條邊 + 外緣弧線,實線
 *   內部:每隔 COVERAGE_RING_M 一圈虛線同心弧
 * 半透明、不寫深度、蓋在建築上面(示意圖裡建築被罩進範圍時也是染上一層色),
 * 但畫在軌跡、無人機、基站圖示之前(renderOrder 比它們小),不會擋住它們。
 */
function coverageSector(bs: (typeof BASE_STATIONS)[number]): THREE.Group {
  const { azimuth, width, range, color } = bs.coverage;
  const group = new THREE.Group();
  const col = new THREE.Color(color);
  const y = bs.alt;
  // 方位角(正北 0、順時針)→ 場景座標(x 東、z = -北)
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return new THREE.Vector3(bs.x + Math.sin(a) * r, y, -(bs.y + Math.cos(a) * r));
  };
  const from = azimuth - width / 2;
  const to = azimuth + width / 2;
  const SEG = 48;
  const arc = (r: number) => Array.from({ length: SEG + 1 }, (_, i) => at(from + ((to - from) * i) / SEG, r));

  // 填色:扇心一點 + 外緣一圈,三角形扇,頂點帶 RGBA
  const outer = arc(range);
  const pos: number[] = [];
  const rgba: number[] = [];
  const apex = at(0, 0);
  for (let i = 0; i < SEG; i++) {
    for (const [v, a] of [
      [apex, 0.62],
      [outer[i], 0.06],
      [outer[i + 1], 0.06],
    ] as const) {
      pos.push(v.x, v.y, v.z);
      rgba.push(col.r, col.g, col.b, a);
    }
  }
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  fillGeo.setAttribute("color", new THREE.Float32BufferAttribute(rgba, 4));
  const fill = new THREE.Mesh(
    fillGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  fill.renderOrder = 0;
  group.add(fill);

  // 外框:邊 → 外緣弧 → 邊
  const edge = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([apex, ...outer, apex]),
    new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthTest: false }),
  );
  edge.renderOrder = 0;
  group.add(edge);

  // 虛線同心弧
  for (let r = COVERAGE_RING_M; r < range - 1; r += COVERAGE_RING_M) {
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(arc(r)),
      new THREE.LineDashedMaterial({
        color: col,
        dashSize: 4,
        gapSize: 3,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    ring.computeLineDistances();
    ring.renderOrder = 0;
    group.add(ring);
  }
  // 基站位置的光暈(示意圖裡扇心那團亮光):canvas 畫一個放射漸層當貼圖
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.9)`);
    grad.addColorStop(0.35, `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.35)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.set(38, 38, 1);
  glow.position.copy(apex);
  glow.renderOrder = 0;
  group.add(glow);
  return group;
}

/** 點 (x, y) 在不在多邊形裡(射線法) */
function contains(poly: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 平面多邊形(公尺座標)→ 貼地的 mesh 幾何 */
function flatShape(path: [number, number][]) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(path.map(([x, y]) => new THREE.Vector2(x, y))));
  // XY 平面 → 地面:(x, y, 0) 轉成 (x, 0, -y)
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** 建築輪廓依高度立起來:(x, y) 往上擠出 height 公尺 */
function extruded(path: [number, number][], height: number) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(path.map(([x, y]) => new THREE.Vector2(x, y))), {
    depth: height,
    bevelEnabled: false,
  });
  // 擠出方向 +z → 往上:(x, y, z) 轉成 (x, z, -y)
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** 折線 → 貼地的帶狀面(寬 width 公尺),道路與軌跡用;WebGL 的線寬固定 1px,牆上會看不見 */
function ribbon(points: XY[], width: number) {
  const half = width / 2;
  const pos: number[] = [];
  const idx: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    pos.push(p.x + nx, 0, -(p.y + ny), p.x - nx, 0, -(p.y - ny));
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
