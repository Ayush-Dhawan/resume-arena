import { NextResponse } from "next/server";
import { parseResumeFile } from "@/lib/resume-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const resume = formData.get("resume");

    if (!(resume instanceof File)) {
      return NextResponse.json(
        { error: "Attach a resume file using the `resume` field." },
        { status: 400 },
      );
    }

    const parsedResume = await parseResumeFile(resume);

    return NextResponse.json({
      parsedResume,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse resume.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}
