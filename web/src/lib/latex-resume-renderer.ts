import fs from "node:fs/promises";

import type { ResumeBlueprint } from "@/lib/resume-blueprint";

export async function renderResumeLatex({
  templatePath,
  blueprint,
}: {
  templatePath: string;
  blueprint: ResumeBlueprint;
}) {
  const template = await fs.readFile(templatePath, "utf8");
  const preamble = template.split("\\begin{document}", 1)[0].trimEnd();

  return `${preamble}

\\begin{document}

${renderHeading(blueprint)}

${renderEducation(blueprint)}

${renderSkills(blueprint)}

${renderExperience(blueprint)}

${renderProjects(blueprint)}

${renderLeadership(blueprint)}

${renderCertifications(blueprint)}

\\end{document}
`;
}

function renderHeading(blueprint: ResumeBlueprint) {
  const { header } = blueprint;
  const links = [
    header.phone
      ? `\\href{tel:${escapeUrl(header.phone)}}{\\faPhone\\ \\underline{${escapeLatex(header.phone)}}}`
      : "",
    header.email
      ? `\\href{mailto:${escapeUrl(header.email)}}{\\faEnvelope\\ \\underline{${escapeLatex(header.email)}}}`
      : "",
    header.linkedinUrl
      ? `\\href{${escapeUrl(header.linkedinUrl)}}{\\faLinkedin\\ \\underline{LinkedIn}}`
      : "",
    header.githubUrl
      ? `\\href{${escapeUrl(header.githubUrl)}}{\\faGithub\\ \\underline{GitHub}}`
      : "",
    header.portfolioUrl
      ? `\\href{${escapeUrl(header.portfolioUrl)}}{\\faGlobe\\ \\underline{Portfolio Website}}`
      : "",
  ].filter(Boolean);

  return `%----------HEADING----------
\\begin{center}
    {\\Huge \\scshape ${escapeLatex(header.fullName)}} \\\\ \\vspace{2pt}
    \\small
    ${links.join(" ~|~\n    ")}
    \\vspace{-10pt}
\\end{center}`;
}

function renderEducation(blueprint: ResumeBlueprint) {
  const entries = blueprint.education.length
    ? blueprint.education
    : [
        {
          institution: "[University/College Name]",
          location: "[City, Country]",
          credential: "[Degree Name]",
          scoreLine: "[CGPA / Aggregate]",
          dateRange: "[Start Year] -- [End Year]",
        },
      ];

  return `%-----------EDUCATION-----------
\\section{EDUCATION}
  \\resumeSubHeadingListStart
${entries
  .slice(0, 2)
  .map(
    (entry) => `    \\item \\textbf{${escapeLatex(entry.institution)}} \\hfill ${escapeLatex(entry.location)} \\\\
    \\textit{${escapeLatex(entry.credential)}} -- \\textbf{${escapeLatex(entry.scoreLine)}} \\hfill \\textit{${escapeLatex(entry.dateRange)}}
    \\vspace{-6pt}`,
  )
  .join("\n\n")}
  \\resumeSubHeadingListEnd
  \\vspace{-6pt}`;
}

function renderSkills(blueprint: ResumeBlueprint) {
  const categories = blueprint.skillCategories.length
    ? blueprint.skillCategories
    : [{ label: "Languages", items: ["[Language 1]", "[Language 2]"] }];

  return `%-----------TECHNICAL SKILLS-----------
\\section{TECHNICAL SKILLS}
 \\begin{itemize}[leftmargin=0.0in, label={}]
    \\small{\\item{
${categories
  .slice(0, 4)
  .map(
    (category) =>
      `     \\textbf{${escapeLatex(category.label)}:}{ ${category.items.map(escapeLatex).join(", ") || "[Add items]"} } \\\\`,
  )
  .join("\n")}
    }}
 \\end{itemize}
 \\vspace{-12pt}`;
}

function renderExperience(blueprint: ResumeBlueprint) {
  const entries = blueprint.experience.length
    ? blueprint.experience
    : [
        {
          company: "[Company Name]",
          dateRange: "[Month, Year] -- [Month, Year]",
          title: "[Job Title]",
          location: "[City, Country]",
          bullets: ["Add impact-focused bullet here."],
          techStack: [],
        },
      ];

  return `%-----------EXPERIENCE-----------
\\section{EXPERIENCE}
\\resumeSubHeadingListStart

${entries
  .slice(0, 3)
  .map(
    (entry) => `  \\resumeSubheading
    {${escapeLatex(entry.company)}}{${escapeLatex(entry.dateRange)}}
    {${escapeLatex(entry.title)}}{${escapeLatex(entry.location)}}
    \\resumeItemListStart
${entry.bullets
  .slice(0, 4)
  .map((bullet) => `      \\resumeItem{${escapeLatex(bullet)}}`)
  .join("\n")}
${entry.techStack.length ? `      \\resumeItem{\\textbf{Tech Stack}: ${entry.techStack.map(escapeLatex).join(", ")}.}` : ""}
    \\resumeItemListEnd`,
  )
  .join("\n\n")}

\\resumeSubHeadingListEnd
\\vspace{-8pt}`;
}

function renderProjects(blueprint: ResumeBlueprint) {
  const entries = blueprint.projects.length
    ? blueprint.projects
    : [{ name: "[Project Name]", techStack: ["[Tech Stack]"], bullets: ["Add project bullet here."] }];

  return `%-----------PROJECTS-----------
\\section{PROJECTS}
    \\resumeSubHeadingListStart

${entries
  .slice(0, 3)
  .map(
    (entry) => `      \\resumeProjectHeading
        {${escapeLatex(entry.name)}}{\\textit{${entry.techStack.map(escapeLatex).join(", ") || "[Tech Stack]"}}}
        \\resumeItemListStart
${entry.bullets
  .slice(0, 3)
  .map((bullet) => `          \\resumeItem{${escapeLatex(bullet)}}`)
  .join("\n")}
        \\resumeItemListEnd`,
  )
  .join("\n\n")}

\\resumeSubHeadingListEnd
\\vspace{-8pt}`;
}

function renderLeadership(blueprint: ResumeBlueprint) {
  const entries = blueprint.leadership.length
    ? blueprint.leadership
    : [{ label: "[Leadership Item]", description: "Add leadership evidence here." }];

  return `%-----------LEADERSHIP & ENGAGEMENT-----------
\\section{LEADERSHIP \\& ENGAGEMENT}
 \\begin{itemize}[leftmargin=0.15in, label={\\tiny$\\bullet$}]
${entries
  .slice(0, 4)
  .map((entry) => `    \\resumeItem{\\textbf{${escapeLatex(entry.label)}:} ${escapeLatex(entry.description)}}`)
  .join("\n")}
 \\end{itemize}
 \\vspace{-10pt}`;
}

function renderCertifications(blueprint: ResumeBlueprint) {
  const entries = blueprint.certifications.length
    ? blueprint.certifications
    : [{ name: "[Certification Name]", issuer: "[Issuing Organization]" }];

  return `%-----------CERTIFICATIONS---------------
\\section{CERTIFICATIONS}
\\small{
${entries
  .slice(0, 4)
  .map(
    (entry) =>
      `$\\sbullet[.75] \\hspace{0.1cm}$ ${escapeLatex(entry.name)} -- ${escapeLatex(entry.issuer)}`,
  )
  .join(" \\hspace{1cm}\n")}
}`;
}

function escapeLatex(value = "") {
  return value.replace(/[\\&%$#_{}~^]/g, (char) => {
    const replacements: Record<string, string> = {
      "\\": "\\textbackslash{}",
      "&": "\\&",
      "%": "\\%",
      "$": "\\$",
      "#": "\\#",
      "_": "\\_",
      "{": "\\{",
      "}": "\\}",
      "~": "\\textasciitilde{}",
      "^": "\\textasciicircum{}",
    };

    return replacements[char] ?? char;
  });
}

function escapeUrl(value = "") {
  return value.replace(/\s/g, "%20");
}
