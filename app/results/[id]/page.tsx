"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import type { TestRun } from "@/app/lib/quality";
import { getRun } from "@/app/lib/run-store";

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="w-full text-sm text-muted-foreground sm:w-56 sm:shrink-0">
        {label}
      </dt>
      <dd className={`text-sm ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export default function ResultDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [run, setRun] = useState<TestRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setRun(getRun(id));
    setLoaded(true);
  }, [id]);

  if (!loaded) {
    return (
      <div className="container mx-auto px-4 py-12 text-sm text-muted-foreground">
        Loading report…
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Back to dashboard
          </Link>
          <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center">
            <h1 className="text-lg font-medium">Report not found</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              No run with id <code className="font-mono">{id}</code> is stored in
              this browser. Run history is kept in local storage, so a link from
              another browser or device will not resolve.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const passedChecks = run.checks.filter((c) => c.passed).length;
  const latency = run.meta?.latency;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(run, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        {/* Verdict */}
        <section className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {run.categoryName} — {run.model}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(run.timestamp), "PPpp")} · run{" "}
              <code className="font-mono text-xs">{run.id}</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-4xl font-bold">{run.score}%</p>
              <p className="text-xs text-muted-foreground">
                threshold {run.threshold}%
              </p>
            </div>
            {run.error ? (
              <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
                Error
              </span>
            ) : run.passedThreshold ? (
              <span className="rounded-full bg-[hsl(var(--success))]/10 px-3 py-1.5 text-sm font-medium text-[hsl(var(--success))]">
                Passed
              </span>
            ) : (
              <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
                Below threshold
              </span>
            )}
          </div>
        </section>

        {run.error && (
          <div className="mb-8 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <h2 className="text-sm font-semibold">Provider error</h2>
            <p className="mt-1 font-mono text-xs break-all">{run.error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              The call did not return a completion, so no quality checks could
              run. The score of 0 reflects a failed request, not a failed answer.
            </p>
          </div>
        )}

        {/* Check-by-check breakdown */}
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold">
            Checks ({passedChecks}/{run.checks.length} passed)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Each check is deterministic. The score is the proportion that pass.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            {run.checks.map((check, i) => (
              <div
                key={i}
                className={`flex gap-3 p-4 ${
                  i % 2 === 0 ? "bg-background" : "bg-muted/30"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    check.passed
                      ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
                      : "bg-destructive/20 text-destructive"
                  }`}
                  aria-label={check.passed ? "passed" : "failed"}
                >
                  {check.passed ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="mt-1 text-xs break-words text-muted-foreground">
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Prompt and response */}
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-semibold">Prompt sent</h2>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap">
              {run.prompt}
            </pre>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold">Response received</h2>
            <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap">
              {run.response ?? "(no response)"}
            </pre>
          </div>
        </section>

        {/* Structured evidence */}
        {Object.keys(run.artifacts ?? {}).length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">
              Scoring evidence
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              The exact fixtures and extracted values the checks ran against.
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <dl className="px-4">
                {Object.entries(run.artifacts).map(([key, value]) => (
                  <Row
                    key={key}
                    label={key}
                    value={
                      Array.isArray(value) ? (
                        <span className="font-mono text-xs break-all">
                          {value.length > 0
                            ? value.map((v) => String(v)).join("  ·  ")
                            : "(none)"}
                        </span>
                      ) : value === null ? null : (
                        <span className="font-mono text-xs break-all">
                          {String(value)}
                        </span>
                      )
                    }
                  />
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* Call metadata */}
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Call metadata</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Reported by the provider for this specific request.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <dl className="px-4">
              <Row label="Provider" value={run.provider} />
              <Row label="Model requested" value={run.meta?.modelRequested} mono />
              <Row
                label="Model served"
                value={
                  run.meta?.modelServed ? (
                    <span className="font-mono text-xs">
                      {run.meta.modelServed}
                      {run.meta.modelServed !== run.meta.modelRequested && (
                        <span className="ml-2 rounded bg-[hsl(var(--warning))]/20 px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--warning))]">
                          differs from requested
                        </span>
                      )}
                    </span>
                  ) : null
                }
              />
              <Row label="Route / replica" value={run.meta?.route} mono />
              <Row label="Request ID" value={run.meta?.requestId} mono />
              <Row label="System fingerprint" value={run.meta?.systemFingerprint} mono />
              <Row
                label="Tokens (prompt / completion / total)"
                value={
                  run.meta?.totalTokens != null ? (
                    <span className="font-mono text-xs">
                      {run.meta.promptTokens} / {run.meta.completionTokens} /{" "}
                      {run.meta.totalTokens}
                    </span>
                  ) : null
                }
              />
              <Row
                label="Charged"
                value={
                  run.meta?.chargedAmount
                    ? `$${Number(run.meta.chargedAmount).toFixed(8)}`
                    : null
                }
                mono
              />
              <Row
                label="Wall clock (measured)"
                value={
                  run.meta?.wallClockMs ? `${run.meta.wallClockMs} ms` : null
                }
              />
            </dl>
          </div>

          {latency && Object.keys(latency).length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-muted/40 px-4 py-2">
                <p className="text-xs font-medium">
                  Provider latency checkpoints (ms)
                </p>
              </div>
              <dl className="px-4">
                {Object.entries(latency).map(([key, value]) => (
                  <Row
                    key={key}
                    label={key.replace(/_/g, " ")}
                    value={<span className="font-mono text-xs">{value} ms</span>}
                  />
                ))}
              </dl>
            </div>
          )}
        </section>

        {/* Raw export */}
        <section className="mb-8">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <h2 className="text-sm font-semibold">Raw record</h2>
              <p className="text-xs text-muted-foreground">
                The complete run as stored, including everything above.
              </p>
            </div>
            <button
              onClick={copyJson}
              className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-xs hover:border-primary"
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs">
            {JSON.stringify(run, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}
