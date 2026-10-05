import { NextRequest, NextResponse } from "next/server";
import {
  runTest,
  TEST_SUITE,
  MODEL_CATALOGUE,
  PROVIDERS,
  type ProviderId,
} from "@/app/lib/quality";

// The provider key must never reach the client bundle, so every call is
// proxied through this route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS = Object.keys(PROVIDERS) as ProviderId[];

export async function GET() {
  // Lets the UI render the suite and catalogue from one source of truth.
  return NextResponse.json({
    categories: TEST_SUITE.map(({ id, name, prompt, threshold, method }) => ({
      id,
      name,
      prompt,
      threshold,
      method,
    })),
    models: MODEL_CATALOGUE,
    providers: VALID_PROVIDERS.map((id) => ({
      id,
      name: PROVIDERS[id].name,
      configured: PROVIDERS[id].keyEnv.some(
        (env) => (process.env[env] ?? "").trim().length > 0
      ),
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: { categoryId?: string; model?: string; provider?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const categoryId = body.categoryId;
  const model = body.model;
  const provider = (body.provider ?? "entelic") as ProviderId;

  if (!categoryId || !TEST_SUITE.some((c) => c.id === categoryId)) {
    return NextResponse.json(
      { error: `Unknown categoryId. Expected one of: ${TEST_SUITE.map((c) => c.id).join(", ")}` },
      { status: 400 }
    );
  }

  if (!model || !MODEL_CATALOGUE.some((m) => m.id === model)) {
    return NextResponse.json(
      { error: "Unknown model. Pick one from the catalogue returned by GET." },
      { status: 400 }
    );
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Unknown provider. Expected one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  const result = await runTest({ categoryId, model, provider });

  return NextResponse.json(result);
}
