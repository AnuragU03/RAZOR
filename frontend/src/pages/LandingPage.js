import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

/* ── Scroll reveal hook ── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.unobserve(el); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", style, as: Tag = "div", ...props }) {
  const ref = useReveal();
  return <Tag ref={ref} className={`reveal ${className}`} style={style} {...props}>{children}</Tag>;
}

/* ── Stat counter ── */
function StatCard({ target, color, label, delay = 0 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !counted.current) {
        counted.current = true;
        el.classList.add("counted");
        let start = 0;
        const step = target / (1200 / 16);
        const iv = setInterval(() => {
          start = Math.min(start + step, target);
          setValue(Math.round(start));
          if (start >= target) clearInterval(iv);
        }, 16);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="stat-card bg-white border-4 border-black shadow-neo p-4 text-center" style={{ transitionDelay: `${delay}s` }}>
      <div className={`font-display font-bold text-4xl ${color}`}>{value}%</div>
      <div className="text-xs font-bold mt-1">{label}</div>
    </div>
  );
}

/* ── Pipeline step cycling ── */
function PipelineCycler({ steps, colorClass }) {
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActiveIdx((prev) => (prev + 1) % steps.length), 900);
    return () => clearInterval(iv);
  }, [steps.length]);

  return (
    <ul className="text-sm space-y-2">
      {steps.map((s, i) => {
        let cls = `pipe-item ${colorClass} flex items-center gap-2`;
        if (i < activeIdx) cls += " done";
        if (i === activeIdx) cls += " active";
        return <li key={s} className={cls}><i className="bi bi-arrow-right"></i> {s}</li>;
      })}
    </ul>
  );
}

/* ── Partner card with stagger ── */
function PartnerCard({ icon, name, desc, url, delay }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add("visible"); obs.unobserve(el); }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="partner-stagger bg-white text-black border-4 border-black shadow-neo p-6 hover:-translate-y-2 transition-transform" style={{ animationDelay: `${delay}ms` }}>
      <div className="bg-neo-black w-12 h-12 mb-4 flex items-center justify-center">
        <i className={`bi ${icon} text-white text-2xl`}></i>
      </div>
      <h3 className="font-bold text-xl mb-2">{name}</h3>
      <p className="text-sm">{desc}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-neo-blue font-bold mt-2 block">{url.replace("https://", "")} ↗</a>
    </div>
  );
}

/* ── Problem bar animation ── */
function ProblemBar() {
  const ref = useRef(null);
  const [width, setWidth] = useState("0%");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setWidth("85%"); obs.unobserve(el); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref}>
      <div className="h-2 w-full bg-gray-200 border-2 border-black rounded-full overflow-hidden">
        <div className="h-full bg-neo-red" style={{ width, transition: "width 1.5s ease" }}></div>
      </div>
      <p className="text-xs font-bold mt-2 text-right">85% Stale Docs</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Typewriter state
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [showCursor, setShowCursor] = useState(false);
  const typewriterDone = useRef(false);

  useEffect(() => {
    if (typewriterDone.current) return;
    typewriterDone.current = true;
    const text1 = "Finished Engineering";
    const text2 = "Outcomes.";
    let i = 0;
    const t1 = setInterval(() => {
      if (i < text1.length) { setLine1(text1.slice(0, i + 1)); i++; }
      else {
        clearInterval(t1);
        let j = 0;
        setTimeout(() => {
          const t2 = setInterval(() => {
            if (j < text2.length) { setLine2(text2.slice(0, j + 1)); j++; }
            else { clearInterval(t2); setShowCursor(true); }
          }, 60);
        }, 200);
      }
    }, 45);
  }, []);

  // Terminal state
  const [termLines, setTermLines] = useState([
    { text: "# Waiting for repository input...", color: "text-gray-500" },
    { text: "> Connect GitHub Repo", color: "text-white" },
    { text: "> Detect CI status", color: "text-white" },
  ]);
  const [statusBadge, setStatusBadge] = useState({ visible: false, text: "", className: "" });
  const [progressStep, setProgressStep] = useState(-1);
  const [progressLabel, setProgressLabel] = useState("_");
  const [showCodeTrace, setShowCodeTrace] = useState(false);
  const [codeLines, setCodeLines] = useState([
    { id: 0, text: "  const userId = req.params.id", cls: "text-gray-400" },
    { id: 1, text: "  const user = await db.getUser(userId)", cls: "text-gray-400" },
    { id: 2, text: "  const token = user.authToken        // line 42", cls: "text-gray-400" },
    { id: 3, text: "  return token.value", cls: "text-gray-400" },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const outputRef = useRef(null);

  const addLine = useCallback((text, color, delay) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setTermLines((prev) => [...prev, { text, color }]);
        setTimeout(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, 50);
        resolve();
      }, delay);
    });
  }, []);

  const runSimulation = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setTermLines([]);
    setShowCodeTrace(false);
    setCodeLines([
      { id: 0, text: "  const userId = req.params.id", cls: "text-gray-400" },
      { id: 1, text: "  const user = await db.getUser(userId)", cls: "text-gray-400" },
      { id: 2, text: "  const token = user.authToken        // line 42", cls: "text-gray-400" },
      { id: 3, text: "  return token.value", cls: "text-gray-400" },
    ]);
    setProgressStep(-1);

    setStatusBadge({ visible: true, text: "INITIALIZING", className: "bg-yellow-400 text-black" });
    setProgressLabel("init...");
    await addLine("> Initializing EngineOps Runtime v2.4.0...", "text-white", 300);
    await addLine("> Loading CPG engine for repo: user/demo-repo...", "text-gray-400", 700);

    setStatusBadge({ visible: true, text: "UNSILOED PARSER", className: "bg-indigo-500 text-white" });
    setProgressStep(0);
    setProgressLabel("parsing unstructured files...");
    await addLine('> <span class="text-indigo-400">UNSILOED:</span> Scanning repo for PDFs, READMEs, docs...', "text-white", 600);
    await addLine("> 4 unstructured files parsed and indexed into ChromaDB.", "text-green-400", 800);

    setStatusBadge({ visible: true, text: "READING REPO", className: "bg-blue-400 text-white" });
    setProgressStep(1);
    setProgressLabel("reading repo...");
    await addLine('> <span class="text-purple-400">AGENT:</span> Code Reader connected.', "text-white", 600);
    await addLine("> Analyzing 420 source files...", "text-white", 500);
    await addLine("> Building Code Property Graph (AST + CFG + PDG)...", "text-gray-400", 700);
    await addLine("> CPG complete — 1,842 nodes, 3,210 edges indexed.", "text-green-400", 600);

    setStatusBadge({ visible: true, text: "TRACING BUG", className: "bg-red-400 text-white" });
    setProgressStep(2);
    setProgressLabel("tracing root cause...");
    await addLine('> <span class="text-red-400">ALERT:</span> CI Failure detected — commit 8f3a92.', "text-white", 500);
    await addLine("> Tracing via CPG data flow graph...", "text-white", 500);

    // Bug trace animation
    setShowCodeTrace(true);
    await new Promise((resolve) => {
      setTimeout(() => {
        setCodeLines((prev) => prev.map((l) => l.id === 2 ? { ...l, cls: "code-line bug-hit" } : l));
        setTimeout(() => {
          setCodeLines((prev) => prev.map((l) => {
            if (l.id === 2) return { ...l, text: '  const token = user?.authToken ?? null  <span style="color:#10B981;font-size:10px;"> // PATCHED ✓</span>', cls: "code-line bug-fix" };
            if (l.id === 3) return { ...l, cls: "code-line bug-fix" };
            return l;
          }));
          resolve();
        }, 1400);
      }, 400);
    });

    setProgressStep(3);
    setProgressLabel("generating patches...");
    await addLine("> Root cause confirmed: null dereference at AuthController.ts:42", "text-yellow-400", 400);
    await addLine("> Querying RAG for similar fix patterns...", "text-white", 500);
    await addLine("> Generating 3 candidate patches...", "text-white", 600);
    await addLine('> Patch #1: Testing in sandbox...  <span class="text-red-400">FAILED</span>', "text-white", 700);
    await addLine('> Patch #2: Testing in sandbox...  <span class="text-green-400">PASSED</span>', "text-white", 600);

    setStatusBadge({ visible: true, text: "GEARSEC POLICY", className: "bg-yellow-500 text-black" });
    setProgressStep(4);
    setProgressLabel("policy check...");
    await addLine('> <span class="text-yellow-400">GEARSEC:</span> Running pre-merge policy enforcement...', "text-white", 600);
    await addLine("> 4 policies checked — 0 violations, 0 warnings.", "text-green-400", 500);
    await addLine("> Policy gate: PASSED", "text-green-400", 300);

    setStatusBadge({ visible: true, text: "WRITING DOCS", className: "bg-purple-500 text-white" });
    setProgressStep(5);
    setProgressLabel("publishing docs...");
    await addLine('> <span class="text-orange-400">SAFEDEP:</span> Running dependency security scan...', "text-white", 500);
    await addLine("> 24 dependencies scanned — 2 vulnerabilities found.", "text-yellow-400", 500);
    await addLine("> Security section appended to docs.", "text-gray-400", 400);
    await addLine("> Compiling documentation site with MkDocs...", "text-white", 500);
    await addLine("> Deploying to GitHub Pages...", "text-gray-400", 400);

    setStatusBadge({ visible: true, text: "SHIPPED", className: "bg-green-500 text-white" });
    setProgressStep(6);
    setProgressLabel("done.");
    await addLine('> <span class="text-green-400 font-bold">SUCCESS:</span> PR #482 Created & Merged via GitHub API.', "text-white", 400);
    await addLine('> <span class="text-green-400 font-bold">SUCCESS:</span> Docs live at https://docs.engineops.dev/demo', "text-white", 400);
    await addLine('> <span class="text-purple-400">S2.dev:</span> Full audit trail logged — 18 agent steps recorded.', "text-gray-400", 400);
    await addLine('> <span class="text-teal-400">CONCIERGE:</span> Team notified via Slack.', "text-gray-400", 400);

    setIsRunning(false);
  }, [isRunning, addLine]);

  const handleSubmit = (e) => { e.preventDefault(); setSubmitted(true); };

  return (
    <div className="neo-bg-paper text-neo-black overflow-x-hidden" data-testid="landing-page">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FFFAF0] border-b-4 border-black px-6 py-4 flex justify-between items-center" data-testid="navbar">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-neo-purple border-2 border-black shadow-neo-sm flex items-center justify-center">
            <i className="bi bi-cpu-fill text-white text-xl"></i>
          </div>
          <span className="font-display font-bold text-2xl tracking-tighter">EngineOps</span>
        </div>
        <div className="hidden md:flex gap-8 font-bold text-sm tracking-wide">
          <a href="#problem" className="hover:text-neo-purple transition-colors">THE PROBLEM</a>
          <a href="#how-it-works" className="hover:text-neo-purple transition-colors">HOW IT WORKS</a>
          <a href="#moat" className="hover:text-neo-purple transition-colors">DEFENSIBILITY</a>
          <a href="#demo" className="hover:text-neo-purple transition-colors">DEMO</a>
        </div>
        <button onClick={() => navigate("/dashboard")} className="neo-button bg-neo-black text-white px-6 py-2 font-bold border-2 border-black shadow-neo-sm hover:bg-neo-purple transition-colors" data-testid="dashboard-nav-btn">
          DASHBOARD
        </button>
      </nav>

      {/* Hero */}
      <header className="container mx-auto px-6 pt-16 pb-16 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 z-10">
            <Reveal className="inline-block bg-neo-yellow border-2 border-black px-4 py-1 font-bold text-sm shadow-neo-sm transform -rotate-2">
              YC Spring 2026: AI-Native Agency — From Assistant to Operator
            </Reveal>

            <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight" data-testid="hero-heading">
              {line1}<br />
              <span className="bg-neo-green text-white px-2">{line2}</span>
              {showCursor && <span className="cursor"></span>}
            </h1>

            {/* Stat counters */}
            <div className="grid grid-cols-3 gap-4 my-4" data-testid="stat-counters">
              <StatCard target={30} color="text-neo-red" label="time on bug loops" delay={0} />
              <StatCard target={64} color="text-neo-blue" label="docs are stale" delay={0.15} />
              <StatCard target={80} color="text-neo-purple" label="cost is maintenance" delay={0.3} />
            </div>

            <Reveal className="text-base md:text-lg font-medium leading-relaxed max-w-xl border-l-[6px] border-neo-purple pl-6 py-2 bg-white bg-opacity-50">
              EngineOps takes a GitHub repository and a failing CI run and returns two shipped outcomes: a live documentation site and a validated bug-fix pull request.
            </Reveal>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={runSimulation} className="neo-button bg-neo-blue text-white px-8 py-4 font-bold text-lg border-2 border-black shadow-neo" data-testid="see-it-run-btn">
                <i className="bi bi-play-fill mr-2"></i> SEE IT RUN
              </button>
              <button onClick={() => navigate("/dashboard")} className="neo-button bg-white text-black px-8 py-4 font-bold text-lg border-2 border-black shadow-neo flex items-center justify-center" data-testid="try-dashboard-btn">
                TRY DASHBOARD
              </button>
            </div>
          </div>

          {/* Terminal */}
          <div className="relative">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-neo-red rounded-full border-4 border-black z-0"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-neo-yellow border-4 border-black z-0 flex items-center justify-center font-display font-bold text-xl transform rotate-12">NO TRAINING</div>

            <div className="relative z-10 bg-neo-black text-green-400 font-mono text-sm p-0 border-4 border-black shadow-neo-lg rounded-sm overflow-hidden min-h-[420px]" data-testid="hero-terminal">
              <div className="bg-gray-800 p-2 border-b-2 border-gray-600 flex gap-2 items-center">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-2 text-gray-400 text-xs flex-1">engineops-agent-runtime</span>
                {statusBadge.visible && (
                  <span className={`status-badge font-bold text-xs px-3 py-1 border-2 border-black ${statusBadge.className}`} data-testid="terminal-status">
                    {statusBadge.text}
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col" style={{ minHeight: 320 }}>
                <div ref={outputRef} className="space-y-1 flex-grow overflow-y-auto hide-scrollbar" style={{ maxHeight: 280 }}>
                  {termLines.map((line, i) => (
                    <p key={i} className={`${line.color} font-mono text-xs`} dangerouslySetInnerHTML={{ __html: line.text }} />
                  ))}
                </div>
                {/* Bug trace code block */}
                {showCodeTrace && (
                  <div className="mt-3 bg-gray-900 border border-gray-700 p-2" data-testid="code-trace-block">
                    <p className="text-xs text-gray-500 mb-2"># AuthController.ts — Agent tracing root cause</p>
                    {codeLines.map((l) => (
                      <div key={l.id} className={`code-line ${l.cls}`} dangerouslySetInnerHTML={{ __html: l.text }} />
                    ))}
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  {/* Progress segments */}
                  <div className="mb-2 flex gap-1 h-2 border border-gray-700 overflow-hidden" data-testid="progress-segments">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className={`seg ${i < progressStep ? "done-seg" : ""} ${i === progressStep ? "active-seg" : ""}`}></div>
                    ))}
                  </div>
                  <span className="text-neo-purple text-xs">{progressLabel === "_" ? <span className="cursor">_</span> : progressLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Dual Marquee */}
      <div className="bg-neo-black text-white border-t-4 border-b-4 border-black overflow-hidden">
        <div className="py-3 marquee-container font-display font-bold text-xl">
          <div className="marquee">FROM ASSISTANT TO OPERATOR &bull; SHIPPED OUTCOMES NOT SUGGESTIONS &bull; AI-NATIVE AGENCY &bull; NO MODEL TRAINING &bull; CPG + RAG ARCHITECTURE &bull; SECURE BY DEFAULT &bull; AUTOMATED PR &bull; LIVE DOCS &bull;&nbsp;</div>
        </div>
        <div className="py-2 marquee-container font-display font-bold text-sm border-t border-gray-700" style={{ background: "#111" }}>
          <div className="marquee-rev" style={{ color: "#A855F7" }}>EMERGENT AI &bull; S2.DEV &bull; SAFEDEP &bull; GEARSEC &bull; CONCIERGE &bull; JOERN CPG &bull; CHROMADB RAG &bull; CLAUDE API &bull; GITHUB ACTIONS &bull;&nbsp;</div>
        </div>
      </div>

      {/* Problem Section */}
      <section id="problem" className="py-24 px-6 bg-white border-b-4 border-black" data-testid="problem-section">
        <div className="container mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="font-display font-bold text-4xl sm:text-5xl mb-6">The "Engineering Drag"</h2>
            <p className="text-base md:text-lg max-w-3xl mx-auto">Software teams keep losing time to two forms of engineering drag. Industry data shows large amounts of engineering time going into bugs, rework, and tool friction instead of shipping product.</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Reveal className="bg-[#FFFAF0] border-4 border-black shadow-neo p-8 relative overflow-hidden" data-testid="problem-card-docs">
              <div className="absolute top-0 right-0 bg-neo-red text-white font-bold px-4 py-2 border-l-4 border-b-4 border-black">PROBLEM 01</div>
              <h3 className="font-display font-bold text-3xl mb-4 mt-8">Documentation Debt</h3>
              <p className="text-lg leading-relaxed mb-6">Docs go stale quickly. Existing tools help write or host docs, but do not <span className="bg-neo-red text-white px-1">autonomously produce and publish</span> a finished documentation hub.</p>
              <ProblemBar />
            </Reveal>
            <Reveal className="bg-[#FFFAF0] border-4 border-black shadow-neo p-8 relative overflow-hidden" style={{ transitionDelay: "0.15s" }} data-testid="problem-card-bugs">
              <div className="absolute top-0 right-0 bg-neo-red text-white font-bold px-4 py-2 border-l-4 border-b-4 border-black">PROBLEM 02</div>
              <h3 className="font-display font-bold text-3xl mb-4 mt-8">Manual Bug Resolution</h3>
              <p className="text-lg leading-relaxed mb-6">Failed CI triggers a repetitive human loop: parse logs, trace root cause, patch, rerun, review, repeat. Still relies on humans to choose, validate, and merge. This is <span className="bg-neo-red text-white px-1">expensive</span>.</p>
              <div className="flex gap-2 items-center mt-4">
                <i className="bi bi-x-circle-fill text-neo-red text-2xl"></i>
                <span className="font-mono font-bold bg-black text-red-500 px-2 py-1">BUILD FAILED (Exit Code 1)</span>
              </div>
            </Reveal>
          </div>
          <Reveal className="mt-12 text-center">
            <div className="inline-block bg-neo-red text-white px-6 py-3 border-4 border-black shadow-neo font-bold text-lg">
              That gap is exactly where EngineOps fits: it sells finished engineering outcomes, not software seats.
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why Now */}
      <section className="py-16 px-6 bg-neo-yellow border-b-4 border-black" data-testid="why-now-section">
        <div className="container mx-auto max-w-4xl text-center">
          <Reveal className="inline-block bg-black text-white px-4 py-2 font-bold mb-6 border-2 border-black">WHY NOW</Reveal>
          <Reveal><h2 className="font-display font-bold text-4xl mb-6">YC Spring 2026: AI-Native Agencies</h2></Reveal>
          <Reveal><p className="text-base md:text-lg mb-8">YC explicitly called out AI-Native Agencies as businesses that use AI to do the labor themselves and sell finished outputs, not software subscriptions.</p></Reveal>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { icon: "bi-robot", color: "text-neo-purple", title: "AI-Native Engineering Agency", desc: "We don't sell seats. We ship outcomes." },
              { icon: "bi-check-circle-fill", color: "text-neo-green", title: "Done-For-You Service", desc: "Reliability and documentation handled autonomously." },
              { icon: "bi-cash-stack", color: "text-neo-blue", title: "Delivered Outcomes", desc: "Monetize on shipped work, not user licenses." },
            ].map((item, i) => (
              <Reveal key={item.title} className="bg-white border-4 border-black p-6 shadow-neo" style={{ transitionDelay: `${i * 0.1}s` }}>
                <i className={`bi ${item.icon} text-4xl ${item.color} mb-4 block`}></i>
                <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                <p>{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works — with pipeline cycling */}
      <section id="how-it-works" className="py-24 px-6 bg-neo-blue border-b-4 border-black relative" data-testid="how-it-works-section">
        <div className="absolute inset-0 opacity-10 grid-pattern"></div>
        <div className="container mx-auto relative z-10">
          <Reveal className="bg-white border-4 border-black shadow-neo-lg p-8 md:p-12">
            <div className="mb-12">
              <h2 className="font-display font-bold text-4xl sm:text-5xl mb-4">The EngineOps Pipeline</h2>
              <p className="text-base md:text-lg">A multi-agent system with two production pipelines. From repo and CI failure to shipped outcomes.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between">
              <div className="flex-1 min-w-[180px] flex flex-col gap-4">
                <div className="bg-neo-black text-white p-6 border-2 border-black shadow-neo">
                  <h4 className="font-bold text-lg mb-2"><i className="bi bi-github"></i> Repository</h4>
                  <div className="bg-gray-800 h-2 w-full mb-2"></div>
                  <div className="bg-gray-800 h-2 w-2/3"></div>
                </div>
                <div className="bg-neo-red text-white p-6 border-2 border-black shadow-neo">
                  <h4 className="font-bold text-lg mb-2"><i className="bi bi-bug-fill"></i> CI Failure</h4>
                  <p className="font-mono text-xs">NullReferenceException: line 42</p>
                </div>
              </div>
              <div className="md:w-16 flex items-center justify-center py-4 md:py-0">
                <i className="bi bi-arrow-right text-4xl font-bold hidden md:block"></i>
                <i className="bi bi-arrow-down text-4xl font-bold md:hidden"></i>
              </div>
              <div className="flex-[2] bg-[#f0f0f0] border-4 border-black p-6 relative">
                <div className="absolute -top-6 left-6 bg-neo-purple text-white px-4 py-1 font-bold border-2 border-black">RUNTIME AGENTS</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="border-2 border-black bg-white p-4">
                    <h5 className="font-bold text-neo-blue mb-3">DOCS PIPELINE</h5>
                    <PipelineCycler steps={["Unsiloed Parser", "Code Reader", "RAG Writer", "Editor", "Safedep MCP", "Compiler", "Deployer", "Concierge"]} colorClass="text-neo-blue" />
                  </div>
                  <div className="border-2 border-black bg-white p-4">
                    <h5 className="font-bold text-neo-green mb-3">BUG-RESOLUTION PIPELINE</h5>
                    <PipelineCycler steps={["Unsiloed Parser", "Log Parser", "Patch Generator", "Sandbox Tester", "Selector", "Gearsec MCP", "Merger", "Concierge"]} colorClass="text-neo-green" />
                  </div>
                </div>
                <div className="mt-6 bg-black text-white text-center py-2 font-mono text-xs border border-white">
                  POWERED BY: CPG + RAG + CLAUDE API — NO MODEL TRAINING REQUIRED
                </div>
              </div>
              <div className="md:w-16 flex items-center justify-center py-4 md:py-0">
                <i className="bi bi-arrow-right text-4xl font-bold hidden md:block"></i>
                <i className="bi bi-arrow-down text-4xl font-bold md:hidden"></i>
              </div>
              <div className="flex-1 min-w-[180px] flex flex-col gap-4">
                <div className="bg-neo-blue text-white p-6 border-2 border-black shadow-neo">
                  <h4 className="font-bold text-lg mb-2"><i className="bi bi-book-half"></i> Live Docs</h4>
                  <p className="text-xs">Published Documentation Hub</p>
                </div>
                <div className="bg-neo-green text-white p-6 border-2 border-black shadow-neo">
                  <h4 className="font-bold text-lg mb-2"><i className="bi bi-git"></i> Fixed PR</h4>
                  <p className="text-xs">Validated &amp; Merged</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Tech Deep Dive — CPG graph with animated dashed lines */}
      <section className="py-24 px-6 bg-[#FFFAF0] border-b-4 border-black" data-testid="tech-section">
        <div className="container mx-auto">
          <Reveal className="text-center mb-12">
            <div className="inline-block bg-neo-purple text-white px-4 py-2 font-bold mb-4 border-2 border-black">NO MODEL TRAINING REQUIRED</div>
            <h2 className="font-display font-bold text-4xl sm:text-5xl mb-6">How It Actually Understands a Repo</h2>
            <p className="text-base md:text-lg max-w-3xl mx-auto">Don't train a custom model to understand a repo. Build a precise map of the repo, then let a strong model navigate it at runtime.</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal><h2 className="font-display font-bold text-4xl mb-6">Not "File Scanning".<br />Structural Understanding.</h2></Reveal>
              <Reveal><p className="text-lg mb-6">EngineOps works through a three-layer runtime stack:</p></Reveal>
              <div className="space-y-6">
                {[
                  { num: "1", title: "Foundation Model Reasoning", desc: "Via Claude API — powerful reasoning over structured context." },
                  { num: "2", title: "Code Property Graph (CPG)", desc: "Builds an exact structural map: AST + CFG + PDG merged into one queryable graph." },
                  { num: "3", title: "RAG Over Graph", desc: "Each agent retrieves only the relevant nodes, edges, signatures, and call paths for the task at hand." },
                ].map((item, i) => (
                  <Reveal key={item.num} className="flex gap-4 items-start" style={{ transitionDelay: `${i * 0.1}s` }}>
                    <div className="bg-neo-purple text-white w-10 h-10 flex items-center justify-center font-bold border-2 border-black flex-shrink-0">{item.num}</div>
                    <div><h4 className="font-bold text-xl">{item.title}</h4><p>{item.desc}</p></div>
                  </Reveal>
                ))}
              </div>
              <div className="mt-8 p-4 bg-neo-yellow border-4 border-black shadow-neo">
                <p className="font-bold text-lg">That is a much stronger story than "AI reads the codebase."</p>
              </div>
            </div>
            <Reveal className="relative bg-white border-4 border-black aspect-square p-8 shadow-neo flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full">
                <div className="absolute top-10 left-10 w-16 h-16 bg-neo-yellow border-2 border-black rounded-full flex items-center justify-center font-bold text-xs shadow-neo-sm cpg-node-active">AST</div>
                <div className="absolute bottom-20 right-20 w-16 h-16 bg-neo-green border-2 border-black rounded-full flex items-center justify-center font-bold text-xs shadow-neo-sm text-white" style={{ animationDelay: "0.4s" }}>PDG</div>
                <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-neo-blue border-2 border-black rounded-full flex items-center justify-center font-bold text-sm shadow-neo transform -translate-x-1/2 -translate-y-1/2 z-10 text-white" style={{ animationDelay: "0.8s" }}>CFG<br /><span className="text-xs font-normal">Central</span></div>
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <line x1="22%" y1="22%" x2="50%" y2="50%" stroke="black" strokeWidth="2" strokeDasharray="4 4">
                    <animate attributeName="stroke-dashoffset" values="0;-8" dur="1s" repeatCount="indefinite" />
                  </line>
                  <line x1="78%" y1="72%" x2="50%" y2="50%" stroke="black" strokeWidth="2" strokeDasharray="4 4">
                    <animate attributeName="stroke-dashoffset" values="0;8" dur="1.2s" repeatCount="indefinite" />
                  </line>
                </svg>
                <div className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 font-mono text-xs uppercase border border-white">
                  Agent Traversing Graph...
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Defensibility */}
      <section className="py-24 px-6 bg-white border-b-4 border-black" data-testid="defensibility-section">
        <div className="container mx-auto">
          <Reveal><h2 className="font-display font-bold text-4xl sm:text-5xl mb-4 text-center">What Makes EngineOps Defensible</h2></Reveal>
          <Reveal><p className="text-base md:text-lg text-center mb-12 max-w-3xl mx-auto">Four core differentiators that create a real moat in the AI engineering space.</p></Reveal>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              { num: "1", color: "bg-neo-purple", title: "Structural Understanding", desc: "CPG-backed structural model — materially better for architecture understanding, call tracing, and patch reasoning than any file-scanning tool." },
              { num: "2", color: "bg-neo-green", title: "Execution-Backed Autonomy", desc: "The bug pipeline tests candidate fixes in a sandbox and automatically selects the passing patch before PR creation." },
              { num: "3", color: "bg-neo-blue", title: "Two High-Value Outcomes", desc: "Most tools solve either docs or debugging. EngineOps solves both from the same repo context." },
              { num: "4", color: "bg-neo-red", title: "Trust & Governance", desc: "Safedep, Gearsec, Concierge, and S2.dev add security posture, policy enforcement, session isolation, and durable audit trails." },
            ].map((item, i) => (
              <Reveal key={item.num} className="bg-[#FFFAF0] border-4 border-black shadow-neo p-8" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`${item.color} text-white w-12 h-12 flex items-center justify-center font-bold text-xl border-2 border-black`}>{item.num}</div>
                  <h3 className="font-bold text-2xl">{item.title}</h3>
                </div>
                <p className="text-lg">{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="moat" className="py-24 px-6 bg-neo-purple text-white border-b-4 border-black" data-testid="partners-section">
        <div className="container mx-auto">
          <Reveal><h2 className="font-display font-bold text-4xl sm:text-5xl mb-12 text-center">Trust &amp; Governance Built-in</h2></Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PartnerCard icon="bi-shield-lock-fill" name="Safedep" desc="Adds dependency security posture into published docs via hosted MCP server." url="https://safedep.io" delay={0} />
            <PartnerCard icon="bi-gear-wide-connected" name="Gearsec" desc="Pre-merge policy enforcement and SDLC compliance checks before every PR." url="https://gearsec.io" delay={100} />
            <PartnerCard icon="bi-person-badge-fill" name="Concierge" desc="Session isolation, progressive tool disclosure, and team notifications." url="https://getconcierge.app" delay={200} />
            <PartnerCard icon="bi-camera-reels-fill" name="S2.dev" desc="Durable replayable agent-to-agent streams and full audit trail." url="https://s2.dev" delay={300} />
          </div>
        </div>
      </section>

      {/* Demo Framing */}
      <section id="demo" className="py-16 px-6 bg-neo-black text-white border-b-4 border-black" data-testid="demo-section">
        <div className="container mx-auto max-w-4xl">
          <Reveal><h2 className="font-display font-bold text-4xl mb-8 text-center">Demo Framing for Judges</h2></Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { num: "1", color: "text-neo-yellow", title: "Input & Analyze", desc: "Input a repo with a deliberate failing test. EngineOps builds a CPG-structural understanding instantly." },
              { num: "2", color: "text-neo-blue", title: "Documentation Pipeline", desc: "One pipeline publishes a live documentation site — including a Safedep security section — automatically." },
              { num: "3", color: "text-neo-green", title: "Bug Resolution Pipeline", desc: "Traces the failure via CPG, generates patches via RAG, validates in sandbox, merges the winner." },
              { num: "4", color: "text-neo-purple", title: "Full Audit Trail", desc: "The full run is replayable through the S2.dev agent stream audit trail. Every step timestamped." },
            ].map((item, i) => (
              <Reveal key={item.num} className="bg-gray-900 border-2 border-gray-700 p-6" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="flex items-center gap-3 mb-4">
                  <i className={`bi bi-${item.num}-circle-fill ${item.color} text-2xl`}></i>
                  <h3 className="font-bold text-xl">{item.title}</h3>
                </div>
                <p>{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-neo-yellow border-b-4 border-black text-center" data-testid="cta-section">
        <div className="container mx-auto max-w-4xl">
          <Reveal><h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl mb-8 leading-tight">Stop Acting as the Assistant.<br />Start Acting as the Operator.</h2></Reveal>
          <Reveal className="bg-white border-4 border-black p-6 shadow-neo mb-10 max-w-3xl mx-auto">
            <p className="text-lg font-bold mb-4">50-Word Submission (YC Spring 2026):</p>
            <p className="text-base md:text-lg italic">"Engineering teams lose time to two chronic problems: stale documentation and manual CI bug fixing. EngineOps is a multi-agent system that takes a repo and failed CI log, then ships two outcomes: a live docs site and a validated bug-fix PR. It uses CPG + RAG, not model training."</p>
          </Reveal>
          <Reveal as="form" onSubmit={handleSubmit} className="bg-white border-4 border-black p-8 shadow-neo-lg max-w-md mx-auto text-left" data-testid="waitlist-form">
            {submitted ? (
              <div className="text-center py-8">
                <i className="bi bi-check-circle-fill text-neo-green text-5xl mb-4 block"></i>
                <h3 className="font-bold text-2xl mb-2">You're on the list!</h3>
                <p>We'll reach out when it's your turn.</p>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-2xl mb-4">Request Access</h3>
                <div className="mb-4">
                  <label className="block font-bold mb-2 text-sm uppercase">Work Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="w-full bg-[#f0f0f0] border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-neo-purple font-mono" data-testid="waitlist-email" required />
                </div>
                <div className="mb-6">
                  <label className="block font-bold mb-2 text-sm uppercase">GitHub Organization</label>
                  <input type="text" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="github.com/your-org" className="w-full bg-[#f0f0f0] border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-neo-purple font-mono" data-testid="waitlist-org" />
                </div>
                <button type="submit" className="w-full neo-button bg-neo-black text-white font-bold p-4 border-2 border-black shadow-neo hover:bg-neo-purple" data-testid="waitlist-submit-btn">JOIN WAITLIST</button>
              </>
            )}
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white text-black py-12 px-6" data-testid="footer">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-neo-purple border-2 border-black flex items-center justify-center">
              <i className="bi bi-cpu-fill text-white"></i>
            </div>
            <span className="font-display font-bold text-xl tracking-tighter">EngineOps</span>
          </div>
          <div className="flex gap-6 font-bold text-sm">
            <span className="cursor-pointer hover:underline" onClick={() => navigate("/dashboard")}>Dashboard</span>
            <a href="#how-it-works" className="hover:underline">How It Works</a>
            <a href="#demo" className="hover:underline">Demo</a>
          </div>
          <div className="text-xs font-mono text-gray-500">&copy; 2026 EngineOps Inc. All systems autonomous.</div>
        </div>
      </footer>
    </div>
  );
}
