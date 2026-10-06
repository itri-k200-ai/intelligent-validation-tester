"use client";
import { Mic, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { AssistantMarkdown } from "@/components/FieldTest/AssistantMarkdown";
import { useSpeechInput, useSpeechOutput } from "@/hooks/Assistant/useSpeech";
import { cn } from "@/lib/cn";
import { askAssistant, type AssistantAnswer, type AssistantContext } from "@/services/assistant";

export type { AssistantContext };

type Msg = {
  id: number;
  from: "bot" | "user";
  text: string;
  voice?: boolean;
  /** agent 還在回(逐字中) */
  pending?: boolean;
  /** agent 呼叫工具時的提示 */
  status?: string;
  /** agent 連不上,這則是本地關鍵字回覆 */
  local?: boolean;
};

/** 吉祥物(原圖 docs/外部文件/前端UI建議/ChatGPT Image 2026年9月24日 下午03_08_59.png,
    1.3 MB 太大,轉成 avatar 192px 頭部裁切 / mascot 480px 全身) */
const AVATAR = "/images/assistant/avatar.webp";
const MASCOT = "/images/assistant/mascot.webp";

const SUGGESTIONS = ["目前進度", "通訊品質", "啟用前後比較", "電量"];
const GREETING =
  "你好,我是場域測試小助理。可以打字或按麥克風用說的,問我目前的進度、狀態、通訊品質、啟用前後的吞吐量比較、載具電量或位置。";
/** 「一律用語音回覆」的設定存在這台瀏覽器(只是個人偏好,不必同步) */
const VOICE_PREF_KEY = "ivt-assistant-voice-reply";

/**
 * 類似客服機器人的對話框(一般 / 手機版專用,中牆沒有)。
 *
 * - 回覆來自 services/assistant 的 askAssistant:經我們後端轉給網管 agent,逐字串流;連不上退回本地回覆。
 * - 語音輸入:按麥克風說話,說完自動送出(見 hooks/Assistant/useSpeech;需要 HTTPS)。
 * - 語音輸出:用說的問就用說的回;標題列的喇叭打開則每一則都念。每則回覆也能單獨按「朗讀」。
 */
export function FieldAssistant({ ctx }: { ctx: AssistantContext }) {
  const [open, setOpen] = useState(false);
  // 招呼語不放進訊息串,而是跟吉祥物一起放在最上面的歡迎區
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceReply, setVoiceReply] = useState(false);
  // 下方的快捷問題:一開始用預設的,agent 回答後換成它建議的下一個問題
  const [chips, setChips] = useState<string[]>(SUGGESTIONS);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 回覆要用「送出那一刻」的資料,但 ctx 每秒都在變 —— 放 ref 免得非同步回來時抓到舊的
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const tts = useSpeechOutput();
  const stt = useSpeechInput({ onFinal: (text) => send(text, true) });

  useEffect(() => {
    try {
      setVoiceReply(localStorage.getItem(VOICE_PREF_KEY) === "1");
    } catch {
      /* 私密模式等拿不到 localStorage:用預設(關) */
    }
  }, []);
  const toggleVoiceReply = () => {
    const next = !voiceReply;
    setVoiceReply(next);
    if (!next) tts.stop();
    else tts.unlock();
    try {
      localStorage.setItem(VOICE_PREF_KEY, next ? "1" : "0");
    } catch {
      /* 存不了就只在這次有效 */
    }
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open, stt.interim]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (stt.error) setNotice(stt.error);
  }, [stt.error]);

  const close = () => {
    stt.stop();
    tts.stop();
    setOpen(false);
  };

  function send(raw: string, voice = false) {
    const text = raw.trim();
    if (!text || typing) return;
    tts.unlock();
    tts.stop();
    setNotice(null);
    const id = nextId.current + 1;
    nextId.current += 2;
    // 先放一則空的回覆:有逐字內容就填進去,沒有就顯示「正在回覆」的點點
    setMsgs((m) => [
      ...m,
      { id: id - 1, from: "user", text, voice },
      { id, from: "bot", text: "", pending: true },
    ]);
    setDraft("");
    setTyping(true);
    const patch = (p: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ...p } : x)));
    askAssistant(text, ctxRef.current, {
      onDelta: (soFar) => patch({ text: soFar }),
      onStatus: (status) => patch({ status }),
    })
      .catch((): AssistantAnswer => ({ text: "抱歉,我現在沒辦法回答,請稍後再試。", source: "local" }))
      .then((answer) => {
        patch({ text: answer.text, pending: false, status: undefined, local: answer.source === "local" });
        if (answer.suggestions?.length) setChips(answer.suggestions);
        setTyping(false);
        // 用說的問就用說的回;喇叭打開時每一則都念。念最終答案,不念逐字的半成品
        if (voice || voiceReply) tts.speak(id, answer.text);
      });
  }

  const onMic = () => {
    if (stt.listening) return stt.stop();
    if (stt.unavailable) return setNotice(stt.unavailable);
    tts.unlock();
    tts.stop();
    setNotice(null);
    stt.start();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // 中文輸入法選字時按的 Enter 不能當送出
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={open ? "關閉小助理" : "開啟小助理"}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full",
          "mb-[env(safe-area-inset-bottom)] shadow-lg shadow-black/40 ring-2 ring-mint/70 transition-transform hover:scale-105",
          open ? "bg-mint text-dark-text max-sm:hidden" : "bg-[#EAF4FD]",
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={AVATAR} alt="" className="h-full w-full object-cover" />
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="場域測試小助理"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-white/10 bg-navy-500 shadow-2xl shadow-black/60",
            // 手機:從下方升起的半屏面板;桌機:右下角的浮動視窗
            "inset-x-0 bottom-0 h-[78dvh] rounded-t-section",
            "sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[560px] sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-section",
          )}
        >
          <header className="flex flex-none items-center gap-2 border-b border-white/10 px-4 py-3">
            <Avatar size="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">場域測試小助理</div>
              <div className="truncate text-[11px] text-white/45">
                {stt.listening ? "正在聆聽…" : tts.speakingId !== null ? "正在朗讀…" : "由網管 agent 依頁面上的即時資料回答"}
              </div>
            </div>
            {tts.supported && (
              <button
                type="button"
                aria-label={voiceReply ? "關閉語音回覆" : "開啟語音回覆"}
                aria-pressed={voiceReply}
                title={voiceReply ? "語音回覆:開(每一則都會念出來)" : "語音回覆:關(用說的問才會念)"}
                onClick={toggleVoiceReply}
                className={cn(
                  "rounded-full p-1.5 transition-colors hover:bg-white/10",
                  voiceReply ? "text-mint" : "text-white/50 hover:text-white",
                )}
              >
                {voiceReply ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
            )}
            <button
              type="button"
              aria-label="關閉"
              onClick={close}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="flex flex-col items-center gap-2 pb-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MASCOT} alt="場域測試小助理" className="h-28 w-28 rounded-full bg-[#EAF4FD] object-cover" />
              <p className="max-w-[18rem] text-sm leading-relaxed text-white/80">{GREETING}</p>
            </div>
            {msgs.filter((m) => !(m.pending && !m.text)).map((m) => (
              <div
                key={m.id}
                className={cn("flex items-end gap-2", m.from === "user" ? "justify-end" : "justify-start")}
              >
                {m.from === "bot" && <Avatar size="h-7 w-7" />}
                <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1", m.from === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      m.from === "user"
                        ? "whitespace-pre-line rounded-br-md bg-mint text-dark-text"
                        : "min-w-0 max-w-full rounded-bl-md bg-white/10 text-white",
                    )}
                  >
                    {m.voice && <Mic className="mr-1 inline h-3.5 w-3.5 align-[-2px] opacity-60" aria-label="語音輸入" />}
                    {m.from === "bot" && !m.local ? (
                      // agent 的回覆:Markdown(表格、清單)與 Mermaid 圖
                      <AssistantMarkdown text={m.text} pending={m.pending} />
                    ) : (
                      // 本地回覆與使用者自己打的字:純文字(換行照原樣)
                      <span className="whitespace-pre-line">{m.text}</span>
                    )}
                    {m.pending && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-white/60 align-[-2px]" />}
                  </div>
                  {m.pending && m.status && <span className="px-1 text-[11px] text-white/45">{m.status}</span>}
                  {m.local && <span className="px-1 text-[11px] text-white/40">網管 agent 暫時連不上,這是頁面資料的簡易回覆</span>}
                  {m.from === "bot" && !m.pending && tts.supported && (
                    <button
                      type="button"
                      onClick={() => (tts.speakingId === m.id ? tts.stop() : (tts.unlock(), tts.speak(m.id, m.text)))}
                      className="flex items-center gap-1 px-1 text-[11px] text-white/45 hover:text-white"
                    >
                      {tts.speakingId === m.id ? (
                        <>
                          <Square className="h-3 w-3 fill-current" /> 停止
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" /> 朗讀
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {typing && msgs.some((m) => m.pending && !m.text) && (
              <div className="flex items-end justify-start gap-2" aria-label="正在回覆">
                <Avatar size="h-7 w-7" />
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1 self-start rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-3">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                  {msgs.find((m) => m.pending)?.status && (
                    <span className="px-1 text-[11px] text-white/45">{msgs.find((m) => m.pending)?.status}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {notice && (
            <div className="mx-4 mb-2 flex flex-none items-start gap-2 rounded-item bg-warning/10 px-3 py-2 text-xs text-warning">
              <span className="flex-1">{notice}</span>
              <button type="button" aria-label="關閉提示" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-none gap-2 overflow-x-auto px-4 pb-2">
            {chips.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="flex-none rounded-full border border-white/15 px-3 py-1 text-xs text-white/80 hover:border-mint/60 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="flex flex-none items-center gap-2 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            {/* 不支援時也不停用,按了會說明原因(停用的按鈕按不出任何提示) */}
            <button
              type="button"
              onClick={onMic}
              aria-label={stt.listening ? "停止聆聽" : "語音輸入"}
              aria-pressed={stt.listening}
              title={stt.unavailable || (stt.listening ? "停止聆聽" : "按一下開始說話")}
              className={cn(
                "relative flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors",
                stt.listening
                  ? "bg-danger text-white"
                  : stt.unavailable
                    ? "bg-white/5 text-white/30"
                    : "bg-white/10 text-white hover:bg-white/15",
              )}
            >
              {stt.listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/50" />}
              <Mic className="relative h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              value={stt.listening ? stt.interim : draft}
              readOnly={stt.listening}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder={stt.listening ? "正在聆聽,請說話…" : "輸入問題,或按麥克風用說的…"}
              // 16px 以上:iOS 對更小的輸入框會自動放大整頁
              className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-base text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-mint/60 sm:text-sm"
            />
            <button
              type="submit"
              aria-label="送出"
              disabled={!draft.trim() || typing || stt.listening}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-mint text-dark-text disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function Avatar({ size }: { size: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={AVATAR} alt="" className={cn(size, "flex-none rounded-full bg-[#EAF4FD] object-cover")} />
  );
}
