import type { ResumeBlueprint } from "@/lib/resume-blueprint";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 54;
const TOP = 742;
const LINE_HEIGHT = 13;

export function renderResumePdf(blueprint: ResumeBlueprint) {
  const lines = blueprintToLines(blueprint);
  const pages = paginate(lines, 52);
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    const stream = pageToStream(pageLines);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });

  return buildPdf(objects);
}

function blueprintToLines(blueprint: ResumeBlueprint) {
  const lines: PdfLine[] = [
    { text: blueprint.header.fullName, size: 18, bold: true },
    {
      text: [
        blueprint.header.phone,
        blueprint.header.email,
        blueprint.header.linkedinUrl,
        blueprint.header.githubUrl,
        blueprint.header.portfolioUrl,
      ]
        .filter(Boolean)
        .join(" | "),
      size: 9,
    },
    blank(),
    heading("EDUCATION"),
    ...blueprint.education.flatMap((entry) => [
      { text: `${entry.institution} | ${entry.location}`, bold: true },
      { text: `${entry.credential} | ${entry.scoreLine} | ${entry.dateRange}`, size: 9 },
    ]),
    blank(),
    heading("TECHNICAL SKILLS"),
    ...blueprint.skillCategories.map((category) => ({
      text: `${category.label}: ${category.items.join(", ")}`,
      size: 9,
    })),
    blank(),
    heading("EXPERIENCE"),
    ...blueprint.experience.flatMap((entry) => [
      { text: `${entry.company} | ${entry.title} | ${entry.dateRange}`, bold: true },
      ...entry.bullets.map((bullet) => ({ text: `- ${bullet}`, size: 9 })),
      entry.techStack.length
        ? { text: `Tech Stack: ${entry.techStack.join(", ")}`, size: 9 }
        : blank(4),
    ]),
    blank(),
    heading("PROJECTS"),
    ...blueprint.projects.flatMap((entry) => [
      { text: `${entry.name} | ${entry.techStack.join(", ")}`, bold: true },
      ...entry.bullets.map((bullet) => ({ text: `- ${bullet}`, size: 9 })),
    ]),
    blank(),
    heading("LEADERSHIP & ENGAGEMENT"),
    ...blueprint.leadership.map((entry) => ({
      text: `${entry.label}: ${entry.description}`,
      size: 9,
    })),
    blank(),
    heading("CERTIFICATIONS"),
    ...blueprint.certifications.map((entry) => ({
      text: `${entry.name} -- ${entry.issuer}`,
      size: 9,
    })),
  ];

  return lines.flatMap(wrapLine);
}

function pageToStream(lines: PdfLine[]) {
  const commands = ["BT"];
  let y = TOP;

  for (const line of lines) {
    if (!line.text) {
      y -= line.gap ?? LINE_HEIGHT;
      continue;
    }

    const font = line.bold ? "F2" : "F1";
    const size = line.size ?? 10;
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${LEFT} ${y} Td (${escapePdfText(line.text)}) Tj`);
    commands.push(`${-LEFT} ${-y} Td`);
    y -= line.gap ?? LINE_HEIGHT;
  }

  commands.push("ET");
  return commands.join("\n");
}

function buildPdf(objects: string[]) {
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return Buffer.from(chunks.join(""), "utf8");
}

function paginate(lines: PdfLine[], maxLines: number) {
  const pages: PdfLine[][] = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines));
  }
  return pages.length ? pages : [[{ text: "Generated resume", size: 12 }]];
}

function wrapLine(line: PdfLine) {
  if (!line.text || line.text.length <= 92) {
    return [line];
  }

  const words = line.text.split(/\s+/);
  const wrapped: PdfLine[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > 92) {
      wrapped.push({ ...line, text: current });
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) {
    wrapped.push({ ...line, text: current });
  }

  return wrapped;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function heading(text: string): PdfLine {
  return { text, bold: true, size: 11, gap: 15 };
}

function blank(gap = LINE_HEIGHT): PdfLine {
  return { text: "", gap };
}

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
};
