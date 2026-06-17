# ThinkMap 🧠

> AI that builds a live knowledge graph as it reasons — so you can see exactly how it thinks.

**Google gives you links. ChatGPT gives you answers. ThinkMap gives you understanding.**

---

## What it does

Type any complex question. ThinkMap:
1. Decomposes it into sub-questions and named entities (graph nodes)
2. Builds relationships between them with confidence scores (graph edges)
3. Streams the graph to your screen **live** — node by node
4. Traverses its own graph to write the final answer
5. Lets you click any node to go deeper, or challenge any edge

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Cytoscape.js, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Graph DB | Neo4j 5 |
| Vector DB | Qdrant |
| LLM | Claude (Anthropic) via structured output |
| Agent | LangGraph |
| Transport | WebSockets (live graph streaming) |

---

## Setup

### Prerequisites
- Docker + Docker Compose
- Node.js 18+
- An Anthropic API key

### 1. Clone and configure

```bash
git clone <your-repo>
cd thinkmap
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Start the databases + backend

```bash
docker-compose up --build
```

This starts:
- Neo4j at http://localhost:7474 (browser UI — login: neo4j / thinkmap123)
- Qdrant at http://localhost:6333
- FastAPI backend at http://localhost:8000

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Project structure

```
thinkmap/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── core/config.py       # Settings from env vars
│   │   ├── graph/
│   │   │   ├── neo4j_client.py  # Graph DB helpers
│   │   │   └── qdrant_client.py # Vector store helpers
│   │   ├── agent/
│   │   │   ├── llm.py           # LLM calls (decompose, challenge, expand)
│   │   │   └── pipeline.py      # Main graph-building pipeline
│   │   ├── api/routes.py        # REST + WebSocket endpoints
│   │   └── models/graph.py      # Pydantic models
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.tsx             # Main page
    │   └── layout.tsx
    └── components/
        └── ThinkMapGraph.tsx    # Cytoscape graph + WebSocket
```

---

## What makes this novel (for interviews)

1. **GraphRAG over naive RAG** — retrieval traverses entity relationships in Neo4j, not just cosine similarity. This dramatically improves multi-hop question answering.

2. **Live graph streaming** — the agent's reasoning is externalised in real time via WebSocket, not returned as a finished answer.

3. **Confidence scoring layer** — every node and edge has a sourced/inferred/uncertain confidence tag. Uncertain edges render dashed. Users can challenge any edge and trigger a re-evaluation pass.

4. **Interactive feedback loop** — clicking a node injects context back into the next agent call. The graph evolves based on user steering, not just AI output.

---

## Benchmark (Phase 5)

Run this after Phase 5 to generate your interview talking point:

```bash
cd backend
python scripts/benchmark.py  # GraphRAG vs naive RAG on HotpotQA
```

---

## Roadmap

- [x] Phase 1 — Foundation (Neo4j, Qdrant, FastAPI, LLM)
- [x] Phase 2 — Agent brain (decomposition, GraphRAG, confidence scoring)
- [x] Phase 3 — Live graph UI (Cytoscape, WebSocket streaming)
- [x] Phase 4 — User interactions (expand, challenge, fork)
- [ ] Phase 5 — Auth, graph saving, share links, benchmark, deploy
