"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import LandingPage from "../components/LandingPage";

const RootGraph = dynamic(() => import("../components/ThinkMapGraph"), {
  ssr: false,
  loading: () => (
    <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ display:"flex", gap:6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"var(--c-answer)", animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
      </div>
    </div>
  ),
});

const SUBJECTS = [
  { emoji:"🏛", label:"History", examples:["Why did the Roman Empire fall?","What caused World War 1?","How did the Cold War start?"] },
  { emoji:"🧬", label:"Biology", examples:["How does DNA replication work?","What is natural selection?","How do vaccines work?"] },
  { emoji:"📈", label:"Economics", examples:["What caused the 2008 financial crisis?","How does inflation work?","What is supply and demand?"] },
  { emoji:"⚛", label:"Physics", examples:["What is quantum entanglement?","How does nuclear fission work?","What is the theory of relativity?"] },
  { emoji:"💻", label:"Computer Science", examples:["How does the internet work?","What is machine learning?","How do blockchains work?"] },
  { emoji:"🧪", label:"Chemistry", examples:["How does chemical bonding work?","What is the periodic table?","How do catalysts work?"] },
];

const ALL_EXAMPLES = [
  "What caused the 2008 financial crisis?",
  "How does CRISPR gene editing work?",
  "Why did the Roman Empire fall?",
  "How does the internet work?",
  "What is quantum entanglement?",
];

interface MCQ { question:string; options:string[]; correct:number; explanation:string; }
interface SavedGraph { id:string; question:string; nodes:any[]; answer:string; savedAt:string; }

export default function Home() {
  const [input, setInput] = useState("");
  const [activeQuestion, setActiveQuestion] = useState("");
  const [activeDocText, setActiveDocText] = useState("");
  const [answer, setAnswer] = useState("");
  const [mounted, setMounted] = useState(false);
  const [docName, setDocName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<"question"|"document">("question");
  const [view, setView] = useState<"landing"|"home"|"graph"|"dashboard"|"quiz">("landing");
  const [dashboardTab, setDashboardTab] = useState<"library"|"global">("library");
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [globalGraph, setGlobalGraph] = useState<any>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [activeStaticData, setActiveStaticData] = useState<any>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<typeof SUBJECTS[0]|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Graph nodes for quiz/save
  const [graphNodes, setGraphNodes] = useState<any[]>([]);

  // Quiz state
  const [quizMode, setQuizMode] = useState(false);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Saved graphs
  const [savedGraphs, setSavedGraphs] = useState<SavedGraph[]>([]);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("root_saved_graphs");
    if (saved) setSavedGraphs(JSON.parse(saved));
  }, []);

  const submit = (q: string, docText = "") => {
    setAnswer(""); setActiveDocText(docText);
    setActiveQuestion(q); setGraphNodes([]);
    setQuizMode(false); setMcqs([]); setActiveStaticData(null); setIsReplaying(false);
    setView("graph");
  };

  const handleAnswer = useCallback((a: string) => setAnswer(a), []);
  const handleNodesUpdate = useCallback((nodes: any[]) => setGraphNodes(nodes), []);

  const readFile = async (file: File) => {
    setDocName(file.name);
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/extract-pdf`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          alert(`Server error: ${data.detail || "Unknown error"}`);
          return;
        }
        setActiveDocText(data.text);
      } catch (e: any) {
        alert("Failed to parse PDF: " + e.message);
      }
    } else {
      const text = await file.text();
      setActiveDocText(text);
    }
  };

  const reset = () => {
    setActiveQuestion(""); setActiveDocText(""); setAnswer("");
    setInput(""); setDocName(""); setGraphNodes([]);
    setQuizMode(false); setMcqs([]); setView("home");
  };

  // Save graph
  const saveGraph = () => {
    if (!activeQuestion || !answer) return;
    const newGraph: SavedGraph = {
      id: Date.now().toString(),
      question: activeQuestion,
      nodes: graphNodes,
      answer,
      savedAt: new Date().toLocaleDateString(),
    };
    const updated = [newGraph, ...savedGraphs].slice(0, 20);
    setSavedGraphs(updated);
    localStorage.setItem("root_saved_graphs", JSON.stringify(updated));
  };

  const fetchGlobalBrain = async () => {
    if (globalStats) return;
    setGlobalLoading(true);
    try {
      const s = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dashboard/stats`).then(r => r.json());
      const g = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dashboard/global`).then(r => r.json());
      setGlobalStats(s);
      setGlobalGraph(g);
    } catch {}
    setGlobalLoading(false);
  };

  const openDashboard = () => {
    setView("dashboard");
    if (dashboardTab === "global") fetchGlobalBrain();
  };

  const deleteSaved = (id: string) => {
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    localStorage.setItem("root_saved_graphs", JSON.stringify(updated));
  };

  // Generate MCQs
  const startTest = async () => {
    if (!activeQuestion || graphNodes.length === 0) return;
    setMcqLoading(true);
    setView("quiz");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/mcq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: activeQuestion, nodes: graphNodes }),
      });
      const data = await res.json();
      setMcqs(data.questions || []);
      setCurrentQ(0); setScore(0); setSelected(null);
      setQuizDone(false); setShowExplanation(false);
    } catch { alert("Could not generate quiz. Try again."); setView("graph"); }
    setMcqLoading(false);
  };

  // Start quiz mode (hide labels)
  const toggleQuizMode = () => setQuizMode(q => !q);

  const handleAnswer_MCQ = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    setShowExplanation(true);
    if (idx === mcqs[currentQ].correct) setScore(s => s+1);
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= mcqs.length) { setQuizDone(true); return; }
    setCurrentQ(q => q+1); setSelected(null); setShowExplanation(false);
  };

  const isSaved = savedGraphs.some(g => g.question === activeQuestion);

  if (!mounted) return null;

  return (
    <main style={{ height:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)", overflow:"hidden" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes gradPan { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes slideIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

        .logo-text { font-size:20px; font-weight:700; letter-spacing:-.5px; background:var(--grad); background-size:200% 200%; animation:gradPan 5s ease infinite; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .think-btn { background:var(--grad); background-size:200% 200%; animation:gradPan 5s ease infinite; border:none; color:#fff; font-weight:600; font-size:14px; padding:11px 22px; border-radius:10px; cursor:pointer; transition:opacity .15s,transform .15s; white-space:nowrap; }
        .think-btn:hover { opacity:.88; transform:translateY(-1px); }
        .think-btn:disabled { opacity:.35; transform:none; cursor:not-allowed; }
        .q-input { flex:1; min-width:0; background:var(--surface); border:1.5px solid var(--border2); border-radius:10px; padding:11px 16px; color:var(--text); font-size:14px; outline:none; transition:border-color .2s,box-shadow .2s; }
        .q-input::placeholder { color:var(--text3); }
        .q-input:focus { border-color:var(--c-question); box-shadow:0 0 0 3px rgba(155,114,207,.15); }
        .chip { background:var(--surface); border:1px solid var(--border2); border-radius:99px; padding:6px 14px; font-size:12px; color:var(--text2); cursor:pointer; transition:all .15s; white-space:nowrap; }
        .chip:hover { border-color:var(--c-concept); color:var(--c-concept); background:rgba(91,141,239,.08); }
        .tab { padding:6px 14px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid transparent; transition:all .15s; }
        .tab-active { background:var(--surface2); border-color:var(--border2); color:var(--text); }
        .tab-idle { color:var(--text3); }
        .tab-idle:hover { color:var(--text2); }
        .nav-btn { padding:7px 16px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:1px solid transparent; transition:all .15s; background:none; }
        .nav-btn:hover { background:var(--surface2); color:var(--text); }
        .nav-active { background:var(--surface2); border-color:var(--border2); color:var(--text); }
        .nav-idle { color:var(--text3); }
        .drop-zone { border:2px dashed var(--border2); border-radius:12px; padding:28px; text-align:center; cursor:pointer; transition:all .2s; background:var(--surface); }
        .drop-zone:hover, .drop-zone.drag-over { border-color:var(--c-entity); background:rgba(62,207,170,.05); }
        .action-btn { width:100%; padding:9px 14px; border-radius:8px; border:1px solid var(--border2); background:transparent; color:var(--text2); font-size:13px; cursor:pointer; transition:all .15s; text-align:left; display:flex; align-items:center; gap:8px; }
        .action-btn:hover { border-color:var(--c-answer); color:var(--c-answer); background:rgba(239,108,141,.05); }
        .action-btn.save-active { border-color:var(--c-entity); color:var(--c-entity); background:rgba(62,207,170,.08); }
        .spinner { width:26px; height:26px; border:2px solid var(--border2); border-top-color:var(--c-answer); border-radius:50%; animation:spin .75s linear infinite; }
        .subject-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; cursor:pointer; transition:all .15s; text-align:left; }
        .subject-card:hover { border-color:var(--border2); background:var(--surface2); transform:translateY(-2px); }
        .subject-card.active { border-color:var(--c-concept); background:rgba(91,141,239,.08); }
        .mcq-option { width:100%; text-align:left; padding:12px 16px; border-radius:10px; border:1.5px solid var(--border2); background:var(--surface); color:var(--text); font-size:14px; cursor:pointer; transition:all .15s; margin-bottom:8px; }
        .mcq-option:hover:not(:disabled) { border-color:var(--c-concept); background:rgba(91,141,239,.08); }
        .mcq-correct { border-color:var(--c-entity) !important; background:rgba(62,207,170,.12) !important; color:var(--c-entity) !important; }
        .mcq-wrong { border-color:var(--c-answer) !important; background:rgba(239,108,141,.12) !important; color:var(--c-answer) !important; }
        .live-dot { width:7px; height:7px; border-radius:50%; background:var(--c-entity); box-shadow:0 0 8px var(--c-entity); animation:blink 2s ease infinite; }
        
        .saved-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; transition:all .2s; backdrop-filter:blur(16px); }
        .saved-card:hover { border-color:rgba(255,255,255,0.2); transform:translateY(-2px); box-shadow:0 12px 24px rgba(0,0,0,0.2); }

      `}</style>

      {/* ── Header ── */}
      {view !== "landing" && (
        <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 24px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={reset}>
              <div style={{ width:30, height:30, borderRadius:8, background:"var(--grad)", backgroundSize:"200%", animation:"gradPan 5s ease infinite", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>R</span>
              </div>
              <span className="logo-text">Root</span>
            </div>
            {/* Nav */}
            <nav style={{ display:"flex", gap:2, marginLeft:8 }}>
              <button className={`nav-btn ${view==="home"?"nav-active":"nav-idle"}`} onClick={reset}>Explore</button>
              <button className={`nav-btn ${view==="dashboard"?"nav-active":"nav-idle"}`} onClick={openDashboard}>
                Dashboard {savedGraphs.length > 0 && <span style={{ marginLeft:4, background:"var(--c-concept)", color:"#fff", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>{savedGraphs.length}</span>}
              </button>
            </nav>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div className="live-dot" />
            <span style={{ fontSize:12, color:"var(--text3)" }}>All systems live</span>
          </div>
        </header>
      )}

      {/* ── Landing View ── */}
      {view === "landing" && <LandingPage onLaunch={() => setView("home")} />}

      {/* ── Quiz View ── */}
      {view === "quiz" && (
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px" }}>
          {mcqLoading ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
              <div className="spinner" />
              <p style={{ color:"var(--text2)", fontSize:14 }}>Generating quiz questions…</p>
            </div>
          ) : quizDone ? (
            <div style={{ maxWidth:480, width:"100%", textAlign:"center", animation:"fadeUp .4s ease" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>{score >= 4 ? "🎉" : score >= 2 ? "👍" : "📚"}</div>
              <h2 style={{ fontSize:28, fontWeight:700, color:"var(--text)", marginBottom:8 }}>Quiz Complete!</h2>
              <p style={{ color:"var(--text2)", fontSize:16, marginBottom:24 }}>You scored <strong style={{ color:"var(--c-entity)" }}>{score} out of {mcqs.length}</strong></p>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button className="think-btn" onClick={() => { setCurrentQ(0); setScore(0); setSelected(null); setQuizDone(false); setShowExplanation(false); }}>Retry quiz</button>
                <button onClick={() => setView("graph")} style={{ padding:"11px 22px", border:"1px solid var(--border2)", borderRadius:10, background:"transparent", color:"var(--text2)", fontSize:14, cursor:"pointer" }}>Back to graph</button>
              </div>
            </div>
          ) : mcqs.length > 0 ? (
            <div style={{ maxWidth:560, width:"100%", animation:"slideIn .3s ease" }}>
              {/* Progress */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <span style={{ fontSize:13, color:"var(--text3)" }}>Question {currentQ+1} of {mcqs.length}</span>
                <span style={{ fontSize:13, color:"var(--c-entity)", fontWeight:600 }}>Score: {score}</span>
              </div>
              <div style={{ height:4, background:"var(--surface2)", borderRadius:99, marginBottom:24, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${((currentQ)/mcqs.length)*100}%`, background:"var(--grad)", backgroundSize:"200%", animation:"gradPan 5s ease infinite", borderRadius:99, transition:"width .3s ease" }} />
              </div>

              <h3 style={{ fontSize:18, fontWeight:600, color:"var(--text)", marginBottom:24, lineHeight:1.5 }}>{mcqs[currentQ].question}</h3>

              {mcqs[currentQ].options.map((opt, i) => (
                <button
                  key={i}
                  className={`mcq-option ${selected !== null ? (i === mcqs[currentQ].correct ? "mcq-correct" : i === selected && selected !== mcqs[currentQ].correct ? "mcq-wrong" : "") : ""}`}
                  disabled={selected !== null}
                  onClick={() => handleAnswer_MCQ(i)}
                >
                  {opt}
                </button>
              ))}

              {showExplanation && (
                <div style={{ marginTop:16, padding:"14px 16px", background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:10, animation:"fadeUp .3s ease" }}>
                  <p style={{ fontSize:12, fontWeight:600, color:selected===mcqs[currentQ].correct?"var(--c-entity)":"var(--c-answer)", marginBottom:6 }}>
                    {selected === mcqs[currentQ].correct ? "✓ Correct!" : "✗ Not quite"}
                  </p>
                  <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.7 }}>{mcqs[currentQ].explanation}</p>
                  <button className="think-btn" style={{ marginTop:14, width:"100%" }} onClick={nextQuestion}>
                    {currentQ+1 >= mcqs.length ? "See results →" : "Next question →"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color:"var(--text3)" }}>No questions generated. Go back and try again.</p>
          )}
        </div>
      )}

      {/* ── Dashboard View ── */}
      {view === "dashboard" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", gap:16, padding:"20px 24px", borderBottom:"1px solid var(--border)" }}>
            <button className={`tab ${dashboardTab==="library"?"tab-active":"tab-idle"}`} onClick={() => setDashboardTab("library")}>My Library</button>
            <button className={`tab ${dashboardTab==="global"?"tab-active":"tab-idle"}`} onClick={() => { setDashboardTab("global"); fetchGlobalBrain(); }}>Global Brain</button>
          </div>
          
          <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>
            {dashboardTab === "library" && (
              <>
                <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text)", marginBottom:6 }}>Saved Graphs</h2>
                <p style={{ fontSize:13, color:"var(--text3)", marginBottom:24 }}>Click any saved graph to replay how the AI built it.</p>
                {savedGraphs.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"60px 24px" }}>
                    <div style={{ fontSize:40, marginBottom:16 }}>📭</div>
                    <p style={{ color:"var(--text3)", fontSize:14 }}>No saved graphs yet.</p>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14, maxWidth:960 }}>
                    {savedGraphs.map(g => (
                      <div key={g.id} className="saved-card" style={{ background:"rgba(255,255,255,0.02)", backdropFilter:"blur(12px)" }}>
                        <p style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:8 }}>{g.question}</p>
                        <p style={{ fontSize:12, color:"var(--text3)", marginBottom:12 }}>{(g.nodes as any)?.nodes?.length || g.nodes.length} nodes · Saved {g.savedAt}</p>
                        <div style={{ display:"flex", gap:8 }}>
                          <button
                            className="think-btn"
                            style={{ flex:1, padding:"8px 0", fontSize:13 }}
                            onClick={() => {
                              setActiveQuestion(g.question);
                              setAnswer(g.answer);
                              setActiveDocText("");
                              // support legacy format where nodes was an array, or new format {nodes, edges}
                              const data = Array.isArray(g.nodes) ? { nodes: g.nodes, edges: [] } : g.nodes;
                              setActiveStaticData(data);
                              setIsReplaying(true);
                              setView("graph");
                            }}
                          >
                            Replay Graph ▶
                          </button>
                          <button onClick={() => deleteSaved(g.id)} style={{ padding:"8px 12px", border:"1px solid var(--border2)", borderRadius:8, background:"transparent", color:"var(--text3)", cursor:"pointer" }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {dashboardTab === "global" && (
              <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
                {globalLoading || !globalStats ? (
                  <div style={{ display:"flex", justifyContent:"center", alignItems:"center", flex:1 }}><div className="spinner" /></div>
                ) : (
                  <>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:24 }}>
                      <div style={{ padding:"20px", background:"rgba(255,255,255,0.03)", borderRadius:16, border:"1px solid var(--border)", backdropFilter:"blur(10px)" }}>
                        <p style={{ fontSize:13, color:"var(--text2)", marginBottom:8 }}>Total Concepts Mastered</p>
                        <p style={{ fontSize:32, fontWeight:800, color:"var(--c-concept)" }}>{globalStats.total_nodes}</p>
                      </div>
                      <div style={{ padding:"20px", background:"rgba(255,255,255,0.03)", borderRadius:16, border:"1px solid var(--border)", backdropFilter:"blur(10px)" }}>
                        <p style={{ fontSize:13, color:"var(--text2)", marginBottom:8 }}>Connections Discovered</p>
                        <p style={{ fontSize:32, fontWeight:800, color:"var(--c-answer)" }}>{globalStats.total_edges}</p>
                      </div>
                      <div style={{ padding:"20px", background:"rgba(255,255,255,0.03)", borderRadius:16, border:"1px solid var(--border)", backdropFilter:"blur(10px)" }}>
                        <p style={{ fontSize:13, color:"var(--text2)", marginBottom:8 }}>Top Entities</p>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {globalStats.top_entities.map((e:any) => <span key={e.label} style={{ fontSize:11, padding:"2px 8px", background:"var(--surface2)", borderRadius:99, color:"var(--c-entity)" }}>{e.label}</span>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ flex:1, minHeight:500, borderRadius:16, border:"1px solid var(--border)", overflow:"hidden", position:"relative", background:"rgba(10,10,14,0.5)" }}>
                      <p style={{ position:"absolute", top:16, left:16, zIndex:10, fontSize:14, fontWeight:600, color:"var(--text)", textShadow:"0 2px 4px rgba(0,0,0,0.5)" }}>The Global Brain</p>
                      <RootGraph
                question={activeQuestion}
                documentText={activeDocText}
                onAnswer={handleAnswer}
                onNodesUpdate={handleNodesUpdate}
                quizMode={quizMode}
                staticData={activeStaticData}
                replayMode={isReplaying}
              />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Graph View ── */}
      {view === "graph" && (
        <>
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            {/* Graph canvas */}
            <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
              <RootGraph
                question={activeQuestion}
                documentText={activeDocText}
                onAnswer={handleAnswer}
                onNodesUpdate={handleNodesUpdate}
                quizMode={quizMode}
                staticData={activeStaticData}
                replayMode={isReplaying}
              />
            </div>

            {/* Right panel */}
            <div style={{ width:360, borderLeft:"1px solid var(--border)", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
                <p style={{ fontSize:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>
                  {activeDocText ? "Document" : "Question"}
                </p>
                {activeDocText && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(62,207,170,.08)", border:"1px solid rgba(62,207,170,.15)", borderRadius:6, padding:"3px 10px", fontSize:12, color:"var(--c-entity)", marginBottom:8 }}>
                    📄 {docName}
                  </div>
                )}
                <p style={{ fontSize:14, color:"var(--text)", lineHeight:1.6 }}>{activeQuestion}</p>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
                {answer ? (
                  <div style={{ animation:"fadeUp .4s ease" }}>
                    <p style={{ fontSize:10, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", color:"var(--c-entity)", marginBottom:14 }}>
                      {activeDocText ? "Key Insights" : "Answer"}
                    </p>
                    <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.9 }}>{answer}</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:14, textAlign:"center" }}>
                    <div className="spinner" />
                    <p style={{ fontSize:13, color:"var(--text3)" }}>{activeDocText ? "Reading document…" : "Building graph…"}</p>
                    <p style={{ fontSize:12, color:"var(--text3)", opacity:.6 }}>Watch the graph grow on the left</p>
                  </div>
                )}
              </div>

              {answer && (
                <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>

                  {/* Save button */}
                  <button className={`action-btn ${isSaved?"save-active":""}`} onClick={saveGraph} disabled={isSaved}>
                    <span>{isSaved ? "✓" : "💾"}</span>
                    <span>{isSaved ? "Saved to your library" : "Save this graph"}</span>
                  </button>

                  {/* Quiz mode toggle */}
                  <button className="action-btn" onClick={toggleQuizMode} style={{ borderColor: quizMode ? "var(--c-question)" : undefined, color: quizMode ? "var(--c-question)" : undefined, background: quizMode ? "rgba(155,114,207,.08)" : undefined }}>
                    <span>🧠</span>
                    <span>{quizMode ? "Exit quiz mode" : "Quiz mode — hide labels"}</span>
                  </button>

                  {/* Generate test */}
                  <button className="action-btn" onClick={startTest} disabled={graphNodes.length === 0}>
                    <span>📝</span>
                    <span>Test me on this topic</span>
                  </button>

                  {/* Start over */}
                  <button className="action-btn" onClick={reset}>
                    <span>←</span>
                    <span>Start over</span>
                  </button>

                  {/* How to use */}
                  <div style={{ marginTop:6, padding:"12px 14px", background:"var(--surface)", borderRadius:10, border:"1px solid var(--border)" }}>
                    <p style={{ fontSize:11, fontWeight:600, color:"var(--text2)", marginBottom:8 }}>How to use the graph</p>
                    {[["🖱","Click any node to see what it means"],["⬇","Press Expand to go deeper"],["🔍","Scroll to zoom, drag to pan"]].map(([icon,text]) => (
                      <div key={text} style={{ display:"flex", gap:8, fontSize:12, color:"var(--text3)", marginBottom:4 }}>
                        <span>{icon}</span><span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Home View ── */}
      {view === "home" && (
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

          {/* Search bar */}
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", gap:4, marginBottom:14 }}>
              <button className={`tab ${mode==="question"?"tab-active":"tab-idle"}`} onClick={() => setMode("question")}>Ask a question</button>
              <button className={`tab ${mode==="document"?"tab-active":"tab-idle"}`} onClick={() => setMode("document")}>Upload a document</button>
            </div>

            {mode === "question" ? (
              <form onSubmit={e => { e.preventDefault(); if (input.trim()) submit(input.trim()); }} style={{ display:"flex", gap:10, maxWidth:780 }}>
                <input className="q-input" value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. Why did the Roman Empire fall?" />
                <button className="think-btn" type="submit" disabled={!input.trim()}>Think →</button>
              </form>
            ) : (
              <div style={{ maxWidth:780 }}>
                {activeDocText ? (
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(62,207,170,.1)", border:"1px solid rgba(62,207,170,.2)", borderRadius:8, padding:"8px 14px", flexShrink:0 }}>
                      <span>📄</span>
                      <span style={{ fontSize:13, color:"var(--c-entity)", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{docName}</span>
                    </div>
                    <input className="q-input" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask something about this document (optional)…" />
                    <button className="think-btn" onClick={() => submit(input.trim() || `Summarize: ${docName}`, activeDocText)}>Analyze →</button>
                    <button onClick={() => { setDocName(""); setActiveDocText(""); }} style={{ background:"none", border:"1px solid var(--border2)", borderRadius:8, color:"var(--text3)", padding:"10px 12px", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ) : (
                  <div
                    className={`drop-zone ${isDragging?"drag-over":""}`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); const f=e.dataTransfer.files[0]; if(f) readFile(f); }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.py,.js,.ts,.pdf" style={{ display:"none" }} onChange={e => { const f=e.target.files?.[0]; if(f) readFile(f); }} />
                    <div style={{ fontSize:32, marginBottom:10 }}>📂</div>
                    <p style={{ fontWeight:600, color:"var(--text)", marginBottom:4 }}>Drop a file here, or click to browse</p>
                    <p style={{ fontSize:12, color:"var(--text3)" }}>Supports .pdf .txt .md .csv .json and code files</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ padding:"24px", flex:1 }}>
            {/* Subject presets */}
            <div style={{ marginBottom:28 }}>
              <p style={{ fontSize:13, fontWeight:600, color:"var(--text2)", marginBottom:14 }}>Browse by subject</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:10, maxWidth:840 }}>
                {SUBJECTS.map(s => (
                  <button key={s.label} className={`subject-card ${selectedSubject?.label===s.label?"active":""}`} onClick={() => setSelectedSubject(selectedSubject?.label===s.label?null:s)}>
                    <div style={{ fontSize:24, marginBottom:8 }}>{s.emoji}</div>
                    <div style={{ fontWeight:600, fontSize:14, color:"var(--text)" }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject examples */}
            {selectedSubject && (
              <div style={{ marginBottom:28, animation:"fadeUp .3s ease" }}>
                <p style={{ fontSize:13, fontWeight:600, color:"var(--text2)", marginBottom:12 }}>
                  {selectedSubject.emoji} {selectedSubject.label} questions
                </p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {selectedSubject.examples.map(ex => (
                    <button key={ex} className="chip" onClick={() => { setInput(ex); submit(ex); }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick examples */}
            {!selectedSubject && (
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:"var(--text2)", marginBottom:12 }}>Or try one of these</p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {ALL_EXAMPLES.map(ex => (
                    <button key={ex} className="chip" onClick={() => { setInput(ex); submit(ex); }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
