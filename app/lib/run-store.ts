"use client";

// Run history lives in localStorage.
//
// This is a deliberate choice for a no-database deployment: every run the API
// returns is a complete, self-contained record, so the detail page needs
// nothing but the id. Trade-off: history is per-browser and not shared.

import type { TestRun } from "./quality";

const KEY = "ai-quality-monitor:runs";
const MAX_RUNS = 200;

export function loadRuns(): TestRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TestRun[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: TestRun): void {
  if (typeof window === "undefined") return;
  try {
    const runs = [run, ...loadRuns()].slice(0, MAX_RUNS);
    window.localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    // Quota exceeded or storage disabled — the run still renders from state.
  }
}

export function getRun(id: string): TestRun | null {
  return loadRuns().find((r) => r.id === id) ?? null;
}

export function clearRuns(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
