import type { ParsedResume } from "@/lib/resume-parser";

export type ResumeBlueprint = {
  header: {
    fullName: string;
    phone?: string;
    email?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };
  education: {
    institution: string;
    location: string;
    credential: string;
    scoreLine: string;
    dateRange: string;
  }[];
  skillCategories: {
    label: string;
    items: string[];
  }[];
  experience: {
    company: string;
    dateRange: string;
    title: string;
    location: string;
    bullets: string[];
    techStack: string[];
  }[];
  projects: {
    name: string;
    techStack: string[];
    bullets: string[];
  }[];
  leadership: {
    label: string;
    description: string;
  }[];
  certifications: {
    name: string;
    issuer: string;
  }[];
};

export type DummyAgentResumeOutput = {
  source: "dummy-agent-output";
  note: string;
  targetRole: string;
  targetCompany: string;
  insights: {
    priority: "high" | "medium" | "low";
    finding: string;
    appliedChange: string;
  }[];
  blueprint: ResumeBlueprint;
};

export function buildDummyAgentResumeOutput({
  parsedResume,
  targetRole,
  targetCompany,
}: {
  parsedResume: ParsedResume;
  targetRole: string;
  targetCompany: string;
}): DummyAgentResumeOutput {
  const sectionMap = new Map(
    parsedResume.sections.map((section) => [section.title.toLowerCase(), section.content]),
  );
  const name = extractName(parsedResume.text);
  const role = targetRole || "Target Role";
  const company = targetCompany || "Target Company";
  const skills = extractSkills(sectionMap.get("skills") ?? sectionMap.get("technical skills") ?? parsedResume.text);
  const experienceBullets = extractBullets(sectionMap.get("experience") ?? sectionMap.get("work experience") ?? "");
  const projectBullets = extractBullets(sectionMap.get("projects") ?? sectionMap.get("project experience") ?? "");

  const blueprint: ResumeBlueprint = {
    header: {
      fullName: name,
      phone: parsedResume.contact.phone,
      email: parsedResume.contact.email,
      linkedinUrl: findLink(parsedResume.contact.links, "linkedin.com"),
      githubUrl: findLink(parsedResume.contact.links, "github.com"),
      portfolioUrl: parsedResume.contact.links.find(
        (link) => !link.includes("linkedin.com") && !link.includes("github.com"),
      ),
    },
    education: [
      {
        institution: firstContentLine(sectionMap.get("education")) || "[University/College Name]",
        location: "[City, Country]",
        credential: inferCredential(sectionMap.get("education")) || "[Degree Name]",
        scoreLine: inferScore(sectionMap.get("education")) || "[CGPA / Aggregate]",
        dateRange: inferDateRange(sectionMap.get("education")) || "[Start Year] -- [End Year]",
      },
    ],
    skillCategories: [
      {
        label: "Languages",
        items: skills.languages.length ? skills.languages : ["[Language 1]", "[Language 2]"],
      },
      {
        label: "Developer Tools",
        items: skills.tools.length ? skills.tools : ["Git", "GitHub", "[Tool]"],
      },
      {
        label: "Frameworks & Libraries",
        items: skills.frameworks.length ? skills.frameworks : ["[Framework 1]", "[Framework 2]"],
      },
    ],
    experience: [
      {
        company: inferCompany(sectionMap.get("experience")) || "[Company Name]",
        dateRange: inferDateRange(sectionMap.get("experience")) || "[Month, Year] -- [Month, Year]",
        title: role,
        location: "[City, Country]",
        bullets: strengthenBullets(experienceBullets, role).slice(0, 3),
        techStack: [...skills.languages, ...skills.frameworks].slice(0, 6),
      },
    ],
    projects: [
      {
        name: inferProjectName(sectionMap.get("projects")) || `${role} Portfolio Project`,
        techStack: [...skills.languages, ...skills.frameworks, ...skills.tools].slice(0, 5),
        bullets: strengthenBullets(projectBullets, role).slice(0, 3),
      },
    ],
    leadership: [
      {
        label: "Role Alignment",
        description: `Repositioned resume content around ${role} requirements for ${company}, preserving only claims supported by the uploaded resume.`,
      },
    ],
    certifications: [
      {
        name: firstContentLine(sectionMap.get("certifications")) || "[Certification Name]",
        issuer: "[Issuing Organization]",
      },
    ],
  };

  return {
    source: "dummy-agent-output",
    note: "Replace this object with real council/agent JSON when that integration is ready.",
    targetRole: role,
    targetCompany: company,
    insights: [
      {
        priority: "high",
        finding: "Resume content needs to be mapped into a focused, ATS-readable template.",
        appliedChange: "Converted parsed resume sections into the sample LaTeX template structure.",
      },
      {
        priority: "medium",
        finding: "Several bullets may lack measurable outcomes.",
        appliedChange: "Kept claims factual and added placeholders only where the user must verify details.",
      },
    ],
    blueprint,
  };
}

function extractName(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.includes("@") && !/\d{5,}/.test(line))
    ?.slice(0, 80) ?? "[Firstname] [Lastname]";
}

function firstContentLine(content = "") {
  return content
    .split("\n")
    .map((line) => cleanLine(line))
    .find(Boolean);
}

function extractBullets(content: string) {
  return content
    .split("\n")
    .map((line) => cleanLine(line))
    .filter((line) => line.length > 12)
    .slice(0, 8);
}

function strengthenBullets(bullets: string[], role: string) {
  const fallback = [
    `Built and improved resume-supported work relevant to ${role}, using concrete project and experience evidence from the uploaded document.`,
    "Clarified ownership, tools, and outcomes while leaving unverifiable metrics as user-fillable placeholders.",
  ];

  return (bullets.length ? bullets : fallback).map((bullet) => {
    const trimmed = cleanLine(bullet).replace(/\.$/, "");
    return `${trimmed}.`;
  });
}

function extractSkills(content: string) {
  const knownLanguages = ["JavaScript", "TypeScript", "Java", "SQL", "Python", "C++", "C", "HTML", "CSS"];
  const knownFrameworks = [
    "React",
    "ReactJS",
    "Next.js",
    "Node.js",
    "Express.js",
    "MongoDB",
    "Tailwind CSS",
    "Angular",
    "Firebase",
    "Flask",
    "Django",
  ];
  const knownTools = ["Git", "GitHub", "Docker", "AWS", "Postman", "Linux", "VS Code", "Vercel"];

  return {
    languages: matchKnown(content, knownLanguages),
    frameworks: matchKnown(content, knownFrameworks),
    tools: matchKnown(content, knownTools),
  };
}

function matchKnown(content: string, values: string[]) {
  const lower = content.toLowerCase();
  return values.filter((value) => lower.includes(value.toLowerCase()));
}

function findLink(links: string[], domain: string) {
  return links.find((link) => link.toLowerCase().includes(domain));
}

function inferCredential(content = "") {
  return content.match(/(?:B\.?Tech|Bachelor|Master|M\.?Tech|B\.?E\.?|M\.?S\.?|MBA)[^\n]*/i)?.[0];
}

function inferScore(content = "") {
  return content.match(/(?:CGPA|GPA|Aggregate|Percentage)[:\s-]*[^\n]+/i)?.[0];
}

function inferDateRange(content = "") {
  return content.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4}\s*(?:--|-|to)\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4})/i)?.[0];
}

function inferCompany(content = "") {
  return firstContentLine(content)?.replace(/\s*\|.*$/, "");
}

function inferProjectName(content = "") {
  return firstContentLine(content)?.replace(/\s*[-|].*$/, "");
}

function cleanLine(line: string) {
  return line.replace(/^[-*•\s]+/, "").replace(/\s+/g, " ").trim();
}
