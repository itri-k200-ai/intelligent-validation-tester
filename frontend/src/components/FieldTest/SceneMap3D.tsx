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
/** 取景往畫面左邊偏移多少(以取景半徑為單位)。調大 = 看得更左邊、無人機更靠右。 */
const PAN_LEFT = 0.9;

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

const BASE_STATIONS: { x: number; y: number; alt: number; label: string }[] = [
  { x: -105, y: 80, alt: 24, label: "基站 A" },
  { x: -147, y: 49, alt: 24, label: "基站 B" },
];

export function SceneMap3D({
  scene,
  tracks,
  uav,
}: {
  scene: FieldScene;
  tracks: SceneTrack[];
  /** 無人機目前位置;altM 是相對起飛點的高度(上游 alt_rel) */
  uav: (XY & { altM?: number | null }) | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer;
    world: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dynamic: THREE.Group;
    uavTexture: THREE.Texture;
    render: () => void;
  } | null>(null);

  // ── 靜態:renderer、光線、地面、草坪、道路、建築(場景變了才重建)──
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // 牆面的版面 px 已經是實體像素的 3 倍,不必再乘裝置像素比
    renderer.setPixelRatio(1);
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
    }
    ctx.current = { renderer, world, camera, dynamic, uavTexture, render };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      ro.disconnect();
      ctx.current = null;
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
  }, [scene]);

  // ── 動態:軌跡、無人機、視角(資料每次更新都重畫)──
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    // 先釋放上一輪的幾何與材質再清掉 —— 即時資料每秒都會進來,只 clear() 的話
    // GPU 記憶體會一直漲(牆是整天開著的)。共用的 UAV 貼圖不在這裡釋放。
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

    if (uav) {
      // 高度拿不到時放 30 m(常見的測試高度),至少離地 5 m 才看得出是在空中
      const alt = Math.max(5, uav.altM ?? 30);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: c.uavTexture, depthTest: false }));
      sprite.scale.set(22, 22, 1);
      sprite.position.set(uav.x, alt, -uav.y);
      sprite.renderOrder = 10;
      c.dynamic.add(sprite);
      // 往地面的垂直柱 + 地面上的投影圈:看得出它在哪一點的上空
      // (WebGL 的線寬固定 1px,牆上看不見,所以用一根細圓柱)
      const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, alt, 8),
        new THREE.MeshBasicMaterial({ color: 0x80ffe8, transparent: true, opacity: 0.7 }),
      );
      drop.position.set(uav.x, alt / 2, -uav.y);
      c.dynamic.add(drop);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3, 4.6, 40),
        new THREE.MeshBasicMaterial({ color: 0x80ffe8, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(uav.x, 1.4, -uav.y);
      c.dynamic.add(ring);
    }

    // 視角:框住軌跡 + 無人機;都沒有就框住「大草坪」—— 場景原點(center_lonlat)就在
    // 草坪上,找包含原點的那塊綠地。不能框全部綠地:它們散在整個園區,鏡頭會退到草坪只剩一小塊
    const focus: XY[] = [...tracks.flatMap((t) => t.points), ...(uav ? [uav] : [])];
    const lawn = scene.greens.find((g) => contains(g, 0, 0));
    const pts = focus.length
      ? focus
      : lawn
        ? lawn.map(([x, y]) => ({ x, y }))
        : [{ x: -60, y: -60 }, { x: 60, y: 60 }];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const radius = Math.max(70, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.6);
    const fit = radius / Math.tan(((c.camera.fov / 2) * Math.PI) / 180);
    const dist = fit / Math.min(1, c.camera.aspect) * 1.05;
    // 從西南方、仰角約 40° 看過去
    const dir = new THREE.Vector3(-0.45, 0.72, 0.52).normalize();
    // 取景整個往畫面左邊帶 —— 右邊那棟建築不需要看,要看的是左邊那棟。
    // 無人機因此不會固定在正中央(室內的 AMR 地圖本來也不是置中的)。
    // 畫面右方在世界座標的方向 = 視線方向 × 上方向;視線是 -dir,算出來是 (dz, 0, -dx)。
    // 位移量以取景半徑為單位,所以軌跡範圍變大時位移會等比例跟著變,構圖不會跑掉。
    const screenRight = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    const target = new THREE.Vector3(cx, 0, -cy).addScaledVector(screenRight, -PAN_LEFT * radius);
    c.camera.position.copy(target).addScaledVector(dir, dist);
    c.camera.lookAt(target);
    c.render();
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
