import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function TerminalLine({ text, color }) {
  return <p className={`${color} font-mono`} dangerouslySetInnerHTML={{ __html: text }} />;
}

function HeroTerminal() {
  const [lines, setLines] = useState([
    { text: "# Waiting for repository input...", color: "text-gray-500" },
    { text: "> Connect GitHub Repo...", color: "text-white" },
    { text: "> Detect CI status...", color: "text-white" },
  ]);
  const [statusBadge, setStatusBadge] = useState({ visible: false, text: "", bg: "" });
  const [isRunning, setIsRunning] = useState(false);
  const outputRef = useRef(null);

  const addLine = useCallback((text, color, delay) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setLines((prev) => [...prev, { text, color }]);
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
        resolve();
      }, delay);
    });
  }, []);

  const runSimulation = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLines([]);
    setStatusBadge({ visible: true, text: "INITIALIZING", bg: "bg-yellow-400 text-black animate-pulse" });

    await addLine("> Initializing EngineOps Runtime v2.4.0...", "text-white", 500);
    await addLine("> Loading CPG Model for repo: user/demo-repo...", "text-gray-400", 800);
    await addLine('> <span class="text-neo-purple">AGENT START:</span> Code Reader connected.', "text-white", 1200);

    setStatusBadge({ visible: true, text: "READING REPO", bg: "bg-blue-400 text-black animate-pulse" });
    await addLine("> Analyzing 420 source files...", "text-white", 800);
    await addLine('> <span class="text-red-500">ALERT:</span> Detected CI Failure triggered by commit 8f3a92.', "text-white", 1000);

    setStatusBadge({ visible: true, text: "TRACING BUG", bg: "bg-red-400 text-black animate-pulse" });
    await addLine("> Tracing root cause via Stack Trace analysis...", "text-white", 1200);
    await addLine("> Root cause identified: Null pointer in AuthController.ts:45", "text-yellow-400", 800);
    await addLine("> Generating 3 candidate patches using Sandbox Tester...", "text-white", 1500);
    await addLine('> Patch #1: Failed. Patch #2: <span class="text-green-500">PASSED</span>.', "text-white", 1200);

    setStatusBadge({ visible: true, text: "WRITING DOCS", bg: "bg-neo-purple text-white animate-pulse" });
    await addLine("> Updating Documentation Hub with new Auth flow context...", "text-white", 1000);
    await addLine("> Compiling static site...", "text-gray-400", 800);

    setStatusBadge({ visible: true, text: "SHIPPED", bg: "bg-green-500 text-white" });
    await addLine('> <span class="text-green-500 font-bold">SUCCESS:</span> PR #482 Created & Merged.', "text-white", 500);
    await addLine('> <span class="text-green-500 font-bold">SUCCESS:</span> Verify at https://docs.engineops.com/demo', "text-white", 500);

    setIsRunning(false);
  }, [isRunning, addLine]);

  return { lines, statusBadge, outputRef, runSimulation, isRunning };
}

export default function LandingPage() {
  const navigate = useNavigate();
  const terminal = HeroTerminal();
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API}/`, { method: "GET" });
    } catch (err) { /* ignore */ }
    setSubmitted(true);
  };

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

      {/* Hero Section */}
      <header className="container mx-auto px-6 pt-16 pb-24 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 z-10">
            <div className="inline-block bg-neo-yellow border-2 border-black px-4 py-1 font-bold text-sm shadow-neo-sm transform -rotate-2">
              YC Spring 2026: AI-Native Agency — From Assistant to Operator
            </div>
            <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight" data-testid="hero-heading">
              Finished Engineering <span className="bg-neo-green text-white px-2">Outcomes.</span><br />
              Zero Human Loops.
            </h1>
            <p className="text-base md:text-lg font-medium leading-relaxed max-w-xl border-l-[6px] border-neo-purple pl-6 py-2 bg-white bg-opacity-50">
              EngineOps is an AI-native engineering operations service that takes a GitHub repository and a failing CI run and returns two shipped outcomes: a live documentation site and a validated bug-fix pull request.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={terminal.runSimulation} className="neo-button bg-neo-blue text-white px-8 py-4 font-bold text-lg border-2 border-black shadow-neo" data-testid="see-it-run-btn">
                <i className="bi bi-play-fill mr-2"></i> SEE IT RUN
              </button>
              <button onClick={() => navigate("/dashboard")} className="neo-button bg-white text-black px-8 py-4 font-bold text-lg border-2 border-black shadow-neo flex items-center justify-center" data-testid="try-dashboard-btn">
                TRY DASHBOARD
              </button>
            </div>
          </div>

          {/* Hero Terminal */}
          <div className="relative">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-neo-red rounded-full border-4 border-black z-0"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-neo-yellow border-4 border-black z-0 flex items-center justify-center font-display font-bold text-xl transform rotate-12">NO TRAINING</div>
            <div className="relative z-10 bg-neo-black text-green-400 font-mono text-sm p-0 border-4 border-black shadow-neo-lg rounded-sm overflow-hidden min-h-[400px]" data-testid="hero-terminal">
              <div className="bg-gray-800 p-2 border-b-2 border-gray-600 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-2 text-gray-400 text-xs">engineops-agent-runtime</span>
              </div>
              <div className="p-6 h-full flex flex-col">
                <div ref={terminal.outputRef} className="space-y-2 flex-grow max-h-[300px] overflow-y-auto hide-scrollbar">
                  {terminal.lines.map((line, i) => (
                    <TerminalLine key={i} text={line.text} color={line.color} />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <span className="text-neo-purple cursor">_</span>
                </div>
              </div>
              {terminal.statusBadge.visible && (
                <div className={`absolute bottom-6 right-6 font-bold px-3 py-1 border-2 border-black ${terminal.statusBadge.bg}`} data-testid="terminal-status">
                  {terminal.statusBadge.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Marquee */}
      <div className="bg-neo-black text-white py-4 border-t-4 border-b-4 border-black overflow-hidden font-display font-bold text-2xl">
        <div className="marquee-container">
          <div className="marquee">
            FROM ASSISTANT TO OPERATOR &bull; SHIPPED OUTCOMES NOT SUGGESTIONS &bull; AI-NATIVE AGENCY &bull; NO MODEL TRAINING &bull; CPG + RAG ARCHITECTURE &bull; SECURE BY DEFAULT &bull; AUTOMATED PR &bull; LIVE DOCS &bull; REAL-TIME FIXES &bull;&nbsp;
          </div>
        </div>
      </div>

      {/* The Problem Section */}
      <section id="problem" className="py-24 px-6 bg-white border-b-4 border-black" data-testid="problem-section">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-4xl sm:text-5xl mb-6">The "Engineering Drag"</h2>
            <p className="text-base md:text-lg max-w-3xl mx-auto">Software teams keep losing time to two forms of engineering drag. This is not just annoying — it is expensive. Industry data shows large amounts of engineering time going into bugs, rework, broken processes, and tool friction, instead of shipping product.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-[#FFFAF0] border-4 border-black shadow-neo p-8 relative overflow-hidden" data-testid="problem-card-docs">
              <div className="absolute top-0 right-0 bg-neo-red text-white font-bold px-4 py-2 border-l-4 border-b-4 border-black">PROBLEM 01</div>
              <h3 className="font-display font-bold text-3xl mb-4 mt-8">Documentation Debt</h3>
              <p className="text-lg leading-relaxed mb-6">Docs go stale quickly, and developers waste time reconstructing system behavior from code and tribal knowledge. Existing tools help teams write or host docs, but do not <span className="bg-neo-red text-white px-1">autonomously produce and publish</span> a finished documentation hub.</p>
              <div className="h-2 w-full bg-gray-200 border-2 border-black rounded-full overflow-hidden">
                <div className="h-full bg-neo-red" style={{ width: "85%" }}></div>
              </div>
              <p className="text-xs font-bold mt-2 text-right">85% Stale Docs</p>
            </div>
            <div className="bg-[#FFFAF0] border-4 border-black shadow-neo p-8 relative overflow-hidden" data-testid="problem-card-bugs">
              <div className="absolute top-0 right-0 bg-neo-red text-white font-bold px-4 py-2 border-l-4 border-b-4 border-black">PROBLEM 02</div>
              <h3 className="font-display font-bold text-3xl mb-4 mt-8">Manual Bug Resolution</h3>
              <p className="text-lg leading-relaxed mb-6">Failed CI still triggers a repetitive human loop: parse logs, trace root cause, patch, rerun, review, repeat. Coding copilots may suggest fixes, but still rely on humans to interpret context, choose the patch, validate it, and merge it. This is <span className="bg-neo-red text-white px-1">expensive</span>.</p>
              <div className="flex gap-2 items-center mt-4">
                <i className="bi bi-x-circle-fill text-neo-red text-2xl"></i>
                <span className="font-mono font-bold bg-black text-red-500 px-2 py-1">BUILD FAILED (Exit Code 1)</span>
              </div>
            </div>
          </div>
          <div className="mt-12 text-center">
            <div className="inline-block bg-neo-red text-white px-6 py-3 border-4 border-black shadow-neo font-bold text-lg">
              That gap is exactly where EngineOps fits: it sells finished engineering outcomes, not software seats.
            </div>
          </div>
        </div>
      </section>

      {/* Why Now */}
      <section className="py-16 px-6 bg-neo-yellow border-b-4 border-black" data-testid="why-now-section">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-block bg-black text-white px-4 py-2 font-bold mb-6 border-2 border-black">WHY NOW</div>
          <h2 className="font-display font-bold text-4xl mb-6">YC Spring 2026: AI-Native Agencies</h2>
          <p className="text-base md:text-lg mb-8">YC explicitly called out AI-Native Agencies as businesses that use AI to do the labor themselves and sell finished outputs, not software subscriptions.</p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-white border-4 border-black p-6 shadow-neo">
              <i className="bi bi-robot text-4xl text-neo-purple mb-4 block"></i>
              <h3 className="font-bold text-xl mb-2">AI-Native Engineering Agency</h3>
              <p>We don't sell seats. We ship outcomes.</p>
            </div>
            <div className="bg-white border-4 border-black p-6 shadow-neo">
              <i className="bi bi-check-circle-fill text-4xl text-neo-green mb-4 block"></i>
              <h3 className="font-bold text-xl mb-2">Done-For-You Service</h3>
              <p>Reliability and documentation handled autonomously.</p>
            </div>
            <div className="bg-white border-4 border-black p-6 shadow-neo">
              <i className="bi bi-cash-stack text-4xl text-neo-blue mb-4 block"></i>
              <h3 className="font-bold text-xl mb-2">Delivered Outcomes</h3>
              <p>Monetize on shipped work, not user licenses.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6 bg-neo-blue border-b-4 border-black relative" data-testid="how-it-works-section">
        <div className="absolute inset-0 opacity-10 grid-pattern"></div>
        <div className="container mx-auto relative z-10">
          <div className="bg-white border-4 border-black shadow-neo-lg p-8 md:p-12">
            <div className="mb-12">
              <h2 className="font-display font-bold text-4xl sm:text-5xl mb-4">The EngineOps Pipeline</h2>
              <p className="text-base md:text-lg">A multi-agent system with two production pipelines requiring zero human intervention. From repo and CI failure to shipped outcomes.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between">
              <div className="flex-1 min-w-[200px] flex flex-col gap-4">
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
                    <h5 className="font-bold text-neo-blue mb-2">DOCS PIPELINE</h5>
                    <ul className="text-sm space-y-2">
                      {["Code Reader", "RAG Writer", "Editor", "Compiler", "Deployer"].map((s) => (
                        <li key={s} className="flex items-center gap-2"><i className="bi bi-arrow-right text-neo-blue"></i> {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-2 border-black bg-white p-4">
                    <h5 className="font-bold text-neo-green mb-2">BUG-RESOLUTION PIPELINE</h5>
                    <ul className="text-sm space-y-2">
                      {["Log Parser", "Patch Generator", "Sandbox Tester", "Selector", "Merger"].map((s) => (
                        <li key={s} className="flex items-center gap-2"><i className="bi bi-arrow-right text-neo-green"></i> {s}</li>
                      ))}
                    </ul>
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
              <div className="flex-1 min-w-[200px] flex flex-col gap-4">
                <div className="bg-neo-blue text-white p-6 border-2 border-black shadow-neo">
                  <h4 className="font-bold text-lg mb-2"><i className="bi bi-book-half"></i> Live Docs</h4>
                  <p className="text-xs">Published Documentation Hub</p>
                </div>
                <div className="bg-neo-green text-white p-6 border-2 border-black shadow-neo">
                  <h4 className="font-bold text-lg mb-2"><i className="bi bi-git"></i> Fixed PR</h4>
                  <p className="text-xs">Validated & Merged</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Deep Dive */}
      <section className="py-24 px-6 bg-[#FFFAF0] border-b-4 border-black" data-testid="tech-section">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block bg-neo-purple text-white px-4 py-2 font-bold mb-4 border-2 border-black">NO MODEL TRAINING REQUIRED</div>
            <h2 className="font-display font-bold text-4xl sm:text-5xl mb-6">How It Actually Understands a Repo</h2>
            <p className="text-base md:text-lg max-w-3xl mx-auto">The real insight: Don't train a custom model to understand a repo. Build a precise map of the repo, then let a strong model navigate it at runtime.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-display font-bold text-4xl mb-6">Not "File Scanning".<br />Structural Understanding.</h2>
              <p className="text-lg mb-6">EngineOps doesn't just read text files. It works through a three-layer runtime stack:</p>
              <div className="space-y-6">
                {[
                  { num: "1", title: "Foundation Model Reasoning", desc: "Via Claude API — powerful reasoning over structured context." },
                  { num: "2", title: "Code Property Graph (CPG)", desc: "Builds an exact structural map of the repo: nodes, edges, signatures, and call paths." },
                  { num: "3", title: "RAG Over Graph", desc: "Each agent retrieves only the relevant nodes, edges, signatures, call paths, and dependencies for the task at hand." },
                ].map((item) => (
                  <div key={item.num} className="flex gap-4 items-start">
                    <div className="bg-neo-purple text-white w-10 h-10 flex items-center justify-center font-bold border-2 border-black flex-shrink-0">{item.num}</div>
                    <div>
                      <h4 className="font-bold text-xl">{item.title}</h4>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-neo-yellow border-4 border-black shadow-neo">
                <p className="font-bold text-lg">That is a much stronger story than "AI reads the codebase."</p>
              </div>
            </div>
            <div className="relative bg-white border-4 border-black aspect-square p-8 shadow-neo flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full">
                <div className="absolute top-10 left-10 w-16 h-16 bg-neo-yellow border-2 border-black rounded-full flex items-center justify-center font-bold text-xs shadow-neo-sm animate-pulse">AST</div>
                <div className="absolute top-10 right-10 w-16 h-16 bg-neo-red border-2 border-black rounded-full flex items-center justify-center font-bold text-xs shadow-neo-sm text-white">CFG</div>
                <div className="absolute bottom-20 left-20 w-16 h-16 bg-neo-green border-2 border-black rounded-full flex items-center justify-center font-bold text-xs shadow-neo-sm text-white">PDG</div>
                <div className="absolute bottom-10 right-10 w-16 h-16 bg-neo-blue border-2 border-black rounded-full flex items-center justify-center font-bold text-xs shadow-neo-sm text-white">RAG</div>
                <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-neo-purple border-2 border-black rounded-full flex items-center justify-center font-bold text-sm shadow-neo transform -translate-x-1/2 -translate-y-1/2 z-10 text-white">CPG</div>
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <line x1="20%" y1="20%" x2="50%" y2="50%" stroke="black" strokeWidth="2" />
                  <line x1="80%" y1="20%" x2="50%" y2="50%" stroke="black" strokeWidth="2" />
                  <line x1="25%" y1="75%" x2="50%" y2="50%" stroke="black" strokeWidth="2" />
                  <line x1="80%" y1="80%" x2="50%" y2="50%" stroke="black" strokeWidth="2" />
                </svg>
                <div className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 font-mono text-xs uppercase border border-white">
                  Agent Analyzing Nodes...
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Defensibility */}
      <section className="py-24 px-6 bg-white border-b-4 border-black" data-testid="defensibility-section">
        <div className="container mx-auto">
          <h2 className="font-display font-bold text-4xl sm:text-5xl mb-4 text-center">What Makes EngineOps Defensible</h2>
          <p className="text-base md:text-lg text-center mb-12 max-w-3xl mx-auto">Four core differentiators that create a real moat in the AI engineering space.</p>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              { num: "1", color: "bg-neo-purple", title: "Structural Understanding", desc: "Most tools still operate on files or token windows. EngineOps uses a CPG-backed structural model of the repository, which is materially better for architecture understanding, call tracing, and patch reasoning." },
              { num: "2", color: "bg-neo-green", title: "Execution-Backed Autonomy", desc: "The bug pipeline does not stop at patch generation. It tests candidate fixes in a sandbox and automatically selects the passing patch before PR creation." },
              { num: "3", color: "bg-neo-blue", title: "Two High-Value Outcomes", desc: "Most tools solve either docs or debugging. EngineOps solves both from the same repo context, making the story more memorable and more demoable." },
              { num: "4", color: "bg-neo-red", title: "Trust & Governance", desc: "Your partner layer is a real strength: Safedep adds security posture to docs, Gearsec enforces pre-merge policies, Concierge handles session isolation, and S2.dev provides durable audit trails." },
            ].map((item) => (
              <div key={item.num} className="bg-[#FFFAF0] border-4 border-black shadow-neo p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`${item.color} text-white w-12 h-12 flex items-center justify-center font-bold text-xl border-2 border-black`}>{item.num}</div>
                  <h3 className="font-bold text-2xl">{item.title}</h3>
                </div>
                <p className="text-lg">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="moat" className="py-24 px-6 bg-neo-purple text-white border-b-4 border-black" data-testid="partners-section">
        <div className="container mx-auto">
          <h2 className="font-display font-bold text-4xl sm:text-5xl mb-12 text-center">Trust & Governance Built-in</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "bi-shield-lock-fill", name: "Safedep", desc: "Adds dependency and security posture explicitly into published docs." },
              { icon: "bi-gear-wide-connected", name: "Gearsec", desc: "Pre-merge policy enforcement and compliance checks before PR generation." },
              { icon: "bi-person-badge-fill", name: "Concierge", desc: "Session isolation, progressive tool disclosure, and team notifications." },
              { icon: "bi-camera-reels-fill", name: "S2.dev", desc: "Durable replayable agent-to-agent streams and visible audit trail." },
            ].map((p) => (
              <div key={p.name} className="bg-white text-black border-4 border-black shadow-neo p-6 hover:-translate-y-2 transition-transform">
                <div className="bg-neo-black w-12 h-12 mb-4 flex items-center justify-center">
                  <i className={`bi ${p.icon} text-white text-2xl`}></i>
                </div>
                <h3 className="font-bold text-xl mb-2">{p.name}</h3>
                <p className="text-sm">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Framing */}
      <section id="demo" className="py-16 px-6 bg-neo-black text-white border-b-4 border-black" data-testid="demo-section">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display font-bold text-4xl mb-8 text-center">Demo Framing for Judges</h2>
          <p className="text-base md:text-lg mb-8 text-center">The best demo story is simple:</p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { num: "1", color: "text-neo-yellow", title: "Input & Analyze", desc: "Input a repo with a deliberate failing test. EngineOps builds a structural understanding of the codebase." },
              { num: "2", color: "text-neo-blue", title: "Documentation Pipeline", desc: "One pipeline publishes a live documentation site automatically." },
              { num: "3", color: "text-neo-green", title: "Bug Resolution Pipeline", desc: "The second pipeline traces the failure, generates candidate fixes, validates them, and opens/merges the winning PR." },
              { num: "4", color: "text-neo-purple", title: "Full Audit Trail", desc: "The full run is replayable through the agent audit trail powered by S2.dev." },
            ].map((item) => (
              <div key={item.num} className="bg-gray-900 border-2 border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <i className={`bi bi-${item.num}-circle-fill ${item.color} text-2xl`}></i>
                  <h3 className="font-bold text-xl">{item.title}</h3>
                </div>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-neo-yellow border-b-4 border-black text-center" data-testid="cta-section">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl mb-8 leading-tight">
            Stop Acting as the Assistant.<br />Start Acting as the Operator.
          </h2>
          <div className="bg-white border-4 border-black p-6 shadow-neo mb-10 max-w-3xl mx-auto">
            <p className="text-lg font-bold mb-4">Sharper 50-Word Submission:</p>
            <p className="text-base md:text-lg italic">"Engineering teams lose time to two chronic problems: stale documentation and manual CI bug fixing. EngineOps is a multi-agent system that takes a repo and failed CI log, then ships two outcomes: a live docs site and a validated bug-fix PR. It uses CPG + RAG, not model training."</p>
          </div>
          <p className="text-base md:text-lg font-medium mb-10 max-w-2xl mx-auto">
            EngineOps is not "AI for coding". It is AI for finished engineering operations work.
          </p>
          <form onSubmit={handleSubmit} className="bg-white border-4 border-black p-8 shadow-neo-lg max-w-md mx-auto text-left" data-testid="waitlist-form">
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
                <button type="submit" className="w-full neo-button bg-neo-black text-white font-bold p-4 border-2 border-black shadow-neo hover:bg-neo-purple" data-testid="waitlist-submit-btn">
                  JOIN WAITLIST
                </button>
              </>
            )}
          </form>
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
