"use client";

import { Dots, Spinner } from "./icons";

/**
 * Shown while a turn is streaming but no assistant text has arrived
 * yet (model is in thinking / planning / tool-call phase). Long waits
 * get a progressive label so the UX never looks dead.
 *
 * Once an assistant `text` event arrives, the parent swaps this out
 * for the live <Bubble> which carries on the elapsed indicator at
 * its footer.
 */
export default function ThinkingBubble({
  activity,
  elapsed,
  thinking,
}: {
  activity: string;
  elapsed: number;
  thinking: string;
}) {
  const showActivity = activity && activity !== "thinking…";
  const veryLongWait = elapsed >= 60 && !activity;
  const longWait = elapsed >= 30 && !activity;

  let stateLabel = "Thinking…";
  if (veryLongWait) stateLabel = "Planning the work — first big task can take a minute";
  else if (longWait) stateLabel = "Planning…";

  return (
    <div className="flex justify-start">
      <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[15px] text-zinc-600 max-w-3xl w-full">
        <div className="flex items-center justify-between gap-2">
          {showActivity ? (
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Spinner />
              <div className="font-mono text-[13px] text-zinc-700 break-all">
                {activity}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-zinc-600 min-w-0">
              <Dots />
              <span className="text-[13px] truncate">{stateLabel}</span>
            </div>
          )}
          <span className="text-[13px] tabular-nums text-zinc-400 shrink-0">
            {elapsed}s
          </span>
        </div>
        {thinking && (
          <details className="mt-2 group" open>
            <summary className="cursor-pointer text-[12px] uppercase tracking-widest text-zinc-400 font-medium hover:text-zinc-700 transition-colors flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-90">
                <path d="M9 18l6-6-6-6" />
              </svg>
              reasoning
            </summary>
            <div className="mt-2 max-h-48 overflow-y-auto text-[13px] text-zinc-500 italic leading-relaxed whitespace-pre-wrap font-serif border-l-2 border-zinc-200 pl-3">
              {thinking}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
