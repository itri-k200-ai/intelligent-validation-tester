"use client";
import { Fragment } from "react";

import { cn } from "@/lib/cn";

export interface Step {
  label: string;
}

export interface ProgressStepperProps {
  steps: Step[];
  /** 0-indexed. -1 = not started, steps.length = all done. */
  current: number;
  className?: string;
}

/**
 * Numbered stepper — War_Room_mockup Page 9 Progress Bar.
 *
 * Renders ①②③④ connected by lines; current step gets a mint glow ring.
 * Wall-mode scaling is in globals.css under `.progress-stepper`.
 */
export function ProgressStepper({ steps, current, className }: ProgressStepperProps) {
  return (
    <ol className={cn("progress-stepper flex items-start", className)} role="list">
      {steps.map((step, i) => {
        const state: "done" | "current" | "default" =
          i < current ? "done" : i === current ? "current" : "default";
        const isLast = i === steps.length - 1;
        return (
          <Fragment key={`${i}-${step.label}`}>
            <li
              className="progress-stepper-item flex flex-col items-center gap-2"
              data-state={state}
            >
              <span
                className={cn(
                  "progress-stepper-circle",
                  "inline-flex h-10 w-10 items-center justify-center rounded-full",
                  "border-2 text-sm font-semibold transition-colors",
                  state === "default" && "border-white/30 bg-transparent text-white/55",
                  state === "current" &&
                    "border-mint-300 bg-mint-300 text-navy " +
                      "shadow-[0_0_0_4px_rgba(128,255,232,0.25),0_0_18px_rgba(128,255,232,0.55)]",
                  state === "done" && "border-mint-300/70 bg-mint-300 text-navy",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "progress-stepper-label text-xs text-center whitespace-nowrap",
                  state === "default" && "text-white/45",
                  state === "current" && "text-white font-semibold",
                  state === "done" && "text-white/80",
                )}
              >
                {step.label}
              </span>
            </li>
            {!isLast && (
              <span
                className={cn(
                  "progress-stepper-connector mt-[18px] h-[2px] flex-1 min-w-[2rem] mx-2",
                  state === "done" ? "bg-mint-300/70" : "bg-white/15",
                )}
                data-state={state === "done" ? "done" : "default"}
                aria-hidden="true"
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
