"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Agent = {
  backendId: string;
  name: string;
  role: string;
  color: string;
  score: number;
  seat: string;
  note: string;
  spriteColumn: number;
  depth: "back" | "front" | "center";
};

type DebateLine = {
  speaker: string;
  speakerId: string;
  time: string;
  text: string;
  actionItem?: string;
};

type ParsedResume = {
  fileName: string;
  fileType: string;
  fileSize: number;
  text: string;
  sections: {
    title: string;
    content: string;
  }[];
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
    source: string;
    confidence: "high" | "medium" | "low";
  };
};

type MiniResumeSection = {
  title: string;
  lines: string[];
};

type FeedbackItem = {
  title: string;
  evidence: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
};

type AgentScorecard = {
  agent_id: string;
  agent_name: string;
  overall_score: number;
  role_fit_score: number;
  clarity_score: number;
  ats_score: number;
  impact_score: number;
  verdict: string;
  roast_line: string;
  strengths: FeedbackItem[];
  red_flags: FeedbackItem[];
  add_suggestions: FeedbackItem[];
  remove_suggestions: FeedbackItem[];
  change_suggestions: FeedbackItem[];
  formatting_improvements: FeedbackItem[];
  ats_keywords_to_add: string[];
  bullet_rewrites: string[];
  reasoning: string;
};

type BackendDebateTurn = {
  speaker_agent_id: string;
  message: string;
  agrees_with: string[];
  challenges: string[];
  action_item: string;
};

type CouncilDecision = {
  council_verdict: string;
  shortlist_readiness_score: number;
  consensus_summary: string;
  main_disagreements: string[];
  final_council_note: string;
};

type ArenaResult = {
  mode: "bts" | "combat";
  scorecards: AgentScorecard[];
  debate: BackendDebateTurn[];
  council_decision: CouncilDecision | null;
  prioritized_feedback: FeedbackItem[];
  red_flags: FeedbackItem[];
  final_resume_draft: string;
  ats_friendly_version_notes: string[];
  reasons_behind_changes: string[];
};

const agents: Agent[] = [
  {
    backendId: "recruiter",
    name: "Recruiter",
    role: "Signal Hunter",
    color: "#ffd84a",
    score: 68,
    seat: "left-[12%] top-[33%]",
    note: "Waiting for the first-screen verdict.",
    spriteColumn: 0,
    depth: "back",
  },
  {
    backendId: "ats",
    name: "ATS Bot",
    role: "Parser Unit",
    color: "#42e8e0",
    score: 42,
    seat: "right-[11%] top-[33%]",
    note: "Ready to scan formatting and keywords.",
    spriteColumn: 1,
    depth: "back",
  },
  {
    backendId: "startup_founder",
    name: "Founder",
    role: "Impact Judge",
    color: "#57e574",
    score: 71,
    seat: "left-[7%] bottom-[8%]",
    note: "Hunting for ownership and leverage.",
    spriteColumn: 2,
    depth: "front",
  },
  {
    backendId: "hiring_manager",
    name: "Hiring Manager",
    role: "Outcome Ref",
    color: "#ffc941",
    score: 63,
    seat: "left-1/2 bottom-[3%] -translate-x-1/2",
    note: "Checking depth, scope, and job fit.",
    spriteColumn: 3,
    depth: "center",
  },
  {
    backendId: "brutally_honest_friend",
    name: "Honest Friend",
    role: "Vibe Check",
    color: "#bf67ff",
    score: 55,
    seat: "right-[5%] bottom-[8%]",
    note: "Prepared to roast vague phrasing.",
    spriteColumn: 4,
    depth: "front",
  },
  {
    backendId: "morale_friend",
    name: "Morale Friend",
    role: "Strength Spotter",
    color: "#ff8fc7",
    score: 74,
    seat: "right-[-7%] top-[38%] scale-[0.55]",
    note: "Protecting the good parts while improving the rest.",
    spriteColumn: 4,
    depth: "back",
  },
];

const staticDebateLines: DebateLine[] = [
  {
    speaker: "Honest Friend",
    speakerId: "brutally_honest_friend",
    time: "Ready",
    text: "Upload a resume and start a new roast. Then the real agents take over this transcript.",
  },
  {
    speaker: "ATS Bot",
    speakerId: "ats",
    time: "Queued",
    text: "I will scan section names, formatting risk, and keyword coverage once the bell rings.",
  },
  {
    speaker: "Recruiter",
    speakerId: "recruiter",
    time: "Queued",
    text: "I will judge whether this resume survives a fast human screen.",
  },
  {
    speaker: "Hiring Manager",
    speakerId: "hiring_manager",
    time: "Queued",
    text: "I will look for evidence that the candidate can actually do the target job.",
  },
  {
    speaker: "Morale Friend",
    speakerId: "morale_friend",
    time: "Queued",
    text: "I will preserve the strongest signals so the roast improves the resume without flattening it.",
  },
];

const defaultRedFlags = [
  "No live roast yet",
  "Upload resume first",
  "Click New Roast",
  "Agents will replace these notes",
];

const spriteX = ["0%", "25%", "50%", "75%", "100%"];
const spriteY = {
  idle: "0%",
  speak: "50%",
  work: "100%",
};

function AgentSprite({
  agent,
  compact = false,
  action = "idle",
}: {
  agent: Agent;
  compact?: boolean;
  action?: keyof typeof spriteY;
}) {
  return (
    <div
      className={compact ? "sprite sprite-small" : "sprite"}
      style={
        {
          "--agent-color": agent.color,
          "--sprite-sheet": 'url("/agent-action-sprites.png")',
          "--sprite-x": spriteX[agent.spriteColumn],
          "--sprite-y": spriteY[action],
        } as React.CSSProperties
      }
      data-sprite-supported="true"
      aria-label={`${agent.name} avatar`}
      title={`${agent.name}: ${agent.role}`}
    />
  );
}

function ArenaAgent({ agent, active, roasting }: { agent: Agent; active: boolean; roasting: boolean }) {
  return (
    <div className={`agent-seat agent-${agent.depth} absolute ${agent.seat} ${active ? "active" : ""} ${roasting ? "is-thinking" : ""}`}>
      <div className="agent-label" style={{ color: agent.color }}>
        {agent.name}
      </div>
      <div className="chair">
        <AgentSprite agent={agent} action={active ? "speak" : roasting ? "work" : "idle"} />
      </div>
    </div>
  );
}

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [arenaResult, setArenaResult] = useState<ArenaResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [roastError, setRoastError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isRoasting, setIsRoasting] = useState(false);
  const [targetRole, setTargetRole] = useState("Product Manager");
  const [targetCompany, setTargetCompany] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [jobDescription, setJobDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scorecardByAgentId = useMemo(() => {
    return new Map(arenaResult?.scorecards.map((scorecard) => [scorecard.agent_id, scorecard]) ?? []);
  }, [arenaResult]);

  const displayAgents = useMemo(() => {
    return agents.map((agent) => {
      const scorecard = scorecardByAgentId.get(agent.backendId);
      return {
        ...agent,
        score: scorecard?.overall_score ?? agent.score,
        note: scorecard?.roast_line ?? scorecard?.verdict ?? agent.note,
      };
    });
  }, [scorecardByAgentId]);

  const liveDebateLines = useMemo(() => {
    if (!arenaResult?.debate.length) {
      return staticDebateLines;
    }

    return arenaResult.debate.map((turn, index) => {
      const agent = agents.find((item) => item.backendId === turn.speaker_agent_id);
      return {
        speaker: agent?.name ?? turn.speaker_agent_id,
        speakerId: turn.speaker_agent_id,
        time: `Turn ${index + 1}`,
        text: turn.message,
        actionItem: turn.action_item,
      };
    });
  }, [arenaResult]);

  const activeLine = liveDebateLines[activeIndex % liveDebateLines.length];
  const activeAgent = useMemo(
    () => displayAgents.find((agent) => agent.backendId === activeLine.speakerId) ?? displayAgents[0],
    [activeLine.speakerId, displayAgents],
  );
  const redFlags = arenaResult?.red_flags.map((flag) => flag.title) ?? defaultRedFlags;
  const councilScore = arenaResult?.council_decision?.shortlist_readiness_score;

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % liveDebateLines.length);
    }, arenaResult ? 5200 : 3600);

    return () => window.clearInterval(id);
  }, [arenaResult, liveDebateLines.length]);

  async function parseResume(file: File) {
    setIsParsing(true);
    setUploadError(null);
    setRoastError(null);
    setArenaResult(null);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not parse resume.");
      }

      setParsedResume(payload.parsedResume);
    } catch (error) {
      setParsedResume(null);
      setUploadError(error instanceof Error ? error.message : "Could not parse resume.");
    } finally {
      setIsParsing(false);
    }
  }

  async function runRoast() {
    if (!parsedResume || isRoasting) {
      return;
    }

    setIsRoasting(true);
    setRoastError(null);
    setArenaResult(null);
    setActiveIndex(0);

    try {
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText: parsedResume.text,
          jobDescription,
          targetRole,
          targetCompany,
          experienceLevel,
          preferredTone: "confident, direct, ATS-friendly, witty but useful",
          mode: "combat",
          agentIds: agents.map((agent) => agent.backendId),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "The arena could not finish this roast.");
      }

      setArenaResult(payload.result);
    } catch (error) {
      setRoastError(error instanceof Error ? error.message : "The arena could not finish this roast.");
    } finally {
      setIsRoasting(false);
    }
  }

  function handleFile(file?: File) {
    if (!file) {
      return;
    }

    void parseResume(file);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050b12] text-slate-100">
      <div className="scanlines" />
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col gap-3 px-4 py-4 xl:px-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark">RR</div>
            <h1 className="pixel-title text-2xl sm:text-4xl">
              Resume <span className="text-[#ff5448]">Roast</span>{" "}
              <span className="text-[#38dbe0]">Arena</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="icon-button" aria-label="Toggle brightness">
              <span className="sun-icon" />
            </button>
            <button className="icon-button" aria-label="Help">
              ?
            </button>
            <button className="new-roast-button" disabled={!parsedResume || isParsing || isRoasting} onClick={() => void runRoast()}>
              {isRoasting ? "Roasting..." : "New Roast"}
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-3 lg:grid-cols-[230px_minmax(0,1fr)_250px] xl:grid-cols-[300px_minmax(520px,1fr)_320px] 2xl:grid-cols-[350px_minmax(620px,1fr)_390px]">
          <aside className="panel flex flex-col gap-4 p-4">
            <section>
              <h2 className="section-title text-[#ff5448]">Upload Resume</h2>
              <div
                className={`upload-zone mt-4 ${isParsing ? "is-parsing" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFile(event.dataTransfer.files[0]);
                }}
              >
                <div className="upload-cloud" />
                <p>{isParsing ? "Parsing resume..." : "Drag and drop your resume"}</p>
                <span>or</span>
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept=".pdf,.docx,.tex,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <button
                  className="upload-button"
                  disabled={isParsing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isParsing ? "Parsing..." : "Upload Resume"}
                </button>
                {parsedResume ? (
                  <div className="file-pill">
                    <div className="file-icon" />
                    <div>
                      <strong>{parsedResume.fileName}</strong>
                      <small>
                        {formatFileSize(parsedResume.fileSize)} | {parsedResume.parser.source.toUpperCase()} |{" "}
                        {parsedResume.parser.confidence} confidence
                      </small>
                    </div>
                    <span className="check-dot">OK</span>
                  </div>
                ) : null}
                {uploadError ? <p className="upload-error">{uploadError}</p> : null}
              </div>
            </section>

            {parsedResume ? (
              <section className="parser-card">
                <div className="parser-card-head">
                  <h2 className="section-title">Parser Output</h2>
                  <span>{parsedResume.stats.wordCount} words</span>
                </div>
                <dl>
                  <div>
                    <dt>Sections</dt>
                    <dd>{parsedResume.stats.sectionCount}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{parsedResume.contact.email ? "Email found" : "Needs check"}</dd>
                  </div>
                </dl>
                <div className="section-chips">
                  {parsedResume.sections.slice(0, 5).map((section) => (
                    <span key={section.title}>{section.title}</span>
                  ))}
                </div>
                {parsedResume.warnings.length ? (
                  <ul>
                    {parsedResume.warnings.slice(0, 3).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Clean parse. The agents have enough text to start swinging.</p>
                )}
              </section>
            ) : null}

            <section className="form-block">
              <h2 className="section-title">Target Role</h2>
              <label>
                <span>What role are you targeting?</span>
                <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
              </label>
            </section>

            <section className="form-block">
              <h2 className="section-title">Company</h2>
              <label>
                <span>Optional target company</span>
                <input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} placeholder="e.g. OpenAI" />
              </label>
            </section>

            <section className="form-block">
              <h2 className="section-title">Experience Level</h2>
              <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}>
                <option value="entry">Entry-level</option>
                <option value="mid">Mid-level (3-7 years)</option>
                <option value="senior">Senior</option>
              </select>
            </section>

            <section className="form-block">
              <h2 className="section-title">Job Description</h2>
              <label>
                <span>Optional JD or role notes</span>
                <textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Paste the JD for sharper agent debate."
                />
              </label>
            </section>

            {roastError ? <p className="roast-error">{roastError}</p> : null}

            <button className="enter-button" disabled={!parsedResume || isParsing || isRoasting} onClick={() => void runRoast()}>
              {isRoasting ? "Agents Roasting..." : "Enter Arena"} <span>x</span>
            </button>

            <div className="pro-tip mt-auto">
              <strong>{arenaResult ? "Council Verdict" : "Pro Tip"}</strong>
              <p>{arenaResult?.council_decision?.consensus_summary ?? "Be brave. These agents do not hold back."}</p>
            </div>
          </aside>

          <section className="panel overflow-hidden">
            <div className={`arena relative min-h-[620px] ${isRoasting ? "is-roasting" : ""} ${arenaResult ? "has-result" : ""}`}>
              <div className="crowd" />
              <div className="banners">
                <span />
                <span />
              </div>
              <div className="round-banner">
                <span>{isRoasting ? "Agents Thinking" : arenaResult ? "Council Complete" : "Round 1"}</span>
                <strong>{isRoasting ? "Roast In Progress" : arenaResult ? "Verdict Is In" : "Let The Roast Begin"}</strong>
              </div>
              <div className="arena-ring" />
              <div className="resume-hologram">
                <div className="mini-resume-page" aria-label="Mini parsed resume preview">
                  <strong className="mini-resume-name">{getMiniResumeName(parsedResume)}</strong>
                  <span className="mini-resume-meta">
                    {parsedResume
                      ? `${parsedResume.stats.wordCount} words | ${parsedResume.stats.sectionCount} sections`
                      : "Upload resume | Parser ready"}
                  </span>
                  <div
                    className="mini-resume-body"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr)",
                      gridAutoRows: "auto",
                      gap: "2px",
                      height: "198px",
                      overflow: "hidden",
                      paddingTop: "4px",
                    }}
                  >
                    {getMiniResumeSections(parsedResume).map((section) => (
                      <section className="mini-resume-section" key={section.title} style={{ minWidth: 0 }}>
                        <h3>{section.title}</h3>
                        {section.lines.map((line, index) => (
                          <p key={`${section.title}-${index}`}>{line}</p>
                        ))}
                      </section>
                    ))}
                  </div>
                </div>
              </div>
              <div className="platform-glow" />
              <div className="ats-beam" />
              <div className="roast-status">
                <span>{isRoasting ? "Live agent calls running" : arenaResult ? `Shortlist readiness ${councilScore ?? "--"}%` : "Awaiting resume"}</span>
              </div>
              {displayAgents.map((agent) => (
                <ArenaAgent
                  key={agent.backendId}
                  agent={agent}
                  active={agent.backendId === activeAgent.backendId}
                  roasting={isRoasting}
                />
              ))}
            </div>

            <div className="debate-panel">
              <div className="debate-head">
                <h2 className="section-title">Live Debate</h2>
                <div className="active-speaker">
                  Active Speaker:
                  <AgentSprite agent={activeAgent} compact action="speak" />
                  <strong style={{ color: activeAgent.color }}>{activeAgent.name}</strong>
                </div>
              </div>
              <div className="featured-line">
                <AgentSprite agent={activeAgent} action="speak" />
                <p>{activeLine.text}</p>
              </div>
              <div className="transcript">
                {liveDebateLines.map((line, index) => {
                  const agent = displayAgents.find((item) => item.backendId === line.speakerId) ?? displayAgents[0];
                  const active = index === activeIndex % liveDebateLines.length;
                  return (
                    <div className={`transcript-row ${active ? "is-active" : ""}`} key={`${line.speakerId}-${index}`}>
                      <AgentSprite agent={agent} compact />
                      <strong style={{ color: agent.color }}>{line.speaker}</strong>
                      <span title={line.actionItem}>{line.actionItem ? `${line.text} Action: ${line.actionItem}` : line.text}</span>
                      <time>{line.time}</time>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="panel p-4">
            <h2 className="section-title text-[#ff5448]">Agent Scores</h2>
            <div className="mt-4 flex flex-col gap-3">
              {displayAgents.map((agent) => (
                <article className={`score-card ${scorecardByAgentId.has(agent.backendId) ? "has-live-score" : ""}`} key={agent.backendId}>
                  <AgentSprite agent={agent} action={isRoasting ? "work" : "idle"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong style={{ color: agent.color }}>{agent.name}</strong>
                      <span className="score-number" style={{ color: agent.color }}>
                        {agent.score}
                      </span>
                    </div>
                    <p>{agent.note}</p>
                    <div className="meter">
                      <span style={{ width: `${agent.score}%`, background: agent.color }} />
                    </div>
                    <small>{agent.role}</small>
                  </div>
                </article>
              ))}
            </div>

            <section className="red-flags">
              <div className="flex items-center justify-between">
                <h2 className="section-title text-[#ff5448]">Red Flags</h2>
                <span className="flag-count">{redFlags.length}</span>
              </div>
              <ul>
                {redFlags.slice(0, 6).map((flag) => (
                  <li key={flag}>
                    <span />
                    {flag}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function getMiniResumeName(parsedResume: ParsedResume | null) {
  if (!parsedResume) {
    return "RESUME";
  }

  const header = parsedResume.sections.find((section) => section.title === "Header")?.content;
  const firstLine = header?.split("\n").find((line) => /[A-Za-z]{3}/.test(line));

  return compactText(firstLine ?? parsedResume.fileName.replace(/\.[^.]+$/, ""), 26).toUpperCase();
}

function getMiniResumeSections(parsedResume: ParsedResume | null): MiniResumeSection[] {
  if (!parsedResume) {
    return [
      {
        title: "SUMMARY",
        lines: textToMiniLines("Upload resume to render parsed words. Agents inspect every tiny line.", 3),
      },
      {
        title: "EXPERIENCE",
        lines: textToMiniLines("Impact bullets appear as document texture. Roast arena reads the extracted text.", 3),
      },
      {
        title: "SKILLS",
        lines: textToMiniLines("Keywords, sections, ATS signals, contact details, projects, and achievements.", 3),
      },
    ];
  }

  const sectionCount = parsedResume.sections.length;
  const linesPerSection = sectionCount >= 10 ? 3 : sectionCount >= 7 ? 4 : 5;

  return parsedResume.sections
    .map((section) => ({
      title: compactText(section.title, 20).toUpperCase(),
      lines: textToMiniLines(section.content, linesPerSection),
    }));
}

function textToMiniLines(value: string, maxLines = 2) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];

  for (let index = 0; index < words.length && lines.length < maxLines; index += 10) {
    lines.push(compactText(words.slice(index, index + 10).join(" "), 70));
  }

  return lines.length ? lines : ["Parsed content available for agent review"];
}

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
