from __future__ import annotations

import re
from pathlib import Path

from resume_roast_arena.schemas import (
    CertificationEntry,
    EducationEntry,
    ExperienceEntry,
    LeadershipEntry,
    ProjectEntry,
    ResumeBlueprint,
    SkillCategory,
)


class LatexResumeRenderer:
    """Renders a ResumeBlueprint into the sample single-page LaTeX template."""

    def __init__(self, template_path: Path | None = None) -> None:
        self.template_path = template_path or (
            Path(__file__).resolve().parent
            / "resources"
            / "sample_resume_template.tex"
        )
        self.template_text = self.template_path.read_text(encoding="utf-8")

    def render(self, blueprint: ResumeBlueprint) -> str:
        preamble = self._template_preamble()
        body = "\n\n".join(
            [
                self._render_heading(blueprint),
                self._render_education(blueprint.education),
                self._render_skills(blueprint.skill_categories),
                self._render_experience(blueprint.experience),
                self._render_projects(blueprint.projects),
                self._render_leadership(blueprint.leadership),
                self._render_certifications(blueprint.certifications),
            ]
        )
        return f"{preamble}\n\n{body}\n\n\\end{{document}}\n"

    def _template_preamble(self) -> str:
        before_document = self.template_text.split(r"\begin{document}", maxsplit=1)[0]
        return before_document.rstrip() + "\n\n\\begin{document}"

    def _render_heading(self, blueprint: ResumeBlueprint) -> str:
        header = blueprint.header
        pieces = []

        if header.phone:
            digits = re.sub(r"[^\d+]", "", header.phone)
            pieces.append(
                f"\\href{{tel:{self._escape_url(digits)}}}{{\\faPhone\\ \\underline{{{self._escape_text(header.phone)}}}}}"
            )
        if header.email:
            pieces.append(
                f"\\href{{mailto:{self._escape_url(header.email)}}}{{\\faEnvelope\\ \\underline{{{self._escape_text(header.email)}}}}}"
            )
        if header.linkedin_url:
            pieces.append(
                f"\\href{{{self._escape_url(header.linkedin_url)}}}{{\\faLinkedin\\ \\underline{{LinkedIn}}}}"
            )
        if header.github_url:
            pieces.append(
                f"\\href{{{self._escape_url(header.github_url)}}}{{\\faGithub\\ \\underline{{GitHub}}}}"
            )
        if header.portfolio_url:
            pieces.append(
                f"\\href{{{self._escape_url(header.portfolio_url)}}}{{\\faGlobe\\ \\underline{{Portfolio Website}}}}"
            )

        links_line = " ~|~\n    ".join(pieces) if pieces else self._comment("Add contact links")
        return "\n".join(
            [
                "%----------HEADING----------",
                "\\begin{center}",
                f"    {{\\Huge \\scshape {self._escape_text(header.full_name)}}} \\\\ \\vspace{{2pt}}",
                "    \\small",
                f"    {links_line}",
                "    \\vspace{-10pt}",
                "\\end{center}",
            ]
        )

    def _render_education(self, entries: list[EducationEntry]) -> str:
        lines = [
            "%-----------EDUCATION-----------",
            "\\section{EDUCATION}",
            "  \\resumeSubHeadingListStart",
        ]

        if not entries:
            lines.extend(
                [
                    "    \\item \\textbf{[University/College Name]} \\hfill [City, Country] \\\\",
                    "    \\textit{[Degree Name]} -- \\textbf{CGPA: [X.X] / 10.0} \\hfill \\textit{[Start Year] -- [End Year]}",
                ]
            )
        else:
            for entry in entries[:2]:
                location = self._escape_text(entry.location or "[City, Country]")
                score_line = (
                    f" -- \\textbf{{{self._escape_text(entry.score_line)}}}"
                    if entry.score_line
                    else ""
                )
                date_range = self._date_range(entry.start_date, entry.end_date)
                lines.extend(
                    [
                        f"    \\item \\textbf{{{self._escape_text(entry.institution)}}} \\hfill {location} \\\\",
                        f"    \\textit{{{self._escape_text(entry.credential)}}}{score_line} \\hfill \\textit{{{self._escape_text(date_range)}}}",
                        "    \\vspace{-6pt}",
                        "",
                    ]
                )
            if lines[-1] == "":
                lines.pop()

        lines.extend(["  \\resumeSubHeadingListEnd", "  \\vspace{-6pt}"])
        return "\n".join(lines)

    def _render_skills(self, categories: list[SkillCategory]) -> str:
        lines = [
            "%-----------TECHNICAL SKILLS-----------",
            "\\section{TECHNICAL SKILLS}",
            " \\begin{itemize}[leftmargin=0.0in, label={}]",
            "    \\small{\\item{",
        ]

        if not categories:
            categories = [
                SkillCategory(label="Languages", items=["[Language 1]", "[Language 2]"]),
                SkillCategory(label="Developer Tools", items=["[Tool 1]", "[Tool 2]"]),
                SkillCategory(
                    label="Frameworks & Libraries",
                    items=["[Framework 1]", "[Framework 2]"],
                ),
            ]

        rendered_categories = []
        for category in categories[:4]:
            label = self._escape_text(category.label)
            items = ", ".join(self._escape_text(item) for item in category.items) or "[Add items]"
            rendered_categories.append(f"     \\textbf{{{label}:}}{{ {items}}} \\\\")

        lines.extend(rendered_categories)
        lines.extend(["    }}", " \\end{itemize}", " \\vspace{-12pt}"])
        return "\n".join(lines)

    def _render_experience(self, entries: list[ExperienceEntry]) -> str:
        lines = [
            "%-----------EXPERIENCE-----------",
            "\\section{EXPERIENCE}",
            "\\resumeSubHeadingListStart",
            "",
        ]

        if not entries:
            entries = [
                ExperienceEntry(
                    company="[Company Name]",
                    date_range="[Month, Year] -- [Month, Year]",
                    title="[Job Title]",
                    location="[City, Country]",
                    bullets=["Add impact-focused bullet here."],
                    tech_stack=[],
                )
            ]

        for entry in entries[:3]:
            lines.extend(
                [
                    "  \\resumeSubheading",
                    f"    {{{self._escape_text(entry.company)}}}{{{self._escape_text(entry.date_range or '[Month, Year] -- [Month, Year]')}}}",
                    f"    {{{self._escape_text(entry.title)}}}{{{self._escape_text(entry.location or '[City, Country]')}}}",
                    "    \\resumeItemListStart",
                ]
            )
            for bullet in entry.bullets[:4]:
                lines.append(f"      \\resumeItem{{{self._escape_text(bullet)}}}")
            if entry.tech_stack:
                stack = ", ".join(self._escape_text(item) for item in entry.tech_stack)
                lines.append(f"      \\resumeItem{{\\textbf{{Tech Stack}}: {stack}.}}")
            lines.extend(["    \\resumeItemListEnd", ""])

        lines.extend(["\\resumeSubHeadingListEnd", "\\vspace{-8pt}"])
        return "\n".join(lines)

    def _render_projects(self, entries: list[ProjectEntry]) -> str:
        lines = [
            "%-----------PROJECTS-----------",
            "\\section{PROJECTS}",
            "    \\resumeSubHeadingListStart",
            "",
        ]

        if not entries:
            entries = [
                ProjectEntry(
                    name="[Project Name]",
                    tech_stack=["[Tech 1]", "[Tech 2]"],
                    bullets=["Add a project bullet here."],
                )
            ]

        for entry in entries[:3]:
            tech_stack = ", ".join(self._escape_text(item) for item in entry.tech_stack)
            lines.extend(
                [
                    "      \\resumeProjectHeading",
                    f"        {{{self._escape_text(entry.name)}}}{{\\textit{{{tech_stack or '[Tech Stack]'}}}}}",
                    "        \\resumeItemListStart",
                ]
            )
            for bullet in entry.bullets[:3]:
                lines.append(f"          \\resumeItem{{{self._escape_text(bullet)}}}")
            lines.extend(["        \\resumeItemListEnd", ""])

        lines.extend(["\\resumeSubHeadingListEnd", "\\vspace{-8pt}"])
        return "\n".join(lines)

    def _render_leadership(self, entries: list[LeadershipEntry]) -> str:
        lines = [
            "%-----------LEADERSHIP & ENGAGEMENT-----------",
            "\\section{LEADERSHIP \\& ENGAGEMENT}",
            " \\begin{itemize}[leftmargin=0.15in, label={\\tiny$\\bullet$}]",
        ]

        if not entries:
            entries = [
                LeadershipEntry(
                    label="[Leadership Item]",
                    description="Add leadership or engagement evidence here.",
                )
            ]

        for entry in entries[:4]:
            label = self._escape_text(entry.label)
            description = self._escape_text(entry.description)
            lines.append(f"    \\resumeItem{{\\textbf{{{label}:}} {description}}}")

        lines.extend([" \\end{itemize}", " \\vspace{-10pt}"])
        return "\n".join(lines)

    def _render_certifications(self, entries: list[CertificationEntry]) -> str:
        if not entries:
            entries = [
                CertificationEntry(name="[Certification Name]", issuer="[Issuing Organization]")
            ]

        chunks = []
        for entry in entries[:4]:
            name = self._escape_text(entry.name)
            issuer = self._escape_text(entry.issuer or "[Issuing Organization]")
            chunks.append(
                f"$\\sbullet[.75] \\hspace{{0.1cm}}$ {name} -- {issuer}"
            )

        first_line = " \\hspace{1cm}\n".join(chunks[:2])
        second_line = " \\hspace{1cm}\n".join(chunks[2:4])
        cert_lines = [
            "%-----------CERTIFICATIONS---------------",
            "\\section{CERTIFICATIONS}",
            "\\small{",
            first_line,
        ]
        if second_line:
            cert_lines.extend(["\\\\", second_line])
        cert_lines.extend(["}", ""])
        return "\n".join(cert_lines)

    @staticmethod
    def _date_range(start_date: str, end_date: str) -> str:
        start = start_date or "[Start Year]"
        end = end_date or "[End Year]"
        return f"{start} -- {end}"

    @staticmethod
    def _escape_text(value: str) -> str:
        replacements = {
            "\\": r"\textbackslash{}",
            "&": r"\&",
            "%": r"\%",
            "$": r"\$",
            "#": r"\#",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "~": r"\textasciitilde{}",
            "^": r"\textasciicircum{}",
        }
        return "".join(replacements.get(char, char) for char in value)

    @staticmethod
    def _escape_url(value: str) -> str:
        return value.replace(" ", "%20")

    @staticmethod
    def _comment(text: str) -> str:
        return f"% {text}"
