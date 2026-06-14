import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type ResumeSection = {
  title: string;
  content: string;
};

export type ParsedResume = {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  sections: ResumeSection[];
  contact: {
    email?: string;
    phone?: string;
    links: string[];
  };
  stats: {
    wordCount: number;
    lineCount: number;
    sectionCount: number;
  };
  warnings: string[];
  parser: {
    source: "pdf" | "docx" | "latex" | "plain-text";
    confidence: "high" | "medium" | "low";
  };
};

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "tex", "txt", "md", "rtf"]);

const SECTION_ALIASES = new Map<string, string>([
  ["summary", "Summary"],
  ["profile", "Summary"],
  ["objective", "Summary"],
  ["experience", "Experience"],
  ["work experience", "Experience"],
  ["professional experience", "Experience"],
  ["employment", "Experience"],
  ["projects", "Projects"],
  ["project experience", "Projects"],
  ["skills", "Skills"],
  ["technical skills", "Skills"],
  ["education", "Education"],
  ["certifications", "Certifications"],
  ["certificates", "Certifications"],
  ["awards", "Awards"],
  ["achievements", "Achievements"],
  ["publications", "Publications"],
  ["volunteering", "Volunteering"],
  ["leadership", "Leadership"],
]);

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  if (!file.size) {
    throw new Error("Upload a non-empty resume file.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Resume must be 8 MB or smaller for the arena parser.");
  }

  const extension = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(
      "Unsupported resume format. Upload a PDF, DOCX, LaTeX, TXT, Markdown, or RTF file.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractText(buffer, extension);
  const text = normalizeText(extracted.text);

  if (text.length < 80) {
    extracted.warnings.push(
      "Very little text was extracted. This may be a scanned resume or image-heavy template.",
    );
  }

  const sections = detectSections(text);
  const warnings = [...extracted.warnings, ...buildQualityWarnings(text, sections)];

  return {
    fileName: file.name,
    fileType: file.type || extension,
    fileSize: file.size,
    text,
    sections,
    contact: extractContact(text),
    stats: {
      wordCount: countWords(text),
      lineCount: text.split("\n").filter(Boolean).length,
      sectionCount: sections.length,
    },
    warnings,
    parser: {
      source: extracted.source,
      confidence: getConfidence(text, sections, warnings),
    },
  };
}

async function extractText(
  buffer: Buffer,
  extension: string,
): Promise<{
  text: string;
  source: ParsedResume["parser"]["source"];
  warnings: string[];
}> {
  if (extension === "pdf") {
    PDFParse.setWorker(getPdfWorkerUrl());
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return {
        text: result.text,
        source: "pdf",
        warnings: [],
      };
    } finally {
      await parser.destroy();
    }
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      source: "docx",
      warnings: result.messages.map((message) => message.message),
    };
  }

  const text = buffer.toString("utf8");
  return {
    text: extension === "tex" ? stripLatex(text) : stripRtf(text),
    source: extension === "tex" ? "latex" : "plain-text",
    warnings: [],
  };
}

function getPdfWorkerUrl() {
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "worker",
    "pdf.worker.mjs",
  );

  return pathToFileURL(workerPath).href;
}

function detectSections(text: string): ResumeSection[] {
  const lines = text.split("\n");
  const sections: ResumeSection[] = [];
  let currentTitle = "Header";
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = normalizeHeading(line);

    if (heading) {
      pushSection(sections, currentTitle, currentLines);
      currentTitle = heading;
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  pushSection(sections, currentTitle, currentLines);

  return sections.filter((section) => section.content.trim().length > 0);
}

function normalizeHeading(line: string): string | null {
  const cleaned = line
    .replace(/[:|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length > 42) {
    return null;
  }

  const key = cleaned.toLowerCase();
  if (SECTION_ALIASES.has(key)) {
    return SECTION_ALIASES.get(key) ?? cleaned;
  }

  if (/^[A-Z][A-Z\s/&-]{2,}$/.test(cleaned)) {
    return titleCase(cleaned);
  }

  return null;
}

function pushSection(sections: ResumeSection[], title: string, lines: string[]) {
  const content = lines.join("\n").trim();
  if (!content) {
    return;
  }

  sections.push({
    title,
    content,
  });
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripLatex(text: string) {
  return text
    .replace(/%.*$/gm, "")
    .replace(/\\(section|subsection|subsubsection)\*?\{([^}]+)\}/gi, "\n$2\n")
    .replace(/\\(textbf|textit|emph|href)\{([^}]+)\}/gi, "$2")
    .replace(/\\href\{([^}]+)\}\{([^}]+)\}/gi, "$2 $1")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*])?(?:\{[^}]*})?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\\\\/g, "\n");
}

function stripRtf(text: string) {
  return text
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ");
}

function extractContact(text: string): ParsedResume["contact"] {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(?:\+?\d[\s().-]?){8,}\d/)?.[0]?.trim();
  const links = Array.from(
    new Set(text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|[\w-]+\.\w{2,})(?:\/[^\s]*)?/gi) ?? []),
  ).slice(0, 8);

  return {
    email,
    phone,
    links,
  };
}

function buildQualityWarnings(text: string, sections: ResumeSection[]) {
  const warnings: string[] = [];
  const titles = new Set(sections.map((section) => section.title));

  if (!titles.has("Experience") && !titles.has("Projects")) {
    warnings.push("No clear Experience or Projects section was detected.");
  }

  if (!titles.has("Skills")) {
    warnings.push("No clear Skills section was detected.");
  }

  if (!/\d/.test(text)) {
    warnings.push("No numbers were detected. Agents may flag missing measurable impact.");
  }

  return warnings;
}

function getConfidence(
  text: string,
  sections: ResumeSection[],
  warnings: string[],
): ParsedResume["parser"]["confidence"] {
  if (text.length > 600 && sections.length >= 3 && warnings.length <= 1) {
    return "high";
  }

  if (text.length > 250 && sections.length >= 2) {
    return "medium";
  }

  return "low";
}

function countWords(text: string) {
  return text.match(/\b[\w'-]+\b/g)?.length ?? 0;
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
