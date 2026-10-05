import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-6 text-4xl font-bold tracking-tight">
          AI Quality Monitor
        </h1>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-semibold">The Problem</h2>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
              <ul className="space-y-3 text-foreground/90">
                <li>
                  <strong>61% of users</strong> report AI tools are worse than a year ago
                </li>
                <li>
                  <strong>32% see more bugs</strong> than in 2023
                </li>
                <li>
                  Common complaint: <em>"Saves 30 min writing, costs 2 hours debugging"</em>
                </li>
                <li>
                  <strong>Only 15%</strong> of GenAI deployments have any instrumentation
                </li>
              </ul>
            </div>
            <p className="mt-4 text-muted-foreground">
              Users have multiple AI tools—Claude, ChatGPT, Cursor, Copilot—but no way to 
              systematically track whether they're getting better or worse over time.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-semibold">The Solution</h2>
            <p className="mb-4">
              AI Quality Monitor fills the reliability infrastructure gap by providing:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-2 font-semibold text-primary">Systematic Testing</h3>
                <p className="text-sm text-muted-foreground">
                  Standardized prompts across code, reasoning, facts, and instruction-following
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-2 font-semibold text-primary">Quality Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Score each response against defined thresholds
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-2 font-semibold text-primary">Degradation Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Trend analysis reveals when models regress
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-2 font-semibold text-primary">Model Comparison</h3>
                <p className="text-sm text-muted-foreground">
                  See which models maintain quality over time
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-semibold">Market Opportunity</h2>
            <div className="rounded-lg border border-success/30 bg-success/5 p-6">
              <p className="mb-3 font-medium">
                AI Agent Observability is a <strong>$2.69B market growing at 36% CAGR</strong>
              </p>
              <ul className="space-y-2 text-sm text-foreground/90">
                <li>Coralogix raised $200M Series F specifically for this gap</li>
                <li>Only 15% of deployments have instrumentation today</li>
                <li>Sparse category with proven demand</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-semibold">Research Foundation</h2>
            <p className="mb-4">
              This tool was built using deep research across seven domains:
            </p>
            <div className="space-y-2 text-sm">
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">Domain Expertise (Agent A)</summary>
                <p className="mt-2 text-muted-foreground">
                  Validated that AI observability has $2.69B market with 36% growth but only 
                  15% deployment penetration—a genuine gap, not unpopular work.
                </p>
              </details>
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">User Psychology (Agent B)</summary>
                <p className="mt-2 text-muted-foreground">
                  Confirmed reliability infrastructure is the #1 unmet need, ahead of new features.
                  Users want degradation detection, not more capabilities.
                </p>
              </details>
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">Market Timing (Agent C)</summary>
                <p className="mt-2 text-muted-foreground">
                  Reasoning models (Sept 2024+) can now self-verify, making quality scoring 
                  newly viable at reasonable cost.
                </p>
              </details>
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">Interface Design (Agent D)</summary>
                <p className="mt-2 text-muted-foreground">
                  Applied patterns: time-series trends over snapshots, comparative scoring, 
                  evidence-based alerts with specific failure examples.
                </p>
              </details>
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">Technical Architecture (Agent E)</summary>
                <p className="mt-2 text-muted-foreground">
                  Next.js + Recharts for interactive charts, deployed to Vercel. 
                  Designed for fast iteration with client-side scoring.
                </p>
              </details>
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">Code Quality (Agent F)</summary>
                <p className="mt-2 text-muted-foreground">
                  Exhaustive naming (qualityScoreOverTimeByModel not scores), zero magic numbers, 
                  errors citing actual failures, single responsibility components.
                </p>
              </details>
              <details className="rounded-lg border border-border bg-muted/20 p-4">
                <summary className="cursor-pointer font-medium">Production Polish (Agent G)</summary>
                <p className="mt-2 text-muted-foreground">
                  Loading states with progress, error states with retry actions, empty state 
                  showing example test, real prompts instead of lorem ipsum.
                </p>
              </details>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold">What This Unlocks</h2>
            <p className="mb-4">
              The research and patterns from this build can power:
            </p>
            <ol className="list-decimal space-y-2 pl-6 text-sm">
              <li>
                <strong>LLM API Health Monitoring:</strong> Track uptime, latency, and response 
                quality across providers (OpenAI, Anthropic, Cohere)
              </li>
              <li>
                <strong>Prompt Regression Testing:</strong> Catch when prompt changes break 
                existing workflows before production
              </li>
              <li>
                <strong>Multi-Model Cost/Quality Optimizer:</strong> Route queries to the 
                cheapest model that meets quality threshold
              </li>
              <li>
                <strong>Enterprise AI Governance Dashboard:</strong> Show compliance officers 
                which models meet accuracy/safety requirements
              </li>
              <li>
                <strong>Agent Behavior Monitoring:</strong> Track autonomous agent decision 
                quality over time
              </li>
              <li>
                <strong>Fine-tune Quality Validator:</strong> Verify custom models don't degrade 
                on core capabilities
              </li>
              <li>
                <strong>Real-time Model Comparison Tool:</strong> A/B test models on your actual 
                workload before switching
              </li>
            </ol>
          </section>
        </div>
      </main>
    </div>
  );
}
