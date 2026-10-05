// Real provider calls, test suite, and deterministic scoring.
//
// Design note: scoring is deliberately deterministic (no judge model) so every
// number is reproducible and defensible. Each test returns a score plus the
// individual checks that produced it, so the report can show its own working.

export type ProviderId = "entelic" | "venice";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  keyEnv: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  entelic: {
    id: "entelic",
    name: "Entelic (primary)",
    baseUrl: "https://api.entelic.io/v1",
    // Entelic answers Cloudflare's bot rules; a browser UA is required.
    keyEnv: ["ARIA_API_KEY"],
  },
  venice: {
    id: "venice",
    name: "Venice (fallback)",
    baseUrl: "https://api.venice.ai/api/v1",
    keyEnv: ["VENICE_API_KEY", "OPENAI_API_KEY"],
  },
};

// Models confirmed present in the provider catalogue.
export const MODEL_CATALOGUE: { id: string; label: string; family: string }[] =
  [
    { id: "gpt-4o-mini", label: "GPT-4o mini", family: "OpenAI" },
    { id: "gpt-4.1", label: "GPT-4.1", family: "OpenAI" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", family: "Anthropic" },
    { id: "claude-opus-5", label: "Claude Opus 5", family: "Anthropic" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", family: "Google" },
    { id: "deepseek-v3.2", label: "DeepSeek V3.2", family: "DeepSeek" },
    { id: "grok-4", label: "Grok 4", family: "xAI" },
    { id: "qwen3.5-plus", label: "Qwen 3.5 Plus", family: "Alibaba" },
    {
      id: "llama-3.3-70b-instruct",
      label: "Llama 3.3 70B",
      family: "Meta",
    },
  ];

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ScoreResult {
  score: number;
  checks: CheckResult[];
  artifacts: Record<string, unknown>;
}

export interface CallMetadata {
  provider: ProviderId;
  modelRequested: string;
  modelServed: string | null;
  route: string | null;
  requestId: string | null;
  systemFingerprint: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  chargedAmount: string | null;
  /** Provider-reported latency checkpoints, in milliseconds. */
  latency: Record<string, number> | null;
  /** Wall-clock time we measured, in ms. */
  wallClockMs: number;
}

export interface TestRun {
  id: string;
  timestamp: string;
  categoryId: string;
  categoryName: string;
  model: string;
  provider: ProviderId;
  prompt: string;
  response: string | null;
  score: number;
  passedThreshold: boolean;
  threshold: number;
  checks: CheckResult[];
  artifacts: Record<string, unknown>;
  meta: CallMetadata | null;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Scoring helpers                                                     */
/* ------------------------------------------------------------------ */

const EMAIL_VALID = [
  "alice@example.com",
  "bob.smith+news@sub.domain.org",
  "x@y.co",
];
const EMAIL_INVALID = [
  "plainaddress",
  "missing@tld",
  "@nolocal.com",
  "spaces in@email.com",
];

/**
 * Pull candidate regex sources out of a model response.
 *
 * Models express the same regex in several ways — `/pattern/` literals,
 * `new RegExp(...)`/`re.compile(...)` calls, or a Python raw-string constant like
 * `r'^[^@]+@[^@]+$'`. Missing the last form scored correct answers as zero, so
 * all three are extracted. Candidate patterns are never eval'd: each is
 * compiled with new RegExp inside a try/catch and only ever run against the
 * short fixture lists below.
 */
function extractRegexSources(text: string): string[] {
  const sources = new Set<string>();

  // 1. /pattern/flags literals
  const literal = /\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/g;
  let m: RegExpExecArray | null;
  while ((m = literal.exec(text)) !== null) {
    if (m[1].length <= 300) sources.add(m[1]);
  }

  // 2. new RegExp("pattern") / re.compile(r"pattern")
  const ctor = /(?:new RegExp|re\.compile)\(\s*r?["'`](.+?)["'`]\s*[,)]/g;
  while ((m = ctor.exec(text)) !== null) {
    if (m[1].length <= 300) sources.add(m[1]);
  }

  // 3. Quoted string constants, with an optional Python raw prefix.
  //    Non-raw strings have their escapes doubled in source, so unescape them;
  //    raw strings are already in regex form.
  const strLit = /(^|[\s=(\[,:])(r|rb|fr)?(["'`])((?:\\.|(?!\3)[^\\])*)\3/g;
  while ((m = strLit.exec(text)) !== null) {
    const isRaw = Boolean(m[2]);
    let value = m[4];
    if (!isRaw) value = value.replace(/\\\\/g, "\\");
    if (value.length > 0 && value.length <= 300) sources.add(value);
  }

  // The task is email validation, so any correct pattern must contain "@".
  // A minimum length also drops incidental fragments like the bare string
  // "@" or "a@b" that cannot be a real validator but would otherwise clutter
  // the evidence panel.
  return [...sources].filter((s) => s.includes("@") && s.length >= 6);
}

function scoreCodeGeneration(text: string): ScoreResult {
  const sources = extractRegexSources(text);
  const checks: CheckResult[] = [];

  checks.push({
    name: "Response contains a usable regex",
    passed: sources.length > 0,
    detail:
      sources.length > 0
        ? `${sources.length} candidate pattern(s) extracted: ${sources
            .map((s) => `/${s}/`)
            .join(", ")}`
        : "No regex literal or RegExp constructor found in the response.",
  });

  let best: { source: string; valid: number; invalid: number } | null = null;
  let bestAccuracy = -1;

  for (const source of sources) {
    let re: RegExp;
    try {
      // Case-insensitive test anchor; the pattern itself is the model's.
      re = new RegExp(source, "i");
    } catch {
      continue;
    }
    let valid = 0;
    let invalid = 0;
    for (const e of EMAIL_VALID) {
      try {
        if (re.test(e)) valid++;
      } catch {
        /* pathological pattern, treated as a miss */
      }
    }
    for (const e of EMAIL_INVALID) {
      try {
        if (!re.test(e)) invalid++;
      } catch {
        /* as above */
      }
    }
    const accuracy = (valid + invalid) / (EMAIL_VALID.length + EMAIL_INVALID.length);
    if (accuracy > bestAccuracy) {
      bestAccuracy = accuracy;
      best = { source, valid, invalid };
    }
  }

  const validOk = best ? best.valid === EMAIL_VALID.length : false;
  const invalidOk = best ? best.invalid === EMAIL_INVALID.length : false;

  checks.push({
    name: "Accepts valid addresses",
    passed: validOk,
    detail: best
      ? `${best.valid}/${EMAIL_VALID.length} accepted — ${EMAIL_VALID.join(", ")}`
      : "No pattern to test.",
  });

  checks.push({
    name: "Rejects invalid addresses",
    passed: invalidOk,
    detail: best
      ? `${best.invalid}/${EMAIL_INVALID.length} rejected — ${EMAIL_INVALID.join(", ")}`
      : "No pattern to test.",
  });

  const score = bestAccuracy < 0 ? 0 : Math.round(bestAccuracy * 100);

  return {
    score,
    checks,
    artifacts: {
      fixtureValid: EMAIL_VALID,
      fixtureInvalid: EMAIL_INVALID,
      bestPattern: best ? `/${best.source}/` : null,
      candidatePatterns: sources.map((s) => `/${s}/`),
    },
  };
}

/**
 * The argument is a fallacy of undistributed middle: the answer is "no".
 *
 * Naive substring matching scored a correct answer as wrong, because the
 * phrase "we can conclude that some roses fade quickly" appears in the model's
 * restatement of the question ("To determine whether we can conclude...").
 * An assertion is therefore only counted when it is not inside a negated or
 * interrogative frame.
 */
function scoreLogicalReasoning(text: string): ScoreResult {
  const lower = text.toLowerCase();
  const checks: CheckResult[] = [];

  const negationMarkers = [
    "cannot",
    "can not",
    "can't",
    "not necessarily",
    "does not follow",
    "doesn't follow",
    "invalid",
    "fallacy",
    "undistributed",
    "the answer is no",
    "answer is **no**",
    "no, we",
  ];
  const foundNegation = negationMarkers.filter((m) => lower.includes(m));

  // Phrases that would assert the invalid conclusion.
  const assertionPhrases = [
    "yes, we can",
    "yes we can",
    "we can conclude that some roses fade",
    "some roses fade quickly",
    "therefore, some roses fade",
    "thus, some roses fade",
  ];

  // A frame that negates or interrogates a phrase means it is not an assertion.
  const NEGATING_FRAME = [
    "whether",
    "cannot",
    "can not",
    "can't",
    "not ",
    "no,",
    "won't",
    "do not",
    "does not",
    "determine if",
    "check if",
    "question",
    "asked",
  ];

  const asserted: string[] = [];
  for (const phrase of assertionPhrases) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      // Look back far enough to cover a framing clause.
      const window = lower.slice(Math.max(0, idx - 90), idx);
      const framed = NEGATING_FRAME.some((f) => window.includes(f));
      if (!framed) asserted.push(phrase);
      idx = lower.indexOf(phrase, idx + 1);
    }
  }

  checks.push({
    name: "Concludes the argument is invalid",
    passed: foundNegation.length > 0,
    detail:
      foundNegation.length > 0
        ? `Negation markers present: ${foundNegation.join(", ")}`
        : "No negation/fallacy marker found — the answer key says this argument does not hold.",
  });

  checks.push({
    name: "Does not assert the invalid conclusion",
    passed: asserted.length === 0,
    detail:
      asserted.length === 0
        ? "No unnegated assertion of the invalid conclusion (phrases inside a 'whether…' frame are not counted)."
        : `Asserted the invalid conclusion via: ${[...new Set(asserted)].join(", ")}`,
  });

  const explains =
    lower.includes("some flowers") ||
    lower.includes("middle") ||
    lower.includes("distribut") ||
    lower.includes("subset") ||
    lower.includes("overlap");
  checks.push({
    name: "Explains the reasoning",
    passed: explains,
    detail: explains
      ? "References the shared middle term, the subset relationship, or the quantifier."
      : "Reasoning not articulated in recognisable terms.",
  });

  const passed = checks.filter((c) => c.passed).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
    artifacts: {
      answerKey:
        "No — 'some flowers fade quickly' does not imply those flowers are roses.",
      negationMarkersFound: foundNegation,
      unnegatedAssertionsFound: [...new Set(asserted)],
    },
  };
}

/** Canberra is the capital; Sydney is the common confusion. */
function scoreFactualAccuracy(text: string): ScoreResult {
  const lower = text.toLowerCase();
  const checks: CheckResult[] = [];

  const mentionsCanberra = lower.includes("canberra");
  checks.push({
    name: "States the correct capital (Canberra)",
    passed: mentionsCanberra,
    detail: mentionsCanberra
      ? "'Canberra' appears in the response."
      : "Answer key requires 'Canberra'.",
  });

  const mentionsConfusion =
    lower.includes("sydney") || lower.includes("melbourne");
  checks.push({
    name: "Addresses the common confusion",
    passed: mentionsConfusion,
    detail: mentionsConfusion
      ? "Explains the Sydney/Melbourne confusion as asked."
      : "Did not mention the commonly confused cities.",
  });

  const passed = checks.filter((c) => c.passed).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
    artifacts: {
      answerKey: "Canberra (not Sydney).",
      canberraFound: mentionsCanberra,
    },
  };
}

/**
 * Structural check for the instruction-following category.
 *
 * Items are located by their numbering markers anywhere in the text, not by
 * line breaks: models frequently emit "1. a 2. b 3. c" on a single line, and a
 * line-based parser scores that as one item — a false failure.
 */
function scoreInstructionFollowing(text: string): ScoreResult {
  const checks: CheckResult[] = [];

  // A marker is a digit 1-9 followed by "." or ")" and whitespace, at the
  // start of the text or preceded by whitespace/newline.
  const markerRe = /(?:^|[\s\n])([1-9])[.)]\s+/g;
  const markers: { num: number; start: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text)) !== null) {
    markers.push({
      num: Number(m[1]),
      start: m.index + (m[0].length - m[0].trimStart().length),
      contentStart: m.index + m[0].length,
    });
  }

  // Keep only the leading sequential run 1,2,3 — this avoids false positives
  // from numbers appearing mid-sentence (e.g. "2. " inside prose).
  const seq: typeof markers = [];
  let expected = 1;
  for (const marker of markers) {
    if (marker.num === expected) {
      seq.push(marker);
      expected++;
    }
  }

  const items = seq.map((marker, i) => {
    const end = i + 1 < seq.length ? seq[i + 1].start : text.length;
    return text.slice(marker.contentStart, end).trim();
  });

  const countOk = items.length === 3;
  checks.push({
    name: "Exactly three items",
    passed: countOk,
    detail: `Found ${items.length} item(s) with sequential numbering${
      items.length > 0 ? `: ${items.map((it, i) => `${i + 1}. ${it.slice(0, 60)}`).join(" | ")}` : ""
    } (items may be on one line; found by numbering, not line breaks)`,
  });

  checks.push({
    name: "Numbered 1, 2, 3 in order",
    passed: seq.length === 3 && seq.map((s) => s.num).join(",") === "1,2,3",
    detail:
      seq.length > 0
        ? `Sequential markers found: ${seq.map((s) => s.num).join(", ")}`
        : "No numbered markers found.",
  });

  const preamble = text.slice(0, seq[0]?.start ?? 0).trim();
  checks.push({
    name: "No preamble before item 1",
    passed: preamble.length === 0,
    detail:
      preamble.length === 0
        ? "Response opens directly with item 1."
        : `Opens with: "${preamble.slice(0, 80)}"`,
  });

  // A trailing conclusion would be absorbed into item 3's content in the
  // inline case. A generous word cap flags it; the real count is reported.
  const lastItem = items[items.length - 1] ?? "";
  const lastWords = lastItem.split(/\s+/).filter(Boolean).length;
  const lastItemOk = countOk && lastWords <= 40;
  checks.push({
    name: "Item 3 is a short phrase, not a trailing summary",
    passed: lastItemOk,
    detail: countOk
      ? `Item 3 is ${lastWords} word(s) — a benefit phrase, not a paragraph.`
      : "Not evaluated: item 3 could not be isolated.",
  });

  // Any line that carries neither a marker nor item content is added prose.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const strayLines = lines.filter((l) => !/(?:^|[\s])([1-9])[.)]\s+/.test(l));
  checks.push({
    name: "No added prose lines",
    passed: strayLines.length === 0,
    detail:
      strayLines.length === 0
        ? `All ${lines.length} line(s) carry numbered items.`
        : `${strayLines.length} extra line(s): ${strayLines
            .map((s) => `"${s.slice(0, 40)}"`)
            .join(", ")}`,
  });

  const passed = checks.filter((c) => c.passed).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
    artifacts: {
      parsedItems: items,
      itemWordCounts: items.map((it) => it.split(/\s+/).filter(Boolean).length),
      lineCount: lines.length,
      preamble: preamble || "(none)",
    },
  };
}

/* ------------------------------------------------------------------ */
/* Test suite                                                          */
/* ------------------------------------------------------------------ */

export interface TestCategory {
  id: string;
  name: string;
  prompt: string;
  threshold: number;
  /** How this category is verified, shown in the UI. */
  method: string;
  score: (response: string) => ScoreResult;
}

export const TEST_SUITE: TestCategory[] = [
  {
    id: "code_generation",
    name: "Code Generation",
    prompt:
      "Write a Python function that validates an email address using regex. Include error handling and type hints. Return your final regex pattern on its own line as a /pattern/ literal.",
    // 85, not 70: partial fixture accuracy is not a correct validator. A
    // pattern accepting "missing@tld" or "@nolocal.com" scores 5/7 (71%) and
    // must not clear the bar.
    threshold: 85,
    method:
      "Extracts the regex from the response and runs it against a fixed fixture set of 3 valid and 4 invalid addresses. Score is fixture accuracy.",
    score: scoreCodeGeneration,
  },
  {
    id: "logical_reasoning",
    name: "Logical Reasoning",
    prompt:
      "If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly? Explain your reasoning step by step.",
    threshold: 75,
    method:
      "Checks for a negation or fallacy marker, the absence of the invalid conclusion, and whether the reasoning references the shared middle term.",
    score: scoreLogicalReasoning,
  },
  {
    id: "factual_accuracy",
    name: "Factual Accuracy",
    prompt:
      "What is the capital of Australia? Provide your answer and explain why this is often confused.",
    threshold: 90,
    method:
      "Checks for the answer key 'Canberra' and whether the commonly confused cities are addressed.",
    score: scoreFactualAccuracy,
  },
  {
    id: "instruction_following",
    name: "Instruction Following",
    prompt:
      "List exactly 3 benefits of exercise. Format as: 1. [benefit] 2. [benefit] 3. [benefit]. Do not add introduction or conclusion.",
    threshold: 85,
    method:
      "Structural parse: exactly three numbered items, correct numbering, no preamble, no conclusion, no stray prose.",
    score: scoreInstructionFollowing,
  },
];

/* ------------------------------------------------------------------ */
/* Provider call                                                       */
/* ------------------------------------------------------------------ */

export interface CallResult {
  text: string | null;
  meta: CallMetadata;
  error: string | null;
}

function resolveKey(config: ProviderConfig): string | null {
  for (const env of config.keyEnv) {
    const value = process.env[env];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

export async function callProvider(opts: {
  provider: ProviderId;
  model: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<CallResult> {
  const config = PROVIDERS[opts.provider];
  const apiKey = resolveKey(config);
  const started = Date.now();

  const baseMeta: CallMetadata = {
    provider: opts.provider,
    modelRequested: opts.model,
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
  };

  if (!apiKey) {
    return {
      text: null,
      meta: { ...baseMeta, wallClockMs: Date.now() - started },
      error: `No API key found for ${config.name}. Set one of: ${config.keyEnv.join(", ")}.`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Required: the provider's edge blocks default server UAs.
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "user", content: opts.prompt }],
        max_tokens: opts.maxTokens ?? 1200,
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    const wallClockMs = Date.now() - started;

    if (!res.ok) {
      return {
        text: null,
        meta: { ...baseMeta, wallClockMs },
        error: `HTTP ${res.status} from ${config.name}: ${raw.slice(0, 400)}`,
      };
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      return {
        text: null,
        meta: { ...baseMeta, wallClockMs },
        error: `Non-JSON response from ${config.name}: ${raw.slice(0, 300)}`,
      };
    }

    const text: string | null = json?.choices?.[0]?.message?.content ?? null;
    const usage = json?.usage ?? {};
    const billing = json?.aria_billing ?? {};

    return {
      text,
      meta: {
        ...baseMeta,
        modelServed: json?.model ?? null,
        route: json?.routing?.serving_pipereplica ?? billing?.route ?? null,
        requestId:
          json?.id ?? billing?.request_id ?? null,
        systemFingerprint: json?.system_fingerprint ?? null,
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        chargedAmount: billing?.charged_amount ?? null,
        latency: usage?.latency_checkpoint ?? null,
        wallClockMs,
      },
      error: text ? null : "Provider returned an empty completion.",
    };
  } catch (err) {
    const wallClockMs = Date.now() - started;
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Request timed out after ${(opts.timeoutMs ?? 60_000) / 1000}s.`
          : err.message
        : String(err);
    return {
      text: null,
      meta: { ...baseMeta, wallClockMs },
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Run one test end to end and return the full record. */
export async function runTest(opts: {
  categoryId: string;
  model: string;
  provider: ProviderId;
}): Promise<TestRun> {
  const category =
    TEST_SUITE.find((c) => c.id === opts.categoryId) ?? TEST_SUITE[0];

  const call = await callProvider({
    provider: opts.provider,
    model: opts.model,
    prompt: category.prompt,
  });

  const id = `t_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  if (!call.text) {
    return {
      id,
      timestamp: new Date().toISOString(),
      categoryId: category.id,
      categoryName: category.name,
      model: opts.model,
      provider: opts.provider,
      prompt: category.prompt,
      response: null,
      score: 0,
      passedThreshold: false,
      threshold: category.threshold,
      checks: [
        {
          name: "Provider call succeeded",
          passed: false,
          detail: call.error ?? "Unknown provider error.",
        },
      ],
      artifacts: {},
      meta: call.meta,
      error: call.error ?? "Unknown provider error.",
    };
  }

  const scored = category.score(call.text);

  return {
    id,
    timestamp: new Date().toISOString(),
    categoryId: category.id,
    categoryName: category.name,
    model: opts.model,
    provider: opts.provider,
    prompt: category.prompt,
    response: call.text,
    score: scored.score,
    passedThreshold: scored.score >= category.threshold,
    threshold: category.threshold,
    checks: scored.checks,
    artifacts: scored.artifacts,
    meta: call.meta,
    error: null,
  };
}
