"use client";
import React, { useEffect, useState } from "react";

export default function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "var(--bg)",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text)"
    }}>
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; filter: blur(70px); }
          50% { opacity: 0.6; filter: blur(100px); }
        }
        @keyframes fadeUpIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bg-orb {
          position: absolute;
          border-radius: 50%;
          animation: pulseGlow 10s ease-in-out infinite;
          z-index: 0;
        }
        .landing-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: fadeUpIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .landing-title {
          font-size: clamp(56px, 8vw, 88px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.1;
          margin-bottom: 24px;
          background: var(--grad);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 200% auto;
          animation: gradPan 8s linear infinite;
        }
        .landing-subtitle {
          font-size: 20px;
          color: var(--text2);
          max-width: 600px;
          margin-bottom: 48px;
          line-height: 1.6;
        }
        .cta-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #FFF;
          font-size: 18px;
          font-weight: 600;
          padding: 16px 48px;
          border-radius: 99px;
          cursor: pointer;
          backdrop-filter: blur(12px);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 40px rgba(155, 114, 207, 0.2);
        }
        .cta-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 12px 50px rgba(155, 114, 207, 0.4);
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-top: 80px;
          width: 100%;
          max-width: 1080px;
          padding: 0 24px;
        }
        .feature-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 32px;
          border-radius: 20px;
          backdrop-filter: blur(20px);
          text-align: left;
          transition: all 0.4s ease;
        }
        .feature-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-6px);
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 24px;
        }
      `}</style>

      {/* Animated Background Orbs */}
      <div className="bg-orb" style={{ width: 600, height: 600, background: "var(--c-question)", top: "-10%", left: "-10%", animationDelay: "0s" }} />
      <div className="bg-orb" style={{ width: 500, height: 500, background: "var(--c-concept)", bottom: "-10%", right: "-5%", animationDelay: "3s" }} />
      <div className="bg-orb" style={{ width: 400, height: 400, background: "var(--c-answer)", top: "30%", left: "40%", animationDelay: "6s", opacity: 0.2 }} />

      {/* Grid overlay */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px", zIndex: 1, maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)" }} />

      {/* Content */}
      <div className="landing-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--grad)", backgroundSize: "200%", animation: "gradPan 5s ease infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>R</span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.5px", background: "var(--grad)", backgroundSize: "200% 200%", animation: "gradPan 5s ease infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ThinkMap
          </span>
        </div>

        <h1 className="landing-title">See How AI Thinks.<br/>Live.</h1>
        <p className="landing-subtitle">
          Type any complex question. Watch as ThinkMap decomposes it, builds a knowledge graph in real-time, and navigates its own thoughts to find the answer.
        </p>

        <button className="cta-btn" onClick={onLaunch}>
          Launch ThinkMap →
        </button>

        <div className="features-grid">
          <div className="feature-card" style={{ animation: "fadeUpIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards", animationDelay: "0.2s", opacity: 0 }}>
            <div className="feature-icon" style={{ background: "rgba(155,114,207,0.15)", color: "var(--c-question)" }}>🕸️</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>Live Graph Streaming</h3>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>Watch the AI's reasoning unfold before your eyes as it maps concepts and connections via WebSockets.</p>
          </div>
          
          <div className="feature-card" style={{ animation: "fadeUpIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards", animationDelay: "0.3s", opacity: 0 }}>
            <div className="feature-icon" style={{ background: "rgba(91,141,239,0.15)", color: "var(--c-concept)" }}>🧠</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>Deep Knowledge</h3>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>Click on any concept to expand it and discover deeper truths stored permanently in the Global Brain.</p>
          </div>

          <div className="feature-card" style={{ animation: "fadeUpIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards", animationDelay: "0.4s", opacity: 0 }}>
            <div className="feature-icon" style={{ background: "rgba(62,207,170,0.15)", color: "var(--c-entity)" }}>⏪</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>Time-Travel Replay</h3>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>Rewind and replay exactly how the AI reasoned through past queries with step-by-step graph animation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
