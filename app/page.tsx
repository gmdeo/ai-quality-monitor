"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

// Test categories with specific prompts
const TEST_CATEGORIES = {
  CODE_GENERATION: {
    name: "Code Generation",
    prompt: "Write a Python function that validates an email address using regex. Include error handling and type hints.",
    scoreThreshold: 70,
  },
  REASONING: {
    name: "Logical Reasoning",
    prompt: "If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly? Explain your reasoning step by step.",
    scoreThreshold: 75,
  },
  FACTUAL_ACCURACY: {
    name: "Factual Accuracy",
    prompt: "What is the capital of Australia? Provide your answer and explain why this is often confused.",
    scoreThreshold: 90,
  },
  INSTRUCTION_FOLLOWING: {
    name: "Instruction Following",
    prompt: "List exactly 3 benefits of exercise. Format as: 1. [benefit] 2. [benefit] 3. [benefit]. Do not add introduction or conclusion.",
    scoreThreshold: 85,
  },
};

type TestResult = {
  id: string;
  timestamp: Date;
  category: string;
  modelName: string;
  qualityScore: number;
  response: string;
  passedThreshold: boolean;
};

type TrendDataPoint = {
  date: string;
  [modelName: string]: number | string;
};

export default function DashboardPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof TEST_CATEGORIES>("CODE_GENERATION");
  const [selectedModel, setSelectedModel] = useState("gpt-4");

  // Calculate trend data for charts
  const trendDataByModel = testResults.reduce((acc, result) => {
    const dateKey = format(result.timestamp, "MMM dd");
    const existing = acc.find((d) => d.date === dateKey);
    
    if (existing) {
      existing[result.modelName] = result.qualityScore;
    } else {
      acc.push({
        date: dateKey,
        [result.modelName]: result.qualityScore,
      });
    }
    
    return acc;
  }, [] as TrendDataPoint[]);

  // Get unique model names from results
  const uniqueModels = Array.from(new Set(testResults.map(r => r.modelName)));

  // Mock test runner (would call real API in production)
  const runQualityTest = async () => {
    setIsRunningTest(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock quality score with some variance
    const baseScore = 75;
    const variance = Math.random() * 20 - 10;
    const qualityScore = Math.min(100, Math.max(0, baseScore + variance));
    
    const category = TEST_CATEGORIES[selectedCategory];
    const passedThreshold = qualityScore >= category.scoreThreshold;
    
    const newResult: TestResult = {
      id: `test_${Date.now()}`,
      timestamp: new Date(),
      category: category.name,
      modelName: selectedModel,
      qualityScore: Math.round(qualityScore),
      response: "Mock response from AI model...",
      passedThreshold,
    };
    
    setTestResults(prev => [newResult, ...prev]);
    setIsRunningTest(false);
  };

  // Calculate average score by model
  const averageScoresByModel = uniqueModels.map(modelName => {
    const modelResults = testResults.filter(r => r.modelName === modelName);
    const avgScore = modelResults.reduce((sum, r) => sum + r.qualityScore, 0) / modelResults.length;
    return { modelName, avgScore: Math.round(avgScore) };
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">AI Quality Monitor</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track model performance degradation over time
              </p>
            </div>
            <a
              href="/about"
              className="text-sm text-primary hover:underline"
            >
              About this tool
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Test Runner Section */}
        <section className="mb-12">
          <div className="rounded-lg border border-border bg-muted/40 p-6">
            <h2 className="mb-4 text-xl font-semibold">Run Quality Test</h2>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="model-select" className="mb-2 block text-sm font-medium">
                  Model
                </label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
              </div>

              <div>
                <label htmlFor="category-select" className="mb-2 block text-sm font-medium">
                  Test Category
                </label>
                <select
                  id="category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as keyof typeof TEST_CATEGORIES)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(TEST_CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={runQualityTest}
                  disabled={isRunningTest}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunningTest ? "Running test..." : "Run Test"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Test prompt:</span>{" "}
                {TEST_CATEGORIES[selectedCategory].prompt}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pass threshold: {TEST_CATEGORIES[selectedCategory].scoreThreshold}%
              </p>
            </div>
          </div>
        </section>

        {/* Results Section */}
        {testResults.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No tests run yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Run your first quality check to start tracking model performance over time.
            </p>
          </div>
        ) : (
          <>
            {/* Model Comparison Cards */}
            {averageScoresByModel.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Average Quality by Model</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {averageScoresByModel.map(({ modelName, avgScore }) => (
                    <div key={modelName} className="rounded-lg border border-border bg-background p-4">
                      <p className="text-sm font-medium text-muted-foreground">{modelName}</p>
                      <p className="mt-2 text-3xl font-bold">
                        {avgScore}
                        <span className="text-lg text-muted-foreground">%</span>
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${
                            avgScore >= 80
                              ? "bg-success"
                              : avgScore >= 60
                              ? "bg-warning"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${avgScore}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trend Chart */}
            {trendDataByModel.length > 1 && (
              <section className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">Quality Trends Over Time</h2>
                <div className="rounded-lg border border-border bg-background p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendDataByModel}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                      {uniqueModels.map((modelName, idx) => (
                        <Line
                          key={modelName}
                          type="monotone"
                          dataKey={modelName}
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

            {/* Recent Test Results */}
            <section>
              <h2 className="mb-4 text-xl font-semibold">Recent Test Results</h2>
              <div className="space-y-3">
                {testResults.slice(0, 10).map((result) => (
                  <div
                    key={result.id}
                    className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{result.modelName}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{result.category}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {format(result.timestamp, "MMM dd, HH:mm")}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-2xl font-bold">{result.qualityScore}%</span>
                          {result.passedThreshold ? (
                            <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                              Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                              Below threshold
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="h-16 w-16 rounded-full border-4 border-muted flex items-center justify-center relative">
                          <svg className="h-16 w-16 -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              className={
                                result.qualityScore >= 80
                                  ? "text-success"
                                  : result.qualityScore >= 60
                                  ? "text-warning"
                                  : "text-destructive"
                              }
                              strokeDasharray={`${(result.qualityScore / 100) * 176} 176`}
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mt-16 border-t border-border bg-muted/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Built to address the #1 AI pain point: quality degradation over time
        </div>
      </footer>
    </div>
  );
}
