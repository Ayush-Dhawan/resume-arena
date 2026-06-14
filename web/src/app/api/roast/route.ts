import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

type RoastRequest = {
  resumeText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  preferredTone?: string;
  mode?: "bts" | "combat";
  agentIds?: string[];
};

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);

  try {
    const body = (await request.json()) as RoastRequest;

    if (!body.resumeText?.trim()) {
      return NextResponse.json({ error: "Upload and parse a resume before starting a roast." }, { status: 400 });
    }

    const backendUrl = process.env.RESUME_ARENA_BACKEND_URL ?? "http://127.0.0.1:8001";
    console.info(
      `[roast:${requestId}] Proxying roast request to ${backendUrl}/roast role="${body.targetRole ?? ""}" agents=${body.agentIds?.join(",") ?? "default"} resumeChars=${body.resumeText.length}`,
    );
    const response = await fetch(`${backendUrl}/roast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      console.error(`[roast:${requestId}] Backend returned ${response.status}: ${getBackendError(payload)}`);
      return NextResponse.json(
        { error: getBackendError(payload) || "The roast agents could not complete the review." },
        { status: response.status },
      );
    }

    console.info(`[roast:${requestId}] Roast proxy completed successfully.`);
    return NextResponse.json({ result: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run the roast arena.";
    console.error(`[roast:${requestId}] Roast proxy failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getBackendError(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }

  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    return typeof error === "string" ? error : JSON.stringify(error);
  }

  return "";
}
