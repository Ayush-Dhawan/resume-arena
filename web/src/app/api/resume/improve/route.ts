import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { renderResumeLatex } from "@/lib/latex-resume-renderer";
import { buildDummyAgentResumeOutput, type ResumeBlueprint } from "@/lib/resume-blueprint";
import { renderResumePdf } from "@/lib/simple-pdf";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

type ParsedResumePayload = Parameters<typeof buildDummyAgentResumeOutput>[0]["parsedResume"];

type ResumeEditChangePayload = {
  id: string;
  title: string;
  source: string;
  after: string;
  answer?: string;
  status: "needs_input" | "ready" | "applied";
};

type ImproveResumePayload = {
  parsedResume?: ParsedResumePayload;
  targetRole?: string;
  targetCompany?: string;
  editChanges?: ResumeEditChangePayload[];
  metricAnswers?: Record<string, string>;
  draft?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ImproveResumePayload;

    if (!payload.parsedResume?.text) {
      return NextResponse.json(
        { error: "Missing parsedResume. Upload and parse a resume before generating." },
        { status: 400 },
      );
    }

    const resourcesDir = await findResourcesDir();
    const runId = `${Date.now()}-${slugify(payload.parsedResume.fileName || "resume")}-improved`;
    const dummyAgentOutput = buildDummyAgentResumeOutput({
      parsedResume: payload.parsedResume,
      targetRole: payload.targetRole?.trim() ?? "",
      targetCompany: payload.targetCompany?.trim() ?? "",
    });
    const blueprint = applyVerifiedEdits({
      blueprint: dummyAgentOutput.blueprint,
      editChanges: payload.editChanges ?? [],
      metricAnswers: payload.metricAnswers ?? {},
    });

    const dummyJsonPath = path.join(resourcesDir, `${runId}.resume-edit-agent-output.json`);
    await fs.writeFile(
      dummyJsonPath,
      JSON.stringify(
        {
          source: "resume-edit-agent-dummy-json",
          note: "Replace editChanges and metricAnswers with real council output when agent integration is ready.",
          targetRole: payload.targetRole,
          targetCompany: payload.targetCompany,
          metricAnswers: payload.metricAnswers ?? {},
          editChanges: payload.editChanges ?? [],
          draft: payload.draft ?? "",
          blueprint,
        },
        null,
        2,
      ),
      "utf8",
    );

    const templatePath = path.join(resourcesDir, "sample_resume_template.tex");
    const latexSource = await renderResumeLatex({ templatePath, blueprint });
    const latexOutputPath = path.join(resourcesDir, `${runId}.generated.tex`);
    await fs.writeFile(latexOutputPath, latexSource, "utf8");

    const compiledPdf = await compileLatexPdf(latexOutputPath, resourcesDir);
    const pdf = compiledPdf.pdf ?? renderResumePdf(blueprint);
    const pdfFileName = `${runId}.pdf`;
    const pdfOutputPath = path.join(resourcesDir, pdfFileName);
    await fs.writeFile(pdfOutputPath, pdf);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName}"`,
        "X-Dummy-Agent-Json-Path": dummyJsonPath,
        "X-Generated-Latex-Path": latexOutputPath,
        "X-Generated-Pdf-Path": pdfOutputPath,
        "X-Pdf-Renderer": compiledPdf.pdf ? compiledPdf.engine : "simple-fallback",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate improved resume PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function applyVerifiedEdits({
  blueprint,
  editChanges,
  metricAnswers,
}: {
  blueprint: ResumeBlueprint;
  editChanges: ResumeEditChangePayload[];
  metricAnswers: Record<string, string>;
}) {
  const verifiedBullets = editChanges
    .filter((change) => change.status === "ready" || change.status === "applied")
    .map((change) => {
      const proof = metricAnswers[change.id] || change.answer;
      return cleanBullet(refineConservativeBullet(change.after, proof));
    })
    .filter(Boolean)
    .slice(0, 3);

  if (!verifiedBullets.length) {
    return blueprint;
  }

  return {
    ...blueprint,
    experience: blueprint.experience.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            bullets: mergeBullets(entry.bullets, verifiedBullets).slice(0, 4),
          }
        : entry,
    ),
  };
}

async function compileLatexPdf(latexPath: string, outputDir: string) {
  for (const engine of ["pdflatex", "xelatex"]) {
    try {
      await execFileAsync(
        engine,
        ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", outputDir, latexPath],
        {
          cwd: outputDir,
          timeout: 30000,
          windowsHide: true,
        },
      );
      const pdfPath = latexPath.replace(/\.tex$/i, ".pdf");
      return {
        engine,
        pdf: await fs.readFile(pdfPath),
      };
    } catch {
      // Try the next compiler; fall back to the simple renderer if none are installed.
    }
  }

  return {
    engine: "simple-fallback",
    pdf: null,
  };
}

function mergeBullets(originalBullets: string[], improvedBullets: string[]) {
  const merged = [...originalBullets];

  improvedBullets.forEach((bullet, index) => {
    if (index < merged.length) {
      merged[index] = bullet;
    } else {
      merged.push(bullet);
    }
  });

  return merged;
}

function refineConservativeBullet(after: string, proof?: string) {
  const base = after
    .replace(/\s*Proof:\s*.+$/i, "")
    .replace(/\s*,?\s*backed by:\s*/i, " with verified evidence: ")
    .replace(/^Add\s+/i, "Improved ")
    .replace(/^Rewrite\s+/i, "Refined ")
    .replace(/\s+/g, " ")
    .trim();

  if (!proof) {
    return base;
  }

  const cleanProof = proof.replace(/\s+/g, " ").trim();
  return `${base.replace(/\.$/, "")}, using verified result: ${cleanProof}`;
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
      // Next can run from repo root or web/, so try both.
    }
  }

  throw new Error("Could not locate resume_roast_arena/resources/sample_resume_template.tex.");
}

function cleanBullet(value: string) {
  const cleaned = value.replace(/\s+/g, " ").replace(/^[-*]\s*/, "").trim();
  return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
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
