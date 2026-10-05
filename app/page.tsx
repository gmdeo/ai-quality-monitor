"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { TestRun } from "./lib/quality";
import { loadRuns, saveRun, clearRuns } from "./lib/run-store";

interface CategoryInfo {
  id: string;
  name: string;
  prompt: string;
  threshold: number;
  method: string;
}

interface ModelInfo {
  id: string;
  label: string;
  family: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  configured: boolean;
}

type SampleRun = TestRun & { isSample: true };

/**
 * A single, clearly labelled fixture so the UI is explorable before any API
 * call is made. It is badged as a sample everywhere it appears and is excluded
 * from every average and chart.
 */
const SAMPLE_RUN: SampleRun = {
  isSample: true,
  id: "sample_instruction_following",
  timestamp: "2026-01-01T00:00:00.000Z",
  categoryId: "instruction_following",
  categoryName: "Instruction Following",
  model: "sample — gpt-4o-mini",
  provider: "entelic",
  prompt:
    "List exactly 3 benefits of exercise. Format as: 1. [benefit] 2. [benefit] 3. [benefit]. Do not add introduction or conclusion.",
  response:
    "1. Improved cardiovascular health\n2. Better mood and mental wellbeing\n3. Stronger muscles and bones",
  score: 100,
  passedThreshold: true,
  threshold: 85,
  checks: [
    {
      name: "Exactly three items",
      passed: true,
      detail:
        "Found 3 item(s) with sequential numbering: 1. Improved cardiovascular health | 2. Better mood and mental wellbeing | 3. Stronger muscles and bones (items may be on one line; found by numbering, not line breaks)",
    },
    {
      name: "Numbered 1, 2, 3 in order",
      passed: true,
      detail: "Sequential markers found: 1, 2, 3",
    },
    {
      name: "No preamble before item 1",
      passed: true,
      detail: "Response opens directly with item 1.",
    },
    {
      name: "Item 3 is a short phrase, not a trailing summary",
      passed: true,
      detail: "Item 3 is 5 word(s) — a benefit phrase, not a paragraph.",
    },
    {
      name: "No added prose lines",
      passed: true,
      detail: "All 3 line(s) carry numbered items.",
    },
  ],
  artifacts: {
    note: "Hand-written example, not a live provider call.",
    parsedItems: [],
    lineCount: 3,
  },
  meta: {
    provider: "entelic",
    modelRequested: "gpt-4o-mini",
    modelServed: null,
    route: null,
    requestId: null,
    systemFingerprint: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    chargedAmount: null,
    latency: null,
    wallClockMs: 0,
  },
  error: null,
};

export default function DashboardPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("entelic");
  const [isRunning, setIsRunning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(true);

  useEffect(() => {
    setRuns(loadRuns());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/run-test");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setCategories(data.categories ?? []);
        setModels(data.models ?? []);
        setProviders(data.providers ?? []);
        if (data.categories?.[0]) setSelectedCategory(data.categories[0].id);
        if (data.models?.[0]) setSelectedModel(data.models[0].id);
        const firstConfigured = (data.providers ?? []).find(
          (p: ProviderInfo) => p.configured
        );
        if (firstConfigured) setSelectedProvider(firstConfigured.id);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load test suite."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentCategory = categories.find((c) => c.id === selectedCategory);

  const runQualityTest = useCallback(async () => {
    if (!selectedCategory || !selectedModel) return;
    setIsRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory,
          model: selectedModel,
          provider: selectedProvider,
        }),
      });
      const data = (await res.json()) as TestRun & { error?: string };
      if (!data.id) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setRuns((prev) => [data, ...prev]);
      saveRun(data);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setIsRunning(false);
    }
  }, [selectedCategory, selectedModel, selectedProvider]);

  // Real runs drive every statistic. The sample is displayed separately.
  const visibleRuns = useMemo(
    () => (showSample ? [...runs, SAMPLE_RUN] : runs),
    [runs, showSample]
  );

  const trendData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of [...runs].reverse()) {
      const key = format(new Date(r.timestamp), "MM/dd HH:mm");
      const row = byDate.get(key) ?? { date: key };
      row[r.model] = r.score;
      byDate.set(key, row);
    }
    return [...byDate.values()];
  }, [runs]);

  const averages = useMemo(() => {
    const byModel = new Map<string, number[]>();
    for (const r of runs) {
      byModel.set(r.model, [...(byModel.get(r.model) ?? []), r.score]);
    }
    return [...byModel.entries()].map(([model, scores]) => ({
      model,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      n: scores.length,
    }));
  }, [runs]);

  const uniqueModels = useMemo(
    () => [...new Set(runs.map((r) => r.model))],
    [runs]
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                AI Quality Monitor
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track model performance degradation over time
              </p>
            </div>
            <Link href="/about" className="text-sm text-primary hover:underline">
              About this tool
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loadError && (
          <div className="mb-8 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <strong>Could not load the test suite.</strong> {loadError}
          </div>
        )}

        {/* Test runner */}
        <section className="mb-12">
          <div className="rounded-lg border border-border bg-muted/40 p-6">
            <h2 className="mb-4 text-xl font-semibold">Run Quality Test</h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor="model-select"
                  className="mb-2 block text-sm font-medium"
                >
                  Model
                </label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.family}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="category-select"
                  className="mb-2 block text-sm font-medium"
                >
                  Test Category
                </label>
                <select
                  id="category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="provider-select"
                  className="mb-2 block text-sm font-medium"
                >
                  Provider
                </label>
                <select
                  id="provider-select"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.configured}>
                      {p.name}
                      {p.configured ? "" : " — no key set"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={runQualityTest}
                  disabled={isRunning || !selectedCategory || !selectedModel}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunning ? "Running test..." : "Run Test"}
                </button>
              </div>
            </div>

            {currentCategory && (
              <div className="mt-4 rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Test prompt:</span>{" "}
                  {currentCategory.prompt}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pass threshold: {currentCategory.threshold}%
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Scored by:</span>{" "}
                  {currentCategory.method}
                </p>
              </div>
            )}

            {runError && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {runError}
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        {visibleRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <h3 className="text-lg font-medium">No tests run yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Run a quality check to call the provider and store a real,
              clickable result. Every score comes from deterministic checks you
              can inspect.
            </p>
          </div>
        ) : (
          <>
            {runs.length > 0 && averages.length > 0 && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    Average Quality by Model
                  </h2>
                  <button
                    onClick={() => {
                      clearRuns();
                      setRuns([]);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear history
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {averages.map(({ model, avg, n }) => (
                    <div
                      key={model}
                      className="rounded-lg border border-border bg-background p-4"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {model}
                      </p>
                      <p className="mt-2 text-3xl font-bold">
                        {avg}
                        <span className="text-lg text-muted-foreground">%</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {n} run{n === 1 ? "" : "s"}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${
                            avg >= 80
                              ? "bg-[hsl(var(--success))]"
                              : avg >= 60
                              ? "bg-[hsl(var(--warning))]"
                              : "bg-[hsl(var(--destructive))]"
                          }`}
                          style={{ width: `${avg}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {trendData.length > 1 && (
              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">
                  Quality Trends Over Time
                </h2>
                <div className="rounded-lg border border-border bg-background p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                      />
                      <Legend />
                      {uniqueModels.map((model, idx) => (
                        <Line
                          key={model}
                          type="monotone"
                          dataKey={model}
                          stroke={`hsl(${(idx * 360) / uniqueModels.length}, 70%, 50%)`}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent Test Results</h2>
                {runs.length > 0 && (
                  <button
                    onClick={() => setShowSample((s) => !s)}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    {showSample ? "Hide" : "Show"} sample
                  </button>
                )}
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Select a result to see the full prompt, response, and the checks
                behind the score.
              </p>
              <div className="space-y-3">
                {visibleRuns.slice(0, 20).map((result) => {
                  const isSample = (result as SampleRun).isSample === true;
                  return (
                    <Link
                      key={result.id}
                      href={isSample ? "#" : `/results/${result.id}`}
                      aria-disabled={isSample}
                      onClick={(e) => {
                        if (isSample) e.preventDefault();
                      }}
                      className={`block rounded-lg border bg-background p-4 transition-colors ${
                        isSample
                          ? "cursor-default border-dashed opacity-70"
                          : "border-border hover:border-primary hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {result.model}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              •
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {result.categoryName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              •
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {isSample
                                ? "example"
                                : format(
                                    new Date(result.timestamp),
                                    "MMM dd, HH:mm"
                                  )}
                            </span>
                            {isSample && (
                              <span className="rounded-full bg-[hsl(var(--warning))]/20 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--warning))]">
                                SAMPLE — NOT A LIVE CALL
                              </span>
                            )}
                            {result.error && (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                ERROR
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="text-2xl font-bold">
                              {result.score}%
                            </span>
                            {result.passedThreshold ? (
                              <span className="rounded-full bg-[hsl(var(--success))]/10 px-2 py-1 text-xs font-medium text-[hsl(var(--success))]">
                                Passed
                              </span>
                            ) : (
                              <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                                Below threshold
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {result.checks.filter((c) => c.passed).length}/
                              {result.checks.length} checks passed
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            {result.response
                              ? result.response.slice(0, 160)
                              : result.error}
                          </p>
                        </div>
                        {!isSample && (
                          <span className="whitespace-nowrap text-xs text-primary">
                            View report →
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mt-16 border-t border-border bg-muted/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Scores are produced by deterministic checks against fixed answer keys
          — every number is reproducible and inspectable.
        </div>
      </footer>
    </div>
  );
}
