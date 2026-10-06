"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// 小助理的語音輸入 / 輸出,都用瀏覽器內建的 Web Speech API,不經我們的後端。
//
// ⚠ 語音輸入(SpeechRecognition)只能在「安全來源」用 —— HTTPS 或 localhost。
//   牆面與 /field 現在是 http://<IP>:38080,在一般電腦 / 手機上麥克風會被瀏覽器直接擋掉,
//   所以這裡先檢查 isSecureContext,不行就把按鈕停用並說明原因,而不是按了沒反應。
// ⚠ Chrome 的語音辨識是把聲音送到 Google 的服務辨識,用戶端要能上外網。
//   之後若要在內網辨識,改成錄音(MediaRecorder)送後端即可,介面不變。
//
// 語音輸出(speechSynthesis)沒有這些限制,HTTP 也能用。

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "麥克風權限被拒絕,請在瀏覽器的網址列旁允許使用麥克風",
  "service-not-allowed": "這個瀏覽器不允許語音辨識(需要 HTTPS 連線)",
  "no-speech": "沒有聽到聲音,請再說一次",
  "audio-capture": "找不到麥克風",
  network: "語音辨識需要連上網路",
};

/**
 * 語音輸入:按一下開始聽,說完自動結束,把辨識結果交給 onFinal。
 * 聽的過程中 interim 是目前聽到的字(畫面可以先顯示在輸入框裡)。
 */
export function useSpeechInput({ lang = "zh-TW", onFinal }: { lang?: string; onFinal: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  // 要等掛上之後才知道(SSR 時沒有 window)
  const [unavailable, setUnavailable] = useState<string | null>("");
  const rec = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (!recognitionCtor()) setUnavailable("這個瀏覽器不支援語音輸入,請改用 Chrome、Edge 或 Safari");
    else if (!window.isSecureContext) setUnavailable("語音輸入需要 HTTPS 連線,目前的網址是 HTTP");
    else setUnavailable(null);
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || unavailable) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim(finalText + live);
    };
    r.onerror = (e) => {
      // aborted 是我們自己取消的,不算錯
      if (e.error !== "aborted") setError(ERROR_TEXT[e.error] ?? `語音辨識失敗(${e.error})`);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
      const text = finalText.trim();
      if (text) onFinalRef.current(text);
    };
    setError(null);
    setInterim("");
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("語音辨識啟動失敗,請再試一次");
    }
  }, [lang, unavailable]);

  // 卸載(關掉對話框)時一定要停,不然麥克風會一直開著
  useEffect(() => () => rec.current?.abort(), []);

  return {
    /** null = 可以用;字串 = 不能用的原因;"" = 還在判斷 */
    unavailable,
    listening,
    interim,
    error,
    start,
    stop,
  };
}

/** 朗讀前把畫面上的符號換成念得出來的字(agent 的回覆是 Markdown,先拆掉格式) */
export function speakable(text: string) {
  return stripMarkdown(text)
    .replace(/→/g, "到")
    .replace(/▲\+?/g, "提升")
    .replace(/▼/g, "下降")
    .replace(/・/g, "")
    .replace(/—/g, "沒有資料")
    .replace(/\n+/g, "。");
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const norm = (l: string) => l.toLowerCase().replace("_", "-");
  const want = norm(lang);
  return (
    voices.find((v) => norm(v.lang) === want) ??
    voices.find((v) => norm(v.lang).startsWith("zh-hant")) ??
    voices.find((v) => norm(v.lang) === "zh-hk") ??
    voices.find((v) => norm(v.lang).startsWith("zh")) ??
    null
  );
}

/** 語音輸出:speak(id, text) 朗讀,speakingId 是正在念的那一則(畫面用來切換「停止」) */
export function useSpeechOutput({ lang = "zh-TW" }: { lang?: string } = {}) {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const unlocked = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    const synth = window.speechSynthesis;
    // 聲音清單是非同步載入的,第一次拿常常是空的
    const load = () => (voice.current = pickVoice(synth.getVoices(), lang));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [lang]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback(
    (id: number, text: string) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.lang = lang;
      if (voice.current) u.voice = voice.current;
      u.rate = 1.05;
      u.onstart = () => setSpeakingId(id);
      u.onend = u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      synth.speak(u);
    },
    [lang, supported],
  );

  /**
   * iPhone 的 Safari 只在「使用者操作的當下」才允許開始朗讀;回覆是稍後才到的,
   * 那時再 speak 會被默默擋掉。所以在按送出 / 麥克風的當下先念一段空字串解鎖。
   */
  const unlock = useCallback(() => {
    if (!supported || unlocked.current) return;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    unlocked.current = true;
  }, [supported]);

  return { supported, speakingId, speak, stop, unlock };
}

/**
 * Markdown → 念得出來的純文字。表格與圖念不出意義,改成一句提示;
 * 其餘(標題、清單、粗體、連結、行內程式碼)只拿掉符號、保留文字。
 */
function stripMarkdown(md: string) {
  return md
    .replace(/```mermaid[\s\S]*?```/g, "。詳見畫面上的圖。")
    .replace(/```[\s\S]*?```/g, "。詳見畫面上的內容。")
    .replace(/(^\|.*\|[ \t]*$\n?)+/gm, "。詳見畫面上的表格。\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(?=\S)([^*_~\n]+?)\1/g, "$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s*-{3,}\s*$/gm, "");
}
