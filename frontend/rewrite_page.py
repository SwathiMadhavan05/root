import re

with open("app/page.tsx", "r") as f:
    content = f.read()

# 1. Add new states
state_addition = """  const [view, setView] = useState<"home"|"graph"|"dashboard"|"quiz">("home");
  const [dashboardTab, setDashboardTab] = useState<"library"|"global">("library");
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [globalGraph, setGlobalGraph] = useState<any>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [activeStaticData, setActiveStaticData] = useState<any>(null);
  const [isReplaying, setIsReplaying] = useState(false);
"""
content = re.sub(r'  const \[view, setView\] = useState.*?;\n', state_addition, content)

# 2. Update toggle logic and fetch global
fetch_global_fn = """  const fetchGlobalBrain = async () => {
    if (globalStats) return;
    setGlobalLoading(true);
    try {
      const s = await fetch("http://localhost:8000/api/dashboard/stats").then(r => r.json());
      const g = await fetch("http://localhost:8000/api/dashboard/global").then(r => r.json());
      setGlobalStats(s);
      setGlobalGraph(g);
    } catch {}
    setGlobalLoading(false);
  };

  const openDashboard = () => {
    setView("dashboard");
    if (dashboardTab === "global") fetchGlobalBrain();
  };
"""
content = content.replace("  const deleteSaved = (id: string) => {", fetch_global_fn + "\n  const deleteSaved = (id: string) => {")

# 3. Update submit to clear replay state
content = content.replace("    setQuizMode(false); setMcqs([]);\n", "    setQuizMode(false); setMcqs([]); setActiveStaticData(null); setIsReplaying(false);\n")

# 4. Nav update
content = content.replace('onClick={() => setView("saved")}', 'onClick={openDashboard}')
content = content.replace('view==="saved"?"nav-active"', 'view==="dashboard"?"nav-active"')
content = content.replace('Saved {savedGraphs.length', 'Dashboard')

# 5. Dashboard View
dashboard_view = """      {/* ── Dashboard View ── */}
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
                      <RootGraph question="" onAnswer={()=>{}} staticData={globalGraph} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}"""

content = re.sub(r'      \{\/\* ── Saved View ── \*\/}.*?(?=      \{\/\* ── Graph View ── \*\/})', dashboard_view + "\n\n", content, flags=re.DOTALL)

# 6. Update Graph View Props
graph_props = """              <RootGraph
                question={activeQuestion}
                documentText={activeDocText}
                onAnswer={handleAnswer}
                onNodesUpdate={handleNodesUpdate}
                quizMode={quizMode}
                staticData={activeStaticData}
                replayMode={isReplaying}
              />"""
content = re.sub(r'              <RootGraph.*?\/>', graph_props, content, flags=re.DOTALL)

# 7. Add Glassmorphism css
css_add = """
        .saved-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; transition:all .2s; backdrop-filter:blur(16px); }
        .saved-card:hover { border-color:rgba(255,255,255,0.2); transform:translateY(-2px); box-shadow:0 12px 24px rgba(0,0,0,0.2); }
"""
content = content.replace('.saved-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; transition:all .15s; }\n        .saved-card:hover { border-color:var(--border2); }', css_add)

with open("app/page.tsx", "w") as f:
    f.write(content)
