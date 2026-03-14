import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PARTNER_CONFIG = [
  { key: "unsiloed", icon: "bi-file-earmark-richtext", color: "bg-indigo-500" },
  { key: "safedep", icon: "bi-shield-lock", color: "bg-orange-500" },
  { key: "s2", icon: "bi-camera-reels", color: "bg-blue-500" },
  { key: "gearsec", icon: "bi-shield-check", color: "bg-yellow-500" },
  { key: "concierge", icon: "bi-bell", color: "bg-teal-500" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [partnerStatus, setPartnerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [globalToken, setGlobalToken] = useState(() => sessionStorage.getItem("github_token") || "");
  const [showTokenInput, setShowTokenInput] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, statsRes, partnerRes] = await Promise.all([
        axios.get(`${API}/projects`),
        axios.get(`${API}/stats`),
        axios.get(`${API}/partner-status`).catch(() => ({ data: null })),
      ]);
      setProjects(projRes.data);
      setStats(statsRes.data);
      if (partnerRes.data) setPartnerStatus(partnerRes.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const payload = { repo_url: repoUrl };
      const token = githubToken.trim() || globalToken.trim();
      if (token) payload.github_token = token;
      const res = await axios.post(`${API}/projects`, payload);
      setShowNewProject(false);
      setRepoUrl("");
      setGithubToken("");
      navigate(`/dashboard/project/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id) => {
    try {
      await axios.delete(`${API}/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const launchDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await axios.post(`${API}/demo`);
      navigate(`/dashboard/project/${res.data.project_id}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to launch demo");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="neo-bg-paper min-h-screen" data-testid="dashboard-page">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-[#FFFAF0] border-b-4 border-black px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 bg-neo-purple border-2 border-black shadow-neo-sm flex items-center justify-center">
            <i className="bi bi-cpu-fill text-white text-xl"></i>
          </div>
          <span className="font-display font-bold text-2xl tracking-tighter">EngineOps</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-sm font-bold hover:text-neo-purple transition-colors" data-testid="back-to-landing-btn">
            <i className="bi bi-arrow-left mr-1"></i> LANDING
          </button>
          {/* GitHub Token */}
          <div className="relative">
            <button
              onClick={() => setShowTokenInput(!showTokenInput)}
              className={`neo-button px-4 py-2 font-bold text-sm border-2 border-black shadow-neo-sm transition-colors ${globalToken ? "bg-neo-green text-white" : "bg-white text-black hover:bg-gray-100"}`}
              data-testid="token-toggle-btn"
            >
              <i className={`bi ${globalToken ? "bi-key-fill" : "bi-key"} mr-1`}></i>
              {globalToken ? "TOKEN SET" : "GH TOKEN"}
            </button>
            {showTokenInput && (
              <div className="absolute right-0 top-12 bg-white border-4 border-black shadow-neo p-4 w-80 z-50">
                <label className="block font-bold mb-2 text-xs uppercase">GitHub Personal Access Token</label>
                <input
                  type="password"
                  value={globalToken}
                  onChange={(e) => {
                    setGlobalToken(e.target.value);
                    sessionStorage.setItem("github_token", e.target.value);
                  }}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full bg-[#f0f0f0] border-2 border-black p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-neo-purple"
                  data-testid="global-token-input"
                />
                <p className="text-[10px] text-gray-500 mt-1">Stored in session only. Used for private repos & PR creation.</p>
              </div>
            )}
          </div>
          <button
            onClick={launchDemo}
            disabled={demoLoading}
            className="neo-button bg-neo-purple text-white px-6 py-2 font-bold border-2 border-black shadow-neo-sm hover:bg-purple-600 transition-colors disabled:opacity-50"
            data-testid="one-click-demo-btn"
          >
            {demoLoading ? (
              <><i className="bi bi-hourglass-split mr-2"></i>LAUNCHING...</>
            ) : (
              <><i className="bi bi-play-circle mr-2"></i>ONE-CLICK DEMO</>
            )}
          </button>
          <button onClick={() => setShowNewProject(true)} className="neo-button bg-neo-green text-white px-6 py-2 font-bold border-2 border-black shadow-neo-sm hover:bg-green-600 transition-colors" data-testid="new-project-btn">
            <i className="bi bi-plus-lg mr-2"></i>NEW PROJECT
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="dashboard-stats">
            <div className="bg-white border-4 border-black shadow-neo p-4">
              <p className="text-sm font-bold uppercase text-gray-500">Projects</p>
              <p className="font-display font-bold text-3xl">{stats.total_projects}</p>
            </div>
            <div className="bg-white border-4 border-black shadow-neo p-4">
              <p className="text-sm font-bold uppercase text-gray-500">Pipeline Runs</p>
              <p className="font-display font-bold text-3xl">{stats.total_pipeline_runs}</p>
            </div>
            <div className="bg-white border-4 border-black shadow-neo p-4">
              <p className="text-sm font-bold uppercase text-gray-500">Completed</p>
              <p className="font-display font-bold text-3xl text-neo-green">{stats.completed_runs}</p>
            </div>
            <div className="bg-white border-4 border-black shadow-neo p-4">
              <p className="text-sm font-bold uppercase text-gray-500">Success Rate</p>
              <p className="font-display font-bold text-3xl text-neo-blue">{stats.success_rate}%</p>
            </div>
          </div>
        )}

        {/* Partner Integrations */}
        {partnerStatus && (
          <div className="bg-white border-4 border-black shadow-neo p-4 mb-8" data-testid="partner-status-bar">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm uppercase text-gray-500">Partner Integrations</h3>
              <span className="text-xs font-mono text-gray-400">{Object.values(partnerStatus).filter(v => v.configured).length}/{Object.keys(partnerStatus).length} active</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {PARTNER_CONFIG.map(({ key, icon, color }) => {
                const p = partnerStatus[key];
                if (!p) return null;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 border-2 border-black text-sm font-bold ${p.configured ? `${color} text-white` : "bg-gray-100 text-gray-400"}`}
                    data-testid={`partner-${key}`}
                  >
                    <i className={`bi ${icon}`}></i>
                    <span>{p.name}</span>
                    <span className="text-xs opacity-75">({p.role})</span>
                    {p.configured ? <i className="bi bi-check-lg"></i> : <i className="bi bi-dash-lg"></i>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* New Project Modal */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" data-testid="new-project-modal">
            <div className="bg-[#FFFAF0] border-4 border-black shadow-neo-lg p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-display font-bold text-2xl">New Project</h2>
                <button onClick={() => { setShowNewProject(false); setError(""); }} className="w-8 h-8 bg-neo-red text-white border-2 border-black flex items-center justify-center font-bold hover:bg-red-600" data-testid="close-modal-btn">&times;</button>
              </div>
              <form onSubmit={createProject}>
                <div className="mb-4">
                  <label className="block font-bold mb-2 text-sm uppercase">GitHub Repository URL *</label>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full bg-white border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-neo-purple font-mono text-sm"
                    required
                    data-testid="repo-url-input"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-bold mb-2 text-sm uppercase">GitHub Token (optional)</label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full bg-white border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-neo-purple font-mono text-sm"
                    data-testid="github-token-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required for private repos and creating PRs. Public repos work without a token.</p>
                </div>
                {error && <div className="bg-neo-red text-white p-3 border-2 border-black mb-4 font-bold text-sm" data-testid="create-project-error">{error}</div>}
                <button type="submit" disabled={creating} className="w-full neo-button bg-neo-black text-white font-bold p-4 border-2 border-black shadow-neo hover:bg-neo-purple disabled:opacity-50" data-testid="create-project-submit">
                  {creating ? "CONNECTING..." : "CONNECT REPOSITORY"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Project List */}
        <h2 className="font-display font-bold text-3xl mb-6">Your Projects</h2>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-12 h-12 border-4 border-black border-t-neo-purple animate-spin"></div>
            <p className="mt-4 font-bold">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border-4 border-black shadow-neo p-12 text-center" data-testid="empty-projects">
            <i className="bi bi-github text-6xl text-gray-300 mb-4 block"></i>
            <h3 className="font-display font-bold text-2xl mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">Connect a GitHub repository or try the demo to see EngineOps in action.</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={launchDemo}
                disabled={demoLoading}
                className="neo-button bg-neo-purple text-white px-8 py-3 font-bold border-2 border-black shadow-neo disabled:opacity-50"
                data-testid="empty-demo-btn"
              >
                <i className="bi bi-play-circle mr-2"></i>ONE-CLICK DEMO
              </button>
              <button onClick={() => setShowNewProject(true)} className="neo-button bg-neo-green text-white px-8 py-3 font-bold border-2 border-black shadow-neo" data-testid="empty-new-project-btn">
                <i className="bi bi-plus-lg mr-2"></i>ADD PROJECT
              </button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="project-list">
            {projects.map((project) => (
              <div key={project.id} className="bg-white border-4 border-black shadow-neo hover:-translate-y-1 transition-transform cursor-pointer" data-testid={`project-card-${project.id}`}>
                <div className="p-6" onClick={() => navigate(`/dashboard/project/${project.id}`)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-neo-black border-2 border-black flex items-center justify-center">
                      <i className="bi bi-github text-white text-xl"></i>
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-lg truncate">{project.repo_owner}/{project.repo_name}</h3>
                      <p className="text-xs text-gray-500 font-mono truncate">{project.repo_url}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {project.last_docs_run && (
                      <span className="bg-neo-blue text-white text-xs font-bold px-2 py-1 border border-black">DOCS</span>
                    )}
                    {project.last_bugfix_run && (
                      <span className="bg-neo-green text-white text-xs font-bold px-2 py-1 border border-black">BUGFIX</span>
                    )}
                    <span className={`text-xs font-bold px-2 py-1 border border-black ${project.status === "active" ? "bg-neo-yellow text-black" : "bg-gray-200 text-gray-500"}`}>
                      {project.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 font-mono">Created {new Date(project.created_at).toLocaleDateString()}</p>
                </div>
                <div className="border-t-2 border-black flex">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/project/${project.id}`); }} className="flex-1 p-3 font-bold text-sm hover:bg-neo-blue hover:text-white transition-colors text-center border-r-2 border-black" data-testid={`open-project-${project.id}`}>
                    OPEN
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }} className="p-3 px-4 font-bold text-sm hover:bg-neo-red hover:text-white transition-colors" data-testid={`delete-project-${project.id}`}>
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
