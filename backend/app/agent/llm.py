from groq import Groq
import json
from app.core.config import settings
from app.models.graph import DecompositionOutput

client = Groq(api_key=settings.groq_api_key)

DECOMPOSE_SYSTEM = """You are Root's reasoning engine. Your job is to break down a question into a clear knowledge graph.

STRICT RULES:
- Every node MUST be directly relevant to the question. No exceptions.
- NO duplicate nodes. Each concept appears exactly once.
- Keep node labels short: 2-4 words maximum.
- Create exactly 5-7 nodes total.
- Create exactly 4-6 relationships.
- Relationships must only connect nodes that actually exist in sub_questions.

Return this exact JSON structure:
{
  "sub_questions": [
    {
      "text": "short label (2-4 words)",
      "node_type": "concept",
      "description": "One clear sentence explaining what this is and why it matters to the question."
    }
  ],
  "relationships": [
    {
      "from_label": "exact text from sub_questions",
      "to_label": "exact text from sub_questions",
      "relationship": "caused by",
      "confidence": "sourced"
    }
  ],
  "answer_summary": "3-4 sentences directly answering the question in plain English."
}

node_type must be one of: concept, entity, question
confidence must be one of: sourced, inferred, uncertain
relationship should be simple plain English: "caused by", "led to", "part of", "resulted in", "supported by"

Return ONLY the JSON object. No markdown, no explanation."""

EXPAND_SYSTEM = """You are Root's deep-dive engine. A user wants to learn more about a specific concept.

STRICT RULES:
- All new nodes must be directly related to BOTH the concept AND the original question context.
- No duplicates — do not create nodes that likely already exist in the graph.
- Keep labels short: 2-4 words.
- Create exactly 4-5 detailed sub-nodes that break down the concept into its key mechanisms, components, or historical/logical contexts.

Return this exact JSON:
{
  "node_description": "A comprehensive deep-dive explanation of this concept (4-5 detailed sentences), detailing its core mechanism, real-world significance, and direct connection to the original question context.",
  "sub_nodes": [
    {
      "text": "short label (2-4 words)",
      "node_type": "concept",
      "description": "One clear, informative sentence explaining this sub-concept's role."
    }
  ],
  "relationships": [
    {
      "from_label": "parent concept label",
      "to_label": "new sub-node label",
      "relationship": "includes",
      "confidence": "sourced"
    }
  ]
}

Return ONLY the JSON object. No markdown, no explanation."""

ANSWER_SYSTEM = """Write a clear, helpful answer in plain English. Use 3 short paragraphs. No bullet points, no markdown. Just clear flowing text that a smart student could understand."""

DOCUMENT_SYSTEM = """You are Root's document analyzer. Extract the key concepts from the document and map them as a knowledge graph.

STRICT RULES:
- Only use concepts that actually appear in the document.
- No duplicates.
- Keep labels short: 2-4 words.
- Create 5-8 nodes from the document content.

Return this exact JSON:
{
  "sub_questions": [
    {
      "text": "short label",
      "node_type": "concept",
      "description": "One sentence from or about the document explaining this concept."
    }
  ],
  "relationships": [
    {
      "from_label": "exact text from sub_questions",
      "to_label": "exact text from sub_questions",
      "relationship": "relates to",
      "confidence": "sourced"
    }
  ],
  "answer_summary": "3-4 sentences summarizing the document's main ideas relevant to the question."
}

Return ONLY the JSON object. No markdown."""

def _call(system: str, user: str) -> str:
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        temperature=0.2,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()

def decompose_query(question: str) -> DecompositionOutput:
    raw = _call(DECOMPOSE_SYSTEM, f"Question: {question}")
    data = json.loads(raw)
    # Deduplicate nodes
    seen = set()
    unique = []
    for item in data.get("sub_questions", []):
        key = item["text"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(item)
    data["sub_questions"] = unique
    return DecompositionOutput(**data)

def expand_node(label: str, context: str = "") -> dict:
    prompt = f'Concept: "{label}"\nOriginal question: {context}'
    raw = _call(EXPAND_SYSTEM, prompt)
    return json.loads(raw)

def generate_answer(question: str, graph_context: str) -> str:
    prompt = f"Question: {question}\n\nContext from knowledge graph:\n{graph_context}"
    return _call(ANSWER_SYSTEM, prompt)

def analyze_document(document_text: str, question: str) -> DecompositionOutput:
    prompt = f"Document:\n{document_text[:6000]}\n\nQuestion about this document: {question}"
    raw = _call(DOCUMENT_SYSTEM, prompt)
    data = json.loads(raw)
    seen = set()
    unique = []
    for item in data.get("sub_questions", []):
        key = item["text"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(item)
    data["sub_questions"] = unique
    return DecompositionOutput(**data)

def challenge_edge(from_label: str, to_label: str, relationship: str) -> dict:
    system = """Evaluate if this knowledge graph connection is valid. Return JSON only:
{"verdict": "confirmed", "confidence": "sourced", "weight": 0.8, "explanation": "2 sentence explanation."}
verdict must be: confirmed | uncertain | refuted
confidence must be: sourced | inferred | uncertain
Return ONLY valid JSON. No markdown."""
    prompt = f'Is this connection valid? "{from_label}" --[{relationship}]--> "{to_label}"'
    raw = _call(system, prompt)
    return json.loads(raw)


def generate_mcqs(topic: str, nodes: list[dict]) -> list[dict]:
    """Generate multiple choice questions from graph nodes."""
    system = """You are a quiz generator. Create multiple choice questions based on the knowledge graph provided.

For each question return:
{
  "questions": [
    {
      "question": "Clear question text",
      "options": ["A. correct answer", "B. wrong", "C. wrong", "D. wrong"],
      "correct": 0,
      "explanation": "1-2 sentence explanation of why this is correct"
    }
  ]
}

Rules:
- correct is the index (0-3) of the correct option
- Make wrong options plausible but clearly incorrect
- Questions should test understanding, not memorization
- Create exactly 5 questions
Return ONLY valid JSON. No markdown."""

    node_text = "\n".join([f"- {n['label']}: {n.get('description','')}" for n in nodes if n.get('label')])
    prompt = f"Topic: {topic}\n\nKnowledge graph nodes:\n{node_text}"
    raw = _call(system, prompt)
    data = json.loads(raw)
    return data.get("questions", [])
