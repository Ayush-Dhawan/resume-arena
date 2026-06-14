import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { buildDummyAgentResumeOutput } from "@/lib/resume-blueprint";
import { renderResumeLatex } from "@/lib/latex-resume-renderer";
import { parseResumeFile } from "@/lib/resume-parser";
import { renderResumePdf } from "@/lib/simple-pdf";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/resume/generate",
    contentType: "multipart/form-data",
    fields: {
      resume: "File upload field. Supports PDF, DOCX, TEX, TXT, MD, and RTF.",
      targetRole: "Optional text field, for example Backend Intern.",
      targetCompany: "Optional text field, for example Acme.",
    },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const resume = formData.get("resume");

    if (!(resume instanceof File)) {
      return NextResponse.json(
        { error: "Attach a PDF, DOCX, or supported resume file using the `resume` field." },
        { status: 400 },
      );
    }

    const targetRole = stringField(formData.get("targetRole"));
    const targetCompany = stringField(formData.get("targetCompany"));
    const parsedResume = await parseResumeFile(resume);
    const resourcesDir = await findResourcesDir();
    const runId = `${Date.now()}-${slugify(resume.name)}`;

    const extractedTextPath = path.join(resourcesDir, `${runId}.extracted.txt`);
    await fs.writeFile(extractedTextPath, parsedResume.text, "utf8");

    const dummyAgentOutput = buildDummyAgentResumeOutput({
      parsedResume,
      targetRole,
      targetCompany,
    });
    const dummyJsonPath = path.join(resourcesDir, `${runId}.dummy-agent-output.json`);
    await fs.writeFile(dummyJsonPath, JSON.stringify(dummyAgentOutput, null, 2), "utf8");

    const templatePath = path.join(resourcesDir, "sample_resume_template.tex");
    const latexSource = await renderResumeLatex({
      templatePath,
      blueprint: dummyAgentOutput.blueprint,
    });
    const latexOutputPath = path.join(resourcesDir, `${runId}.generated.tex`);
    await fs.writeFile(latexOutputPath, latexSource, "utf8");

    const pdf = renderResumePdf(dummyAgentOutput.blueprint);
    const pdfFileName = `${runId}.generated.pdf`;
    const pdfOutputPath = path.join(resourcesDir, pdfFileName);
    await fs.writeFile(pdfOutputPath, pdf);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName}"`,
        "X-Extracted-Text-Path": extractedTextPath,
        "X-Dummy-Agent-Json-Path": dummyJsonPath,
        "X-Generated-Latex-Path": latexOutputPath,
        "X-Generated-Pdf-Path": pdfOutputPath,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate resume PDF.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}

async function findResourcesDir() {
  const candidates = [
    path.resolve(process.cwd(), "..", "resume_roast_arena", "resources"),
    path.resolve(process.cwd(), "resume_roast_arena", "resources"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "sample_resume_template.tex"));
      return candidate;
    } catch {
      // Try the next candidate because Next can be launched from repo root or web/.
    }
  }

  throw new Error("Could not locate resume_roast_arena/resources/sample_resume_template.tex.");
}

function stringField(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "resume"
  );
}
