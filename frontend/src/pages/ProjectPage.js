import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STEP_ICONS = {
  "Code Reader": "bi-book",
  "RAG Writer": "bi-pencil-square",
  "Editor": "bi-check2-circle",
  "Compiler": "bi-gear",
  "Deployer": "bi-rocket-takeoff",
  "Log Parser": "bi-search",
  "Patch Generator": "bi-wrench",
  "Sandbox Tester": "bi-box",
  "Selector": "bi-trophy",
  "Merger": "bi-git",
};

const STATUS_COLORS = {
  pending: "bg-gray-200 text-gray-600 border-gray-400",
  running: "bg-neo-yellow text-black border-yellow-600 step-running",
  completed: "bg-neo-green text-white border-green-700",
  failed: "bg-neo-red text-white border-red-700",
};

function PipelineSteps({ steps }) {
  return (
    <div className="space-y-3" data-testid="pipeline-steps">
      {steps.map((step, i) => (
        <div key={i} className={`border-2 border-black p-4 flex items-center gap-4 ${STATUS_COLORS[step.status] || ""}`} data-testid={`step-${step.name.toLowerCase().replace(/ /g, "-")}`}>
          <div className="w-10 h-10 border-2 border-black bg-white text-black flex items-center justify-center flex-shrink-0">
            <i className={`bi ${STEP_ICONS[step.name] || "bi-circle"} text-lg`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold">{step.name}</span>
              <span className="text-xs opacity-75">({step.agent})</span>
            </div>
            {step.output && <p className="text-sm mt-1 truncate opacity-90">{step.output}</p>}
            {step.error && <p className="text-sm mt-1 text-red-200">{step.error}</p>}
          </div>
          <div className="flex-shrink-0">
            {step.status === "running" && <div className="w-5 h-5 border-2 border-black border-t-transparent animate-spin rounded-full"></div>}
            {step.status === "completed" && <i className="bi bi-check-lg text-xl"></i>}
            {step.status === "failed" && <i className="bi bi-x-lg text-xl"></i>}
            {step.status === "pending" && <i className="bi bi-hourglass text-lg"></i>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState("docs");
  const [pipelineRuns, setPipelineRuns] = useState([]);
  const [docsResult, setDocsResult] = useState(null);
  const [bugfixResult, setBugfixResult] = useState(null);
  const [ciLog, setCiLog] = useState("");
  const [triggeringDocs, setTriggeringDocs] = useState(false);
  const [triggeringBugfix, setTriggeringBugfix] = useState(false);
  const [selectedDocPage, setSelectedDocPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/projects/${projectId}`);
      setProject(res.data);
    } catch (err) {
      console.error("Failed to fetch project:", err);
    }
  }, [projectId]);

  const fetchPipelineRuns = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/projects/${projectId}/pipeline-runs`);
      setPipelineRuns(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to fetch pipeline runs:", err);
      return [];
    }
  }, [projectId]);

  const fetchResults = useCallback(async () => {
    try {
      const [docsRes, bugfixRes] = await Promise.allSettled([
        axios.get(`${API}/projects/${projectId}/docs`),
        axios.get(`${API}/projects/${projectId}/bugfixes/latest`),
      ]);
      if (docsRes.status === "fulfilled") setDocsResult(docsRes.value.data);
      if (bugfixRes.status === "fulfilled") setBugfixResult(bugfixRes.value.data);
    } catch (err) { /* ignore 404s */ }
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchProject(), fetchPipelineRuns(), fetchResults()]);
      setLoading(false);
    };
    init();
  }, [fetchProject, fetchPipelineRuns, fetchResults]);

  // Poll for pipeline updates
  useEffect(() => {
    const hasRunning = pipelineRuns.some((r) => r.status === "running");
    if (hasRunning) {
      pollRef.current = setInterval(async () => {
        const runs = await fetchPipelineRuns();
        const stillRunning = runs.some((r) => r.status === "running");
        if (!stillRunning) {
          clearInterval(pollRef.current);
          await fetchResults();
        }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pipelineRuns, fetchPipelineRuns, fetchResults]);

  const triggerDocs = async () => {
    setTriggeringDocs(true);
    try {
      await axios.post(`${API}/projects/${projectId}/run-docs`);
      await fetchPipelineRuns();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to trigger docs pipeline");
    } finally {
      setTriggeringDocs(false);
    }
  };

  const triggerBugfix = async () => {
    if (!ciLog.trim()) { alert("Please paste a CI log first"); return; }
    setTriggeringBugfix(true);
    try {
      await axios.post(`${API}/projects/${projectId}/run-bugfix`, { ci_log: ciLog });
      await fetchPipelineRuns();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to trigger bugfix pipeline");
    } finally {
      setTriggeringBugfix(false);
    }
  };

  const latestDocsRun = pipelineRuns.find((r) => r.pipeline_type === "docs");
  const latestBugfixRun = pipelineRuns.find((r) => r.pipeline_type === "bugfix");

  if (loading) {
    return (
      <div className="neo-bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-black border-t-neo-purple animate-spin"></div>
          <p className="mt-4 font-bold">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="neo-bg-paper min-h-screen flex items-center justify-center">
        <div className="bg-white border-4 border-black shadow-neo p-8 text-center">
          <h2 className="font-bold text-2xl mb-4">Project not found</h2>
          <button onClick={() => navigate("/dashboard")} className="neo-button bg-neo-black text-white px-6 py-3 font-bold border-2 border-black shadow-neo">BACK TO DASHBOARD</button>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-bg-paper min-h-screen" data-testid="project-page">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-[#FFFAF0] border-b-4 border-black px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 bg-neo-black border-2 border-black flex items-center justify-center hover:bg-neo-purple transition-colors" data-testid="back-to-dashboard-btn">
            <i className="bi bi-arrow-left text-white text-lg"></i>
          </button>
          <div>
            <h1 className="font-display font-bold text-xl">{project.repo_owner}/{project.repo_name}</h1>
            <p className="text-xs font-mono text-gray-500">{project.repo_url}</p>
          </div>
        </div>
        <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="neo-button bg-neo-black text-white px-4 py-2 font-bold text-sm border-2 border-black shadow-neo-sm">
          <i className="bi bi-github mr-2"></i>VIEW REPO
        </a>
      </nav>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex border-4 border-black mb-8" data-testid="pipeline-tabs">
          <button
            onClick={() => setActiveTab("docs")}
            className={`flex-1 p-4 font-bold text-lg border-r-2 border-black transition-colors ${activeTab === "docs" ? "bg-neo-blue text-white" : "bg-white hover:bg-blue-50"}`}
            data-testid="docs-tab"
          >
            <i className="bi bi-book-half mr-2"></i>DOCUMENTATION PIPELINE
          </button>
          <button
            onClick={() => setActiveTab("bugfix")}
            className={`flex-1 p-4 font-bold text-lg transition-colors ${activeTab === "bugfix" ? "bg-neo-green text-white" : "bg-white hover:bg-green-50"}`}
            data-testid="bugfix-tab"
          >
            <i className="bi bi-bug-fill mr-2"></i>BUG-FIX PIPELINE
          </button>
        </div>

        {/* DOCS TAB */}
        {activeTab === "docs" && (
          <div className="space-y-8" data-testid="docs-tab-content">
            {/* Trigger */}
            <div className="bg-white border-4 border-black shadow-neo p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-xl mb-1">Generate Documentation</h3>
                  <p className="text-sm text-gray-500">Analyze the repository and produce a complete documentation site.</p>
                </div>
                <button
                  onClick={triggerDocs}
                  disabled={triggeringDocs || (latestDocsRun?.status === "running")}
                  className="neo-button bg-neo-blue text-white px-6 py-3 font-bold border-2 border-black shadow-neo disabled:opacity-50"
                  data-testid="trigger-docs-btn"
                >
                  {latestDocsRun?.status === "running" ? (
                    <><i className="bi bi-hourglass-split mr-2"></i>RUNNING...</>
                  ) : (
                    <><i className="bi bi-play-fill mr-2"></i>GENERATE DOCS</>
                  )}
                </button>
              </div>
            </div>

            {/* Pipeline Progress */}
            {latestDocsRun && (
              <div className="bg-white border-4 border-black shadow-neo p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Pipeline Progress</h3>
                  <span className={`px-3 py-1 font-bold text-sm border-2 border-black ${latestDocsRun.status === "completed" ? "bg-neo-green text-white" : latestDocsRun.status === "running" ? "bg-neo-yellow" : latestDocsRun.status === "failed" ? "bg-neo-red text-white" : "bg-gray-200"}`}>
                    {latestDocsRun.status.toUpperCase()}
                  </span>
                </div>
                <PipelineSteps steps={latestDocsRun.steps} />
              </div>
            )}

            {/* Docs Result */}
            {docsResult && docsResult.pages && docsResult.pages.length > 0 && (
              <div className="bg-white border-4 border-black shadow-neo" data-testid="docs-result">
                <div className="border-b-4 border-black p-4 flex items-center justify-between">
                  <h3 className="font-bold text-lg"><i className="bi bi-file-earmark-text mr-2"></i>Generated Documentation</h3>
                  <span className="text-sm text-gray-500">{docsResult.pages.length} pages</span>
                </div>
                <div className="flex">
                  {/* Sidebar */}
                  <div className="w-64 border-r-4 border-black bg-[#f8f5ee] flex-shrink-0 hide-scrollbar overflow-y-auto max-h-[600px]">
                    {docsResult.pages.map((page, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedDocPage(i)}
                        className={`w-full text-left p-3 text-sm font-bold border-b-2 border-black transition-colors ${i === selectedDocPage ? "bg-neo-blue text-white" : "hover:bg-blue-50"}`}
                        data-testid={`doc-page-btn-${i}`}
                      >
                        {page.title}
                      </button>
                    ))}
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-6 max-h-[600px] overflow-y-auto">
                    <h2 className="font-display font-bold text-2xl mb-4">{docsResult.pages[selectedDocPage]?.title}</h2>
                    <div className="markdown-content">
                      <ReactMarkdown>{docsResult.pages[selectedDocPage]?.content || ""}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BUGFIX TAB */}
        {activeTab === "bugfix" && (
          <div className="space-y-8" data-testid="bugfix-tab-content">
            {/* CI Log Input */}
            <div className="bg-white border-4 border-black shadow-neo p-6">
              <h3 className="font-display font-bold text-xl mb-4">Paste CI Failure Log</h3>
              <textarea
                value={ciLog}
                onChange={(e) => setCiLog(e.target.value)}
                placeholder="Paste your failing CI/CD log output here...&#10;&#10;Example:&#10;FAILED: test_app.py::test_login - AssertionError: Expected 200 but got 500&#10;Traceback:&#10;  File auth.py line 42 in login()&#10;    user = db.find_user(email)&#10;AttributeError: 'NoneType' object has no attribute 'find_user'"
                className="w-full bg-neo-black text-green-400 font-mono text-sm p-4 border-2 border-black min-h-[200px] focus:outline-none focus:ring-2 focus:ring-neo-green"
                data-testid="ci-log-input"
              />
              <div className="flex justify-end mt-4">
                <button
                  onClick={triggerBugfix}
                  disabled={triggeringBugfix || (latestBugfixRun?.status === "running")}
                  className="neo-button bg-neo-green text-white px-6 py-3 font-bold border-2 border-black shadow-neo disabled:opacity-50"
                  data-testid="trigger-bugfix-btn"
                >
                  {latestBugfixRun?.status === "running" ? (
                    <><i className="bi bi-hourglass-split mr-2"></i>ANALYZING...</>
                  ) : (
                    <><i className="bi bi-wrench mr-2"></i>FIX IT</>
                  )}
                </button>
              </div>
            </div>

            {/* Pipeline Progress */}
            {latestBugfixRun && (
              <div className="bg-white border-4 border-black shadow-neo p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Bug Fix Pipeline Progress</h3>
                  <span className={`px-3 py-1 font-bold text-sm border-2 border-black ${latestBugfixRun.status === "completed" ? "bg-neo-green text-white" : latestBugfixRun.status === "running" ? "bg-neo-yellow" : latestBugfixRun.status === "failed" ? "bg-neo-red text-white" : "bg-gray-200"}`}>
                    {latestBugfixRun.status.toUpperCase()}
                  </span>
                </div>
                <PipelineSteps steps={latestBugfixRun.steps} />
              </div>
            )}

            {/* Bugfix Result */}
            {bugfixResult && (
              <div className="space-y-6" data-testid="bugfix-result">
                {/* Root Cause */}
                <div className="bg-white border-4 border-black shadow-neo p-6">
                  <h3 className="font-bold text-lg mb-3"><i className="bi bi-search mr-2 text-neo-red"></i>Root Cause Analysis</h3>
                  <div className="bg-[#FFFAF0] border-2 border-black p-4">
                    <p className="font-bold text-sm text-gray-500 uppercase mb-1">Error Type</p>
                    <p className="font-mono text-sm mb-3">{bugfixResult.error_analysis?.error_type}</p>
                    <p className="font-bold text-sm text-gray-500 uppercase mb-1">Error Message</p>
                    <p className="font-mono text-sm mb-3 text-neo-red">{bugfixResult.error_analysis?.error_message}</p>
                    <p className="font-bold text-sm text-gray-500 uppercase mb-1">Failing File</p>
                    <p className="font-mono text-sm mb-3">{bugfixResult.error_analysis?.failing_file}</p>
                    <p className="font-bold text-sm text-gray-500 uppercase mb-1">Root Cause</p>
                    <p className="text-sm leading-relaxed">{bugfixResult.root_cause}</p>
                  </div>
                  {bugfixResult.error_analysis?.call_chain?.length > 0 && (
                    <div className="mt-4">
                      <p className="font-bold text-sm text-gray-500 uppercase mb-2">Call Chain</p>
                      <div className="bg-neo-black text-green-400 font-mono text-xs p-4 border-2 border-black">
                        {bugfixResult.error_analysis.call_chain.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {i > 0 && <span className="text-gray-600">  {'>'} </span>}
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Patches */}
                <div className="bg-white border-4 border-black shadow-neo p-6">
                  <h3 className="font-bold text-lg mb-3"><i className="bi bi-wrench mr-2 text-neo-blue"></i>Generated Patches ({bugfixResult.patches?.length || 0})</h3>
                  <div className="space-y-4">
                    {bugfixResult.patches?.map((patch, i) => (
                      <div key={i} className={`border-2 border-black p-4 ${i === bugfixResult.selected_patch_index ? "bg-neo-green bg-opacity-10 border-green-600" : "bg-[#FFFAF0]"}`} data-testid={`patch-${i}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold">Patch #{i + 1}: {patch.file_path}</span>
                          {i === bugfixResult.selected_patch_index && (
                            <span className="bg-neo-green text-white text-xs font-bold px-2 py-1 border border-black">SELECTED</span>
                          )}
                        </div>
                        <p className="text-sm mb-3">{patch.explanation}</p>
                        {patch.patched_code && (
                          <pre className="bg-neo-black text-green-400 font-mono text-xs p-3 border border-gray-700 overflow-x-auto max-h-[200px]">
                            {patch.patched_code}
                          </pre>
                        )}
                        {patch.confidence !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">Confidence:</span>
                            <div className="h-2 flex-1 bg-gray-200 border border-black">
                              <div className="h-full bg-neo-blue" style={{ width: `${(patch.confidence || 0) * 100}%` }}></div>
                            </div>
                            <span className="text-xs font-bold">{Math.round((patch.confidence || 0) * 100)}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* PR Link */}
                {bugfixResult.pr_url && (
                  <div className="bg-neo-green text-white border-4 border-black shadow-neo p-6 text-center">
                    <i className="bi bi-check-circle-fill text-4xl mb-3 block"></i>
                    <h3 className="font-bold text-xl mb-2">Pull Request Created & Merged</h3>
                    <a href={bugfixResult.pr_url} target="_blank" rel="noopener noreferrer" className="inline-block bg-white text-black font-bold px-6 py-2 border-2 border-black shadow-neo hover:bg-neo-yellow transition-colors" data-testid="pr-link">
                      VIEW PR #{bugfixResult.pr_number}
                    </a>
                  </div>
                )}
                {!bugfixResult.pr_url && bugfixResult.selected_patch_index !== null && (
                  <div className="bg-neo-yellow text-black border-4 border-black shadow-neo p-6 text-center">
                    <i className="bi bi-check-circle-fill text-4xl mb-3 block"></i>
                    <h3 className="font-bold text-xl mb-2">Patch Ready</h3>
                    <p className="text-sm">Fix identified and validated. Add a GitHub token with write access to auto-create PRs.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
