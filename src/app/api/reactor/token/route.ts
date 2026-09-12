import { NextResponse } from "next/server";
import { ReactorModelSchema, tokenRequestBody } from "@/world/reactor-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const model = ReactorModelSchema.safeParse(new URL(request.url).searchParams.get("model") ?? "reactor/lingbot-world-2");
  if (!model.success) return NextResponse.json({ error: "Unsupported world model" }, { status: 400 });
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REACTOR_API_KEY is not configured on the server (.env.local)" },
      { status: 503 },
    );
  }
  const upstream = await fetch("https://api.reactor.inc/tokens", {
    method: "POST",
    headers: { "Reactor-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(tokenRequestBody(model.data)),
    cache: "no-store",
  });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Reactor token request failed (${upstream.status})` },
      { status: upstream.status },
    );
  }
  const body: { jwt?: string; token?: string; expires_at?: string | number } = await upstream
    .json()
    .catch(() => ({}));
  const jwt = body.jwt ?? body.token;
  if (typeof jwt !== "string" || jwt.length === 0) {
    return NextResponse.json({ error: "Reactor token response missing jwt" }, { status: 502 });
  }
  return NextResponse.json(
    { jwt, expires_at: body.expires_at ?? null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
