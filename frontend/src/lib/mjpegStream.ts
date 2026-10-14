/**
 * 自己讀 MJPEG(multipart/x-mixed-replace)串流,一張張交出 JPEG。
 *
 * 為什麼不直接 <img src=串流>:Chrome 的 <img> 吃 multipart 時,只有第一張會觸發
 * onLoad,之後串流結束、卡住不動、甚至一張都沒來就斷 —— **完全沒有任何事件**
 * (本機假串流實測)。上游平台斷線很常見(日誌裡一堆 502 / 503,載具離線時後端
 * 20 秒沒資料就收掉),結果那一格就停在最後一張或一直轉圈,永遠不會重連。
 * 自己讀才知道「多久沒來新的一張」,才能判斷要不要重連。
 */

/** 一張 JPEG(底下固定是一般的 ArrayBuffer,new Blob 才收) */
export type Frame = Uint8Array<ArrayBuffer>;

const SOI0 = 0xff;
const SOI1 = 0xd8;
const EOI1 = 0xd9;
const DEC = new TextDecoder("latin1");
/** 找不到下一張的開頭時,緩衝最多留這麼多(只會是 part 的表頭) */
const MAX_HEAD = 64 * 1024;

function indexOfPair(buf: Uint8Array, a: number, b: number, from: number, to = buf.length) {
  for (let i = from; i < to - 1; i++) if (buf[i] === a && buf[i + 1] === b) return i;
  return -1;
}

/**
 * 把一段段收到的位元組拆成一張張 JPEG(跟後端 apps/field_tests/jpeg.py 的 frames 同一套):
 * 優先照 part 表頭的 Content-Length 切,沒帶就找 JPEG 的結尾標記。
 */
export function mjpegSplitter(onFrame: (jpg: Frame) => void) {
  let buf: Frame = new Uint8Array(0);
  return (chunk: Uint8Array) => {
    const next = new Uint8Array(buf.length + chunk.length);
    next.set(buf);
    next.set(chunk, buf.length);
    buf = next;
    for (;;) {
      const soi = indexOfPair(buf, SOI0, SOI1, 0);
      if (soi < 0) {
        if (buf.length > MAX_HEAD) buf = buf.slice(-1);
        return;
      }
      const m = /content-length:\s*(\d+)/i.exec(DEC.decode(buf.subarray(0, soi)));
      let end: number;
      if (m) end = soi + Number(m[1]);
      else {
        const eoi = indexOfPair(buf, SOI0, EOI1, soi + 2);
        end = eoi >= 0 ? eoi + 2 : -1;
      }
      if (end < 0 || buf.length < end) return;
      onFrame(buf.slice(soi, end));
      buf = buf.slice(end);
    }
  };
}

/**
 * 開一條 MJPEG 串流,每來一張就呼叫 onFrame。
 * 串流結束(不管正常或出錯)resolve / reject;要中途停掉就 abort 傳進來的 signal。
 */
export async function readMjpeg(url: string, signal: AbortSignal, onFrame: (jpg: Frame) => void) {
  const resp = await fetch(url, { cache: "no-store", signal });
  if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
  const type = resp.headers.get("content-type") ?? "";
  // 快照端點(或上游只給單張)也接得住:整包當一張
  if (!type.startsWith("multipart/")) {
    onFrame(new Uint8Array(await resp.arrayBuffer()));
    return;
  }
  const split = mjpegSplitter(onFrame);
  const reader = resp.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      split(value);
    }
  } finally {
    reader.releaseLock();
  }
}
