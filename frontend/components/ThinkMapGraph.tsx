"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface GraphNode {
  id: string;
  label: string;
  fullLabel?: string;
  node_type: "concept" | "entity" | "question" | "answer";
  confidence: "sourced" | "inferred" | "uncertain";
  description?: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationship: string;
  confidence: "sourced" | "inferred" | "uncertain";
}

interface Props {
  question?: string;
  documentText?: string;
  onAnswer?: (a: string) => void;
  onNodesUpdate?: (nodes: any[]) => void;
  quizMode?: boolean;
  staticData?: { nodes: any[]; edges: any[] };
  replayMode?: boolean;
}

const COLORS: Record<string, string> = {
  concept: "#5B8DEF",
  entity: "#3ECFAA",
  question: "#9B72CF",
  answer: "#EF6C8D",
};

export default function RootGraph({ question, documentText, onAnswer, onNodesUpdate, quizMode, staticData, replayMode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const questionRef = useRef(question || "");
  const graphIdRef = useRef<string>("");

  const [status, setStatus] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [deepDesc, setDeepDesc] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<any>(null);

  // Replay State
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const replayTimer = useRef<any>(null);

  useEffect(() => {
    questionRef.current = question || "";
  }, [question]);

  // Init Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      const cola = (await import("cytoscape-cola")).default;
      if (!destroyed) cytoscape.use(cola);
      if (destroyed || !containerRef.current) return;

      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [],
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              "background-opacity": 0.15,
              label: "data(label)",
              color: "#ECECF1",
              "font-size": "11px",
              "font-family": "Inter, -apple-system, sans-serif",
              "font-weight": "bold",
              "text-valign": "bottom",
              "text-halign": "center",
              "text-margin-y": 8,
              "text-wrap": "wrap",
              "text-max-width": "120px",
              width: "data(size)",
              height: "data(size)",
              "border-width": 3,
              "border-color": "data(color)",
              "border-opacity": 0.9,
              "transition-property": "background-opacity, border-width, border-color, scale",
              "transition-duration": 0.2,
            },
          },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": "rgba(255,255,255,0.12)",
              "target-arrow-color": "rgba(255,255,255,0.18)",
              "target-arrow-shape": "triangle",
              "arrow-scale": 0.8,
              "curve-style": "bezier",
              "control-point-step-size": 40,
              label: "data(relationship)",
              "font-size": "9px",
              "font-family": "Inter, -apple-system, sans-serif",
              "font-weight": "normal",
              color: "#9999B3",
              "text-rotation": "autorotate",
              "text-background-color": "#0F0F13",
              "text-background-opacity": 0,
              "text-opacity": 0,
              "text-background-padding": "3px" as any,
              "text-background-shape": "roundrectangle",
              "text-border-width": 0,
              opacity: "data(opacity)" as any,
              "transition-property": "width, line-color, opacity, text-opacity, text-background-opacity",
              "transition-duration": 0.2,
            },
          },
          {
            selector: "edge[confidence='uncertain']",
            style: { "line-style": "dashed", "line-dash-pattern": [5, 3] },
          },
          {
            selector: "node:selected",
            style: {
              "background-opacity": 0.85,
              "border-color": "#FFFFFF",
              "border-width": 4,
            },
          },
          {
            selector: ".focused",
            style: {
              "background-opacity": 0.9,
              "border-color": "#FFFFFF",
              "border-width": 4.5,
            },
          },
          {
            selector: ".highlighted",
            style: {
              "border-opacity": 1,
              "border-width": 3.5,
              "background-opacity": 0.35,
              "line-color": "rgba(255, 255, 255, 0.45)",
              "target-arrow-color": "rgba(255, 255, 255, 0.6)",
              "text-background-opacity": 0.9,
              "text-opacity": 1,
              "color": "#ECECF1",
              "width": 2.5
            },
          },
          {
            selector: "node.dimmed",
            style: {
              "opacity": 0.15,
            }
          },
          {
            selector: "edge.dimmed",
            style: {
              "opacity": 0.08,
            }
          }
        ],
        layout: { name: "preset" },
        userZoomingEnabled: true,
        userPanningEnabled: true,
      });

      // Tapping on node highlights neighborhood and dims other elements
      cyRef.current.on("tap", "node", (evt: any) => {
        const node = evt.target;
        const cy = cyRef.current;
        cy.elements().removeClass("focused dimmed highlighted");
        cy.elements().addClass("dimmed");

        node.removeClass("dimmed").addClass("focused");
        const neighborhood = node.neighborhood();
        neighborhood.removeClass("dimmed").addClass("highlighted");

        const data = node.data();
        setSelected(data);
        setSelectedEdge(null);
        setDeepDesc(data.description || "");
        setChallengeResult(null);
      });

      // Tapping on edge selects it and allows challenging
      cyRef.current.on("tap", "edge", (evt: any) => {
        const edge = evt.target;
        const cy = cyRef.current;
        cy.elements().removeClass("focused dimmed highlighted");
        cy.elements().addClass("dimmed");

        edge.removeClass("dimmed").addClass("highlighted");
        const source = edge.source();
        const target = edge.target();
        source.removeClass("dimmed").addClass("highlighted");
        target.removeClass("dimmed").addClass("highlighted");

        setSelected(null);
        setDeepDesc("");
        setChallengeResult(null);

        const sourceLabel = source.data().fullLabel || source.data().label;
        const targetLabel = target.data().fullLabel || target.data().label;

        setSelectedEdge({
          id: edge.data().id,
          source: edge.data().source,
          target: edge.data().target,
          sourceLabel,
          targetLabel,
          relationship: edge.data().relationship,
          confidence: edge.data().confidence,
        });
      });

      // Tapping canvas background resets focus
      cyRef.current.on("tap", (evt: any) => {
        if (evt.target === cyRef.current) {
          cyRef.current.elements().removeClass("focused dimmed highlighted");
          setSelected(null);
          setSelectedEdge(null);
          setDeepDesc("");
          setChallengeResult(null);
        }
      });
    })();

    return () => {
      destroyed = true;
      cyRef.current?.destroy();
    };
  }, []);

  const addNode = useCallback((node: GraphNode) => {
    if (!cyRef.current) return;
    const existing = cyRef.current.getElementById(node.id);
    if (existing.length) return; // deduplicate
    const count = cyRef.current.nodes().length;
    const angle = (count / 6) * 2 * Math.PI;
    const r = 160 + count * 14;
    const color = COLORS[node.node_type] ?? "#9B72CF";
    cyRef.current.add({
      group: "nodes",
      data: {
        id: node.id,
        label: node.label.length > 24 ? node.label.slice(0, 24) + "…" : node.label,
        fullLabel: node.label,
        node_type: node.node_type,
        confidence: node.confidence,
        description: node.description || "",
        color,
        shadow: shadeColor(color, -60),
        size: node.node_type === "answer" ? 80 : node.node_type === "question" ? 66 : 56,
      },
      position: { x: 340 + r * Math.cos(angle), y: 270 + r * Math.sin(angle) },
    });
    setNodeCount(c => c + 1);
    if (count % 3 === 0) runLayout();
    
    // Notify parent of updated nodes for quiz/save
    if (onNodesUpdate) {
      const allNodes = cyRef.current?.nodes().map((n: any) => n.data()) || [];
      const allEdges = cyRef.current?.edges().map((e: any) => e.data()) || [];
      onNodesUpdate({ nodes: allNodes, edges: allEdges } as any);
    }
  }, [onNodesUpdate]);

  const addEdge = useCallback((edge: GraphEdge) => {
    if (!cyRef.current) return;
    if (!cyRef.current.getElementById(edge.from).length) return;
    if (!cyRef.current.getElementById(edge.to).length) return;
    if (cyRef.current.getElementById(edge.id).length) return;
    cyRef.current.add({
      group: "edges",
      data: {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        relationship: edge.relationship.replace(/_/g, " "),
        confidence: edge.confidence,
        opacity: edge.confidence === "sourced" ? 1 : edge.confidence === "inferred" ? 0.7 : 0.4,
      },
    });
  }, []);

  const runLayout = () => {
    cyRef.current?.layout({
      name: "cola",
      animate: true,
      animationDuration: 500,
      fit: true,
      padding: 50,
      nodeSpacing: 50,
      edgeLength: 130,
      avoidOverlap: true,
      handleDisconnected: true
    }).run();
  };

  // Render Static Data & Replay Logic
  useEffect(() => {
    if (!staticData || !cyRef.current) return;
    
    if (replayMode) {
      setReplayIndex(0);
      setIsPlaying(false);
      cyRef.current.elements().remove();
      setNodeCount(0);
    } else {
      cyRef.current.elements().remove();
      setNodeCount(0);
      staticData.nodes.forEach((n: any) => addNode(n.data ? n.data : n));
      staticData.edges.forEach((e: any) => addEdge(e.data ? e.data : e));
      setTimeout(runLayout, 100);
    }
  }, [staticData, replayMode, addNode, addEdge]);

  useEffect(() => {
    if (!staticData || !replayMode) return;
    if (isPlaying) {
      replayTimer.current = setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= staticData.nodes.length + staticData.edges.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500); // 500ms between each node/edge
    } else {
      clearInterval(replayTimer.current);
    }
    return () => clearInterval(replayTimer.current);
  }, [isPlaying, staticData, replayMode]);

  useEffect(() => {
    if (!staticData || !replayMode || !cyRef.current) return;
    cyRef.current.elements().remove();
    setNodeCount(0);
    let nCount = 0;
    let eCount = 0;
    for (let i = 0; i < replayIndex; i++) {
      if (nCount < staticData.nodes.length) {
        addNode(staticData.nodes[nCount].data || staticData.nodes[nCount]);
        nCount++;
      } else if (eCount < staticData.edges.length) {
        addEdge(staticData.edges[eCount].data || staticData.edges[eCount]);
        eCount++;
      }
    }
    if (replayIndex > 0 && replayIndex % 3 === 0) runLayout();
  }, [replayIndex, staticData, replayMode, addNode, addEdge]);

  useEffect(() => {
    if (staticData) return; // Skip WS if static data is provided
    if (!question) return;
    setIsThinking(true);
    setNodeCount(0);
    setSelected(null);
    setSelectedEdge(null);
    setDeepDesc("");
    setChallengeResult(null);
    setStatus("Connecting...");
    cyRef.current?.elements().remove();
    graphIdRef.current = "";

    let baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    if (baseWsUrl.startsWith("http://")) baseWsUrl = baseWsUrl.replace("http://", "ws://");
    if (baseWsUrl.startsWith("https://")) baseWsUrl = baseWsUrl.replace("https://", "wss://");
    const wsUrl = documentText ? `${baseWsUrl}/api/ws/document` : `${baseWsUrl}/api/ws/query`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify(documentText ? { question, document_text: documentText } : { question }));
      setStatus(documentText ? "Reading document…" : "Thinking…");
    };
    ws.onmessage = (msg) => {
      const ev = JSON.parse(msg.data);
      switch (ev.event) {
        case "graph_created":
          graphIdRef.current = ev.graph_id;
          break;
        case "thinking":
          setStatus(ev.message);
          break;
        case "node_added":
          addNode(ev.node);
          setStatus(`Building graph…`);
          break;
        case "edge_added":
          addEdge(ev.edge);
          break;
        case "answer_ready":
          graphIdRef.current = ev.graph_id;
          if (onAnswer) onAnswer(ev.answer);
          setIsThinking(false);
          setStatus("Done");
          setTimeout(() => {
            runLayout();
            if (onNodesUpdate) {
              const allNodes = cyRef.current?.nodes().map((n: any) => n.data()) || [];
              const allEdges = cyRef.current?.edges().map((e: any) => e.data()) || [];
              onNodesUpdate({ nodes: allNodes, edges: allEdges } as any);
            }
          }, 100);
          break;
        case "done":
          setIsThinking(false);
          break;
        case "error":
          setStatus(`Error: ${ev.message}`);
          setIsThinking(false);
          break;
      }
    };
    ws.onerror = () => {
      setStatus("Backend not reachable");
      setIsThinking(false);
    };
    ws.onclose = () => setIsThinking(false);
    return () => ws.close();
  }, [question, documentText, addNode, addEdge, onAnswer]);

  // Quiz mode — hide/show node labels
  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.nodes().forEach((n: any) => {
      n.style("label", quizMode ? "?" : n.data("label"));
      n.style("background-opacity", quizMode ? 0.5 : 0.15); // Translucent in quiz mode too
    });
  }, [quizMode]);

  const handleExpand = async () => {
    if (!selected || isExpanding) return;
    setIsExpanding(true);
    setDeepDesc("Loading…");
    try {
      const res = await fetch("http://localhost:8000/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: selected.id,
          label: selected.label,
          graph_id: graphIdRef.current || "",
          context: questionRef.current
        }),
      });
      const data = await res.json();
      if (data.node_description) {
        setDeepDesc(data.node_description);
        
        // Update Cytoscape node properties for persistence on tap
        const cyNode = cyRef.current.getElementById(selected.id);
        if (cyNode.length) {
          cyNode.data("description", data.node_description);
        }
        setSelected(prev => prev ? { ...prev, description: data.node_description } : null);
      }
      data.new_nodes?.forEach(addNode);
      setTimeout(() => {
        data.new_edges?.forEach(addEdge);
        runLayout();
      }, 100);
      setStatus("Expanded");
    } catch {
      setDeepDesc("Could not expand — try again.");
    }
    setIsExpanding(false);
  };

  const handleChallenge = async () => {
    if (!selectedEdge || isChallenging) return;
    setIsChallenging(true);
    setChallengeResult(null);
    try {
      const res = await fetch("http://localhost:8000/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edge_id: selectedEdge.id,
          graph_id: graphIdRef.current || "",
          from_label: selectedEdge.sourceLabel,
          to_label: selectedEdge.targetLabel,
          relationship: selectedEdge.relationship,
        }),
      });
      const data = await res.json();
      if (data.verdict) {
        setChallengeResult({
          edgeId: selectedEdge.id,
          verdict: data.verdict,
          explanation: data.explanation,
        });

        // Update Cytoscape edge styles and confidence level
        const cyEdge = cyRef.current.getElementById(selectedEdge.id);
        if (cyEdge.length) {
          cyEdge.data("confidence", data.new_confidence);
          cyEdge.data("opacity", data.new_confidence === "sourced" ? 1 : data.new_confidence === "inferred" ? 0.7 : 0.4);
          
          if (data.new_confidence === "uncertain") {
            cyEdge.style("line-style", "dashed");
            cyEdge.style("line-dash-pattern", [5, 3]);
          } else {
            cyEdge.style("line-style", "solid");
          }
        }

        setSelectedEdge((prev: any) => prev ? { ...prev, confidence: data.new_confidence } : null);
      }
    } catch {
      alert("Could not challenge connection — try again.");
    }
    setIsChallenging(false);
  };

  const nodeColor = selected ? COLORS[selected.node_type] : "#9B72CF";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "var(--bg)" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
        .expand-btn {
          width:100%; padding:9px 0; border:none; border-radius:8px;
          color:#fff; font-size:13px; font-weight:600; cursor:pointer;
          transition:opacity .15s, transform .15s;
        }
        .expand-btn:hover { opacity:.88; transform:translateY(-1px); }
        .expand-btn:disabled { opacity:.4; transform:none; cursor:not-allowed; }
      `}</style>

      {/* Graph canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", background: "transparent" }} />

      {/* Status bar — bottom left */}
      <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", alignItems: "center", gap: 8, background: "rgba(15,15,19,.9)", padding: "5px 14px", borderRadius: 99, border: "1px solid var(--border)", backdropFilter: "blur(12px)", pointerEvents: "none" }}>
        {isThinking && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-answer)", animation: "blink .9s ease infinite" }} />}
        <span style={{ fontSize: 11, color: "var(--text3)" }}>{status || (isThinking ? "Thinking…" : "Ready")}</span>
        {nodeCount > 0 && <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: 4, borderLeft: "1px solid var(--border2)", paddingLeft: 8 }}>{nodeCount} nodes</span>}
      </div>

      {/* Node detail panel — left side */}
      {selected && (
        <div style={{ position: "absolute", top: 16, left: 16, width: 270, background: "var(--surface)", border: `1.5px solid ${nodeColor}35`, borderRadius: 14, padding: 18, animation: "fadeIn .2s ease", backdropFilter: "blur(16px)", maxHeight: "calc(100% - 80px)", overflowY: "auto" }}>

          {/* Node type badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: nodeColor, background: `${nodeColor}18`, padding: "3px 10px", borderRadius: 6 }}>
              {selected.node_type}
            </span>
            <button onClick={() => { setSelected(null); setDeepDesc(""); cyRef.current?.elements().removeClass("focused dimmed highlighted"); }} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>

          {/* Label */}
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 10, lineHeight: 1.4 }}>
            {selected.fullLabel || selected.label}
          </h3>

          {/* Description */}
          {selected.description && (
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8, marginBottom: 14 }}>
              {selected.description}
            </p>
          )}

          {/* Confidence indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12, color: "var(--text3)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: selected.confidence === "sourced" ? "var(--c-entity)" : selected.confidence === "uncertain" ? "#FFB800" : "var(--c-concept)" }} />
            {selected.confidence === "sourced" ? "Well-established fact" : selected.confidence === "inferred" ? "Logically inferred" : "Uncertain — interpret with caution"}
          </div>

          {/* Deep dive result */}
          {deepDesc && deepDesc !== "Loading…" && (
            <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border2)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--c-entity)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Deep dive</p>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8 }}>{deepDesc}</p>
            </div>
          )}

          {deepDesc === "Loading…" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, color: "var(--text3)" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--border2)", borderTopColor: "var(--c-entity)", animation: "spin .7s linear infinite" }} />
              Expanding…
            </div>
          )}

          <button
            className="expand-btn"
            onClick={handleExpand}
            disabled={isExpanding}
            style={{ background: `linear-gradient(135deg, ${nodeColor}, #9B72CF)` }}
          >
            {isExpanding ? "Expanding…" : "Expand this concept ↓"}
          </button>
        </div>
      )}

      {/* Edge detail panel — left side */}
      {selectedEdge && (
        <div style={{ position: "absolute", top: 16, left: 16, width: 270, background: "var(--surface)", border: `1.5px solid var(--border2)`, borderRadius: 14, padding: 18, animation: "fadeIn .2s ease", backdropFilter: "blur(16px)", maxHeight: "calc(100% - 80px)", overflowY: "auto" }}>

          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-question)", background: `rgba(155,114,207,.18)`, padding: "3px 10px", borderRadius: 6 }}>
              Connection
            </span>
            <button onClick={() => { setSelectedEdge(null); cyRef.current?.elements().removeClass("focused dimmed highlighted"); }} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>

          {/* Labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{selectedEdge.sourceLabel}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text3)", margin: "2px 0 2px 8px", borderLeft: "2px solid var(--border2)", paddingLeft: 8 }}>
              {selectedEdge.relationship}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{selectedEdge.targetLabel}</div>
          </div>

          {/* Confidence indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12, color: "var(--text3)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: selectedEdge.confidence === "sourced" ? "var(--c-entity)" : selectedEdge.confidence === "uncertain" ? "#FFB800" : "var(--c-concept)" }} />
            {selectedEdge.confidence === "sourced" ? "Well-established fact" : selectedEdge.confidence === "inferred" ? "Logically inferred" : "Uncertain connection"}
          </div>

          {/* Challenge results */}
          {challengeResult && challengeResult.edgeId === selectedEdge.id && (
            <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border2)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: challengeResult.verdict === "confirmed" ? "var(--c-entity)" : "var(--c-answer)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                Verdict: {challengeResult.verdict}
              </p>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8 }}>{challengeResult.explanation}</p>
            </div>
          )}

          {isChallenging && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, color: "var(--text3)" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--border2)", borderTopColor: "var(--c-answer)", animation: "spin .7s linear infinite" }} />
              Verifying connection…
            </div>
          )}

          <button
            className="expand-btn"
            onClick={handleChallenge}
            disabled={isChallenging}
            style={{ background: `linear-gradient(135deg, var(--c-question), var(--c-answer))` }}
          >
            {isChallenging ? "Verifying..." : "Challenge this edge ⚡"}
          </button>
        </div>
      )}

      {/* Legend — bottom right */}
      <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 7, background: "rgba(15,15,19,.88)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", backdropFilter: "blur(12px)", pointerEvents: "none" }}>
        {Object.entries(COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 11, color: "var(--text3)", textTransform: "capitalize" }}>{type}</span>
          </div>
        ))}
      </div>

      {/* First-time hint — shows when graph is done and nothing selected */}
      {!isThinking && nodeCount > 0 && !selected && !selectedEdge && !replayMode && (
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(15,15,19,.88)", border: "1px solid var(--border2)", borderRadius: 99, padding: "6px 18px", fontSize: 12, color: "var(--text3)", animation: "fadeIn .4s ease", pointerEvents: "none", backdropFilter: "blur(8px)", whiteSpace: "nowrap" }}>
          👆 Click any node or connection to see what it means
        </div>
      )}

      {/* Replay Controls */}
      {replayMode && staticData && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,25,0.85)", backdropFilter: "blur(12px)", padding: "12px 24px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 16, zIndex: 10 }}>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-entity)", border: "none", color: "#000", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <input type="range" min={0} max={staticData.nodes.length + staticData.edges.length} value={replayIndex} onChange={e => { setReplayIndex(Number(e.target.value)); setIsPlaying(false); }} style={{ width: 200, accentColor: "var(--c-entity)" }} />
          <span style={{ color: "var(--text3)", fontSize: 12, width: 60, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{replayIndex} / {staticData.nodes.length + staticData.edges.length}</span>
        </div>
      )}
    </div>
  );
}

// Darken a hex colour by amount
function shadeColor(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xFF) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xFF) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
