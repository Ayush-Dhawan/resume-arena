"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Agent = {
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
  time: string;
  text: string;
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

const agents: Agent[] = [
  {
    name: "Recruiter",
    role: "Signal Hunter",
    color: "#ffd84a",
    score: 68,
    seat: "left-[12%] top-[33%]",
    note: "Good potential. A few things to tighten up.",
    spriteColumn: 0,
    depth: "back",
  },
  {
    name: "ATS Bot",
    role: "Parser Unit",
    color: "#42e8e0",
    score: 42,
    seat: "right-[11%] top-[33%]",
    note: "Parsing issues detected. Optimize for ATS.",
    spriteColumn: 1,
    depth: "back",
  },
  {
    name: "Founder",
    role: "Impact Judge",
    color: "#57e574",
    score: 71,
    seat: "left-[7%] bottom-[8%]",
    note: "I like the initiative. Show more impact.",
    spriteColumn: 2,
    depth: "front",
  },
  {
    name: "Hiring Manager",
    role: "Outcome Ref",
    color: "#ffc941",
    score: 63,
    seat: "left-1/2 bottom-[3%] -translate-x-1/2",
    note: "Solid experience. Needs clearer outcomes.",
    spriteColumn: 3,
    depth: "center",
  },
  {
    name: "Honest Friend",
    role: "Vibe Check",
    color: "#bf67ff",
    score: 55,
    seat: "right-[5%] bottom-[8%]",
    note: "Feels generic in places. Spice it up.",
    spriteColumn: 4,
    depth: "front",
  },
];

const debateLines: DebateLine[] = [
  {
    speaker: "Honest Friend",
    time: "10:23:45",
    text: "I am just saying, responsible for shows up four times. That is resume filler 101. Hit us with more impact.",
  },
  {
    speaker: "ATS Bot",
    time: "10:23:21",
    text: "I found section header drift. Consider standard formatting for better parsing.",
  },
  {
    speaker: "Recruiter",
    time: "10:22:58",
    text: "Your experience is relevant, but the summary could be sharper and more role-specific.",
  },
  {
    speaker: "Hiring Manager",
    time: "10:22:32",
    text: "Quantify the results in your last two roles. That would strengthen your case.",
  },
  {
    speaker: "Founder",
    time: "10:22:10",
    text: "You have potential. Highlight product thinking and ownership more clearly.",
  },
];

const redFlags = [
  "No quantifiable achievements",
  "Weak action verbs",
  "Skills section not optimized",
  "Education takes up too much space",
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
      title="Sprite sheet loaded from /public/agent-action-sprites.png."
    />
  );
}

function ArenaAgent({ agent, active }: { agent: Agent; active: boolean }) {
  return (
    <div className={`agent-seat agent-${agent.depth} absolute ${agent.seat} ${active ? "active" : ""}`}>
      <div className="agent-label" style={{ color: agent.color }}>
        {agent.name}
      </div>
      <div className="chair">
        <AgentSprite agent={agent} action={active ? "speak" : "idle"} />
      </div>
    </div>
  );
}

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeLine = debateLines[activeIndex % debateLines.length];
  const activeAgent = useMemo(
    () => agents.find((agent) => agent.name === activeLine.speaker) ?? agents[0],
    [activeLine],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % debateLines.length);
    }, 3600);

    return () => window.clearInterval(id);
  }, []);

  async function parseResume(file: File) {
    setIsParsing(true);
    setUploadError(null);

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
            <button className="new-roast-button">New Roast</button>
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
                <input defaultValue="Product Manager" />
              </label>
              <small>e.g. Product Manager, Data Scientist, Software Engineer</small>
            </section>

            <section className="form-block">
              <h2 className="section-title">Experience Level</h2>
              <select defaultValue="mid">
                <option value="mid">Mid-level (3-7 years)</option>
                <option>Entry-level</option>
                <option>Senior</option>
              </select>
            </section>

            <section className="form-block">
              <h2 className="section-title">Industry (Optional)</h2>
              <select defaultValue="technology">
                <option value="technology">Technology</option>
                <option>Finance</option>
                <option>Healthcare</option>
              </select>
            </section>

            <button className="enter-button" disabled={!parsedResume || isParsing}>
              Enter Arena <span>x</span>
            </button>

            <div className="pro-tip mt-auto">
              <strong>Pro Tip</strong>
              <p>Be brave. These agents do not hold back.</p>
            </div>
          </aside>

          <section className="panel overflow-hidden">
            <div className="arena relative min-h-[620px]">
              <div className="crowd" />
              <div className="banners">
                <span />
                <span />
              </div>
              <div className="round-banner">
                <span>Round 1</span>
                <strong>Let The Roast Begin</strong>
              </div>
              <div className="arena-ring" />
              <div className="resume-hologram">
                <span>{parsedResume ? "Parsed Resume" : "My Resume"}</span>
                <div className="resume-avatar" />
                {(parsedResume?.sections.slice(0, 5) ?? [null, null, null, null, null]).map((section, index) => (
                  <i key={section?.title ?? index} />
                ))}
              </div>
              <div className="platform-glow" />
              <div className="ats-beam" />
              {agents.map((agent) => (
                <ArenaAgent key={agent.name} agent={agent} active={agent.name === activeAgent.name} />
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
                {debateLines.map((line) => {
                  const agent = agents.find((item) => item.name === line.speaker) ?? agents[0];
                  const active = line.speaker === activeLine.speaker;
                  return (
                    <div className={`transcript-row ${active ? "is-active" : ""}`} key={line.time}>
                      <AgentSprite agent={agent} compact />
                      <strong style={{ color: agent.color }}>{line.speaker}</strong>
                      <span>{line.text}</span>
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
              {agents.map((agent) => (
                <article className="score-card" key={agent.name}>
                  <AgentSprite agent={agent} action="work" />
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
                {redFlags.map((flag) => (
                  <li key={flag}>
                    <span />
                    {flag}
                  </li>
                ))}
              </ul>
            </section>

            {parsedResume ? (
              <section className="resume-preview">
                <h2 className="section-title">Parsed Text Preview</h2>
                <p>{parsedResume.text.slice(0, 420)}</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
