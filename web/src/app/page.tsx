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

type CopilotMessage = {
  id: string;
  role: "editor" | "user" | "system";
  text: string;
};

type ResumeEditChange = {
  id: string;
  source: string;
  title: string;
  evidence: string;
  recommendation: string;
  before: string;
  after: string;
  question?: string;
  answer?: string;
  status: "needs_input" | "ready" | "applied";
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

function FeedbackGroup({
  title,
  items,
  agentId,
}: {
  title: string;
  items: FeedbackItem[];
  agentId: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <details className="feedback-group" open={title === "Red Flags" || title === "Change"}>
      <summary>
        <span>{title}</span>
        <strong>{items.length}</strong>
      </summary>
      <ul>
        {items.map((item, index) => (
          <li key={`${agentId}-${title}-${item.title}-${index}`}>
            <div>
              <span>{item.priority}</span>
              <strong>{item.title}</strong>
            </div>
            <p>{item.evidence}</p>
            <p>{item.recommendation}</p>
          </li>
        ))}
      </ul>
    </details>
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
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [editChanges, setEditChanges] = useState<ResumeEditChange[]>([]);
  const [improvedResumeDraft, setImprovedResumeDraft] = useState("");
  const [metricAnswerMap, setMetricAnswerMap] = useState<Record<string, string>>({});
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
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
  const activeEditQuestion = editChanges.find((change) => change.status === "needs_input");
  const readyEditCount = editChanges.filter((change) => change.status === "ready").length;
  const appliedEditCount = editChanges.filter((change) => change.status === "applied").length;

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
    resetCopilot();

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
      initializeCopilot(payload.result);
    } catch (error) {
      setRoastError(error instanceof Error ? error.message : "The arena could not finish this roast.");
    } finally {
      setIsRoasting(false);
    }
  }

  function submitCopilotMessage() {
    const value = copilotInput.trim();
    if (!value) {
      return;
    }

    setCopilotInput("");
    setCopilotMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: value,
      },
    ]);

    if (!activeEditQuestion) {
      setCopilotMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "editor",
          text: "Noted. I will use that as extra evidence for the next rewrite pass.",
        },
      ]);
      return;
    }

    const updatedChange = answerEditQuestion(activeEditQuestion, value);
    let nextQuestion: ResumeEditChange | undefined;

    setMetricAnswerMap((answers) => ({
      ...answers,
      [activeEditQuestion.id]: value,
    }));
    setEditChanges((changes) => {
      const nextChanges = changes.map((change) =>
        change.id === activeEditQuestion.id ? updatedChange : change,
      );
      nextQuestion = nextChanges.find((change) => change.status === "needs_input");
      return nextChanges;
    });

    window.setTimeout(() => {
      setCopilotMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "editor",
          text: `Updated "${updatedChange.title}". I replaced the vague claim with your evidence: ${value}`,
        },
        {
          id: crypto.randomUUID(),
          role: "editor",
          text: nextQuestion?.question ?? "No more missing proof right now. The ready changes can be applied to the resume draft.",
        },
      ]);
    }, 0);
  }

  function applyReadyEdits() {
    const count = editChanges.filter((change) => change.status === "ready").length;
    if (!count) {
      return;
    }

    setEditChanges((changes) =>
      changes.map((change) =>
        change.status === "ready" ? { ...change, status: "applied" } : change,
      ),
    );
    setCopilotMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "editor",
        text: `Applied ${count} evidence-backed resume edit${count === 1 ? "" : "s"}.`,
      },
    ]);
  }

  async function generateImprovedResume() {
    if (!arenaResult || !parsedResume || isGeneratingResume) {
      return;
    }

    const usableChanges = editChanges.filter((change) => change.status === "ready" || change.status === "applied");
    const blockedChanges = editChanges.filter((change) => change.status === "needs_input");
    const draft = buildImprovedResumeDraft({
      arenaResult,
      targetRole,
      targetCompany,
      usableChanges,
      blockedChanges,
      metricAnswerMap,
    });

    setImprovedResumeDraft(draft);
    setIsCopilotOpen(true);

    try {
      setIsGeneratingResume(true);
      const response = await fetch("/api/resume/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parsedResume,
          targetRole,
          targetCompany,
          editChanges,
          metricAnswers: metricAnswerMap,
          draft,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Could not generate improved resume PDF.");
      }

      const pdf = await response.blob();
      const url = window.URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugifyForDownload(parsedResume.fileName || "improved-resume")}-improved.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setCopilotMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "editor",
          text: blockedChanges.length
            ? `Downloaded the improved resume PDF with ${usableChanges.length} verified edits. ${blockedChanges.length} unresolved edits were left out instead of guessed.`
            : `Downloaded the improved resume PDF using ${usableChanges.length} verified edits from the agent output.`,
        },
      ]);
    } catch (error) {
      setCopilotMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "editor",
          text: error instanceof Error ? error.message : "Could not generate improved resume PDF.",
        },
      ]);
    } finally {
      setIsGeneratingResume(false);
    }
  }

  function startImproveResume() {
    if (!arenaResult) {
      return;
    }

    if (!editChanges.length) {
      initializeCopilot(arenaResult);
    }

    setIsCopilotOpen(true);
    setCopilotMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "editor",
        text: activeEditQuestion
          ? activeEditQuestion.question ?? "I need one missing detail before I can improve this resume safely."
          : "I am ready to improve the resume using the agent feedback. Review the edit queue, answer any proof questions, then apply the ready edits.",
      },
    ]);
  }

  function handleFile(file?: File) {
    if (!file) {
      return;
    }

    void parseResume(file);
  }

  function resetCopilot() {
    setCopilotMessages([]);
    setEditChanges([]);
    setIsCopilotOpen(false);
    setCopilotInput("");
    setImprovedResumeDraft("");
    setMetricAnswerMap({});
    setIsGeneratingResume(false);
  }

  function initializeCopilot(result: ArenaResult) {
    const changes = buildResumeEditChanges(result);
    const firstQuestion = changes.find((change) => change.status === "needs_input");

    setEditChanges(changes);
    setImprovedResumeDraft("");
    setMetricAnswerMap({});
    setIsCopilotOpen(false);
    setCopilotMessages([
      {
        id: crypto.randomUUID(),
        role: "system",
        text: `Agent council complete. ${changes.length} resume edits queued from recruiter, ATS, hiring-manager, founder, and friend feedback.`,
      },
      {
        id: crypto.randomUUID(),
        role: "editor",
        text: firstQuestion
          ? firstQuestion.question ?? "I need one missing detail before I can write the strongest version."
          : "I found enough evidence to prepare the first rewrite pass. Review the queued changes and apply the ones that look right.",
      },
    ]);
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
            <button className="improve-resume-button" disabled={!arenaResult || isRoasting} onClick={startImproveResume}>
              Edit Resume
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

            <button className="improve-button" disabled={!arenaResult || isRoasting} onClick={startImproveResume}>
              Edit Resume With Copilot
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

            <section className="agent-comments">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title text-[#38dbe0]">Full Agent Output</h2>
                <span>{arenaResult?.scorecards.length ?? 0}</span>
              </div>
              {arenaResult?.scorecards.length ? (
                <div className="agent-comment-list">
                  {arenaResult.scorecards.map((scorecard) => (
                    <article className="agent-comment-card" key={scorecard.agent_id}>
                      <div className="agent-comment-head">
                        <strong>{scorecard.agent_name}</strong>
                        <span>{scorecard.overall_score}/100</span>
                      </div>
                      <div className="agent-score-grid">
                        <span>Role {scorecard.role_fit_score}</span>
                        <span>Clarity {scorecard.clarity_score}</span>
                        <span>ATS {scorecard.ats_score}</span>
                        <span>Impact {scorecard.impact_score}</span>
                      </div>
                      <p>{scorecard.verdict}</p>
                      <blockquote>{scorecard.roast_line}</blockquote>
                      <FeedbackGroup title="Strengths" items={scorecard.strengths} agentId={scorecard.agent_id} />
                      <FeedbackGroup title="Red Flags" items={scorecard.red_flags} agentId={scorecard.agent_id} />
                      <FeedbackGroup title="Add" items={scorecard.add_suggestions} agentId={scorecard.agent_id} />
                      <FeedbackGroup title="Remove" items={scorecard.remove_suggestions} agentId={scorecard.agent_id} />
                      <FeedbackGroup title="Change" items={scorecard.change_suggestions} agentId={scorecard.agent_id} />
                      <FeedbackGroup title="Formatting" items={scorecard.formatting_improvements} agentId={scorecard.agent_id} />
                      {scorecard.ats_keywords_to_add.length ? (
                        <div className="agent-keywords">
                          <h3>ATS Keywords</h3>
                          <p>{scorecard.ats_keywords_to_add.join(", ")}</p>
                        </div>
                      ) : null}
                      {scorecard.bullet_rewrites.length ? (
                        <div className="agent-bullets">
                          <h3>Bullet Rewrites</h3>
                          {scorecard.bullet_rewrites.map((bullet, index) => (
                            <p key={`${scorecard.agent_id}-bullet-${index}`}>{bullet}</p>
                          ))}
                        </div>
                      ) : null}
                      <div className="agent-reasoning">
                        <h3>Reasoning</h3>
                        <p>{scorecard.reasoning}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="agent-comments-empty">
                  {isRoasting
                    ? "Agents are reviewing in parallel. Their comments will appear here when the council returns."
                    : "Run the arena to see each agent's detailed critique."}
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
      {isCopilotOpen ? (
        <section className="copilot-window" aria-label="Resume edit copilot">
          <div className="copilot-shell">
            <header className="copilot-header">
              <div>
                <h2>Resume Edit Agent</h2>
                <p>{activeEditQuestion ? "Asking for proof before editing" : "Evidence-backed edits queued"}</p>
              </div>
              <button
                className="copilot-close-button"
                type="button"
                onClick={() => setIsCopilotOpen(false)}
                aria-label="Close resume edit agent"
              >
                ×
              </button>
            </header>

            <div className="copilot-stats">
              <span>{editChanges.length} queued</span>
              <span>{readyEditCount} ready</span>
              <span>{appliedEditCount} applied</span>
            </div>

            {activeEditQuestion ? (
              <article className="active-proof-card">
                <span>Answer needed now</span>
                <strong>{activeEditQuestion.title}</strong>
                <p>{activeEditQuestion.question}</p>
                <small>
                  Saved as <code>{activeEditQuestion.id}</code>
                </small>
              </article>
            ) : null}

            <div className="copilot-messages">
              {copilotMessages.length ? (
                copilotMessages.map((message) => (
                  <article className={`copilot-message ${message.role}`} key={message.id}>
                    <strong>{message.role === "user" ? "You" : message.role === "system" ? "Council" : "Editor"}</strong>
                    <p>{message.text}</p>
                  </article>
                ))
              ) : (
                <article className="copilot-message system">
                  <strong>Council</strong>
                  <p>Run a roast and I will convert agent feedback into precise resume edits.</p>
                </article>
              )}
            </div>

            <div className="edit-queue">
              {editChanges.slice(0, 5).map((change) => (
                <article className={`edit-card ${change.status}`} key={change.id}>
                  <div>
                    <strong>{change.title}</strong>
                    <span>{change.source}</span>
                  </div>
                  <p>{change.evidence}</p>
                  <dl>
                    <div>
                      <dt>Before</dt>
                      <dd>{change.before}</dd>
                    </div>
                    <div>
                      <dt>After</dt>
                      <dd>{change.after}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <form
              className="copilot-input"
              onSubmit={(event) => {
                event.preventDefault();
                submitCopilotMessage();
              }}
            >
              <input
                value={copilotInput}
                onChange={(event) => setCopilotInput(event.target.value)}
                placeholder={activeEditQuestion?.question ?? "Add evidence, constraints, or a correction..."}
              />
              <button type="submit">Send</button>
            </form>
            <button
              className="apply-edits-button"
              type="button"
              disabled={!readyEditCount}
              onClick={applyReadyEdits}
            >
              Apply Ready Edits
            </button>
            <button
              className="generate-draft-button"
              type="button"
              disabled={!arenaResult || !parsedResume || !editChanges.length || isGeneratingResume}
              onClick={() => void generateImprovedResume()}
            >
              {isGeneratingResume ? "Generating PDF..." : "Generate Improved Resume"}
            </button>
            {improvedResumeDraft ? (
              <pre className="improved-resume-draft">{improvedResumeDraft}</pre>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function buildResumeEditChanges(arenaResult: ArenaResult): ResumeEditChange[] {
  const feedback = [
    ...arenaResult.prioritized_feedback,
    ...arenaResult.red_flags,
    ...arenaResult.scorecards.flatMap((scorecard) => [
      ...scorecard.change_suggestions,
      ...scorecard.add_suggestions,
      ...scorecard.formatting_improvements,
    ]),
  ];
  const seen = new Set<string>();
  const changes = feedback
    .filter((item) => item.title && !seen.has(item.title.toLowerCase()))
    .map((item, index) => {
      seen.add(item.title.toLowerCase());
      const needsInput = needsUserProof(item);
      return {
        id: `feedback-${index}`,
        source: inferSource(arenaResult, item),
        title: item.title,
        evidence: item.evidence || "Agent feedback did not include direct evidence.",
        recommendation: item.recommendation,
        before: compactText(item.evidence || item.title, 120),
        after: needsInput
          ? "Waiting for your exact evidence before writing this bullet."
          : rewriteFromFeedback(item),
        question: needsInput ? buildClarifyingQuestion(item) : undefined,
        status: needsInput ? "needs_input" : "ready",
      } satisfies ResumeEditChange;
    })
    .slice(0, 8);

  if (!changes.length && arenaResult.final_resume_draft) {
    return [
      {
        id: "draft-0",
        source: "Synthesizer",
        title: "Use final draft as baseline",
        evidence: "The council produced a consolidated resume draft.",
        recommendation: "Use the generated draft as the first rewrite pass.",
        before: "Original resume text",
        after: compactText(arenaResult.final_resume_draft, 160),
        status: "ready",
      },
    ];
  }

  return changes;
}

function needsUserProof(item: FeedbackItem) {
  const text = `${item.title} ${item.evidence} ${item.recommendation}`.toLowerCase();
  return [
    "metric",
    "quant",
    "faster",
    "increase",
    "decrease",
    "improve",
    "scale",
    "users",
    "latency",
    "performance",
    "impact",
    "revenue",
    "cost",
  ].some((keyword) => text.includes(keyword));
}

function buildClarifyingQuestion(item: FeedbackItem) {
  const text = `${item.title} ${item.recommendation}`.toLowerCase();
  if (text.includes("faster") || text.includes("latency") || text.includes("performance")) {
    return `For "${item.title}", what exact performance change can you truthfully claim? Example: reduced API latency from 900ms to 320ms, or made page load 35% faster.`;
  }
  if (text.includes("users") || text.includes("scale")) {
    return `For "${item.title}", what scale number is accurate? Example: users served, requests/day, records processed, team size, or traffic handled.`;
  }
  if (text.includes("increase") || text.includes("decrease") || text.includes("revenue") || text.includes("cost")) {
    return `For "${item.title}", what measurable business result is true? Give the before/after, percentage, or exact number if you have it.`;
  }
  return `For "${item.title}", what specific evidence should I use so the rewrite does not invent anything?`;
}

function answerEditQuestion(change: ResumeEditChange, answer: string): ResumeEditChange {
  return {
    ...change,
    answer,
    status: "ready",
    after: `${change.recommendation.replace(/\.$/, "")}, backed by: ${answer}.`,
  };
}

function buildImprovedResumeDraft({
  arenaResult,
  targetRole,
  targetCompany,
  usableChanges,
  blockedChanges,
  metricAnswerMap,
}: {
  arenaResult: ArenaResult;
  targetRole: string;
  targetCompany: string;
  usableChanges: ResumeEditChange[];
  blockedChanges: ResumeEditChange[];
  metricAnswerMap: Record<string, string>;
}) {
  const agentBullets = arenaResult.scorecards.flatMap((scorecard) => scorecard.bullet_rewrites);

  return [
    "IMPROVED RESUME WORKING DRAFT",
    "",
    "Target",
    `${targetRole || "Target role"}${targetCompany ? ` at ${targetCompany}` : ""}`,
    "",
    "Verified Improvements",
    ...(usableChanges.length
      ? usableChanges.map((change) => {
          const answer = metricAnswerMap[change.id] || change.answer;
          return `- ${answer ? `${change.after} Proof: ${answer}` : change.after}`;
        })
      : ["- No verified edits are ready yet. Answer the Copilot questions first."]),
    "",
    "Agent Bullet Rewrite Suggestions",
    ...(agentBullets.length ? agentBullets.map((bullet) => `- ${bullet}`) : ["- No direct bullet rewrites were returned by the agents."]),
    "",
    "Needs Your Confirmation",
    ...(blockedChanges.length
      ? blockedChanges.map((change) => `- ${change.question ?? change.title}`)
      : ["- No unresolved proof questions right now."]),
  ].join("\n");
}

function slugifyForDownload(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "resume"
  );
}

function rewriteFromFeedback(item: FeedbackItem) {
  const recommendation = item.recommendation.replace(/\s+/g, " ").trim();
  if (!recommendation) {
    return "Rewrite ready once the exact resume line is selected.";
  }
  return recommendation.endsWith(".") ? recommendation : `${recommendation}.`;
}

function inferSource(arenaResult: ArenaResult, item: FeedbackItem) {
  const owner = arenaResult.scorecards.find((scorecard) =>
    [
      ...scorecard.change_suggestions,
      ...scorecard.add_suggestions,
      ...scorecard.formatting_improvements,
      ...scorecard.red_flags,
    ].some((feedback) => feedback.title === item.title),
  );

  return owner?.agent_name || "Council";
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
