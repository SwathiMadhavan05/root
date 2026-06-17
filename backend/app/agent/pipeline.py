from app.agent.llm import decompose_query, expand_node, generate_answer, analyze_document
from app.graph.neo4j_client import (
    create_graph, create_node, create_edge,
    get_graph, update_edge_confidence, update_node_description
)
from typing import AsyncGenerator
import json

def normalize_label(l: str) -> str:
    return " ".join(l.lower().strip().split())


async def build_graph_streaming(question: str) -> AsyncGenerator[str, None]:
    graph_id = create_graph(question)
    yield json.dumps({"event": "graph_created", "graph_id": graph_id})
    yield json.dumps({"event": "thinking", "message": "Decomposing your question..."})

    decomposition = decompose_query(question)
    node_map: dict[str, str] = {}

    for item in decomposition.sub_questions:
        node_id = create_node(
            graph_id=graph_id,
            label=item.text,
            node_type=item.node_type,
            confidence="inferred",
            summary=item.description,
        )
        node_map[normalize_label(item.text)] = node_id
        yield json.dumps({
            "event": "node_added",
            "node": {
                "id": node_id,
                "label": item.text,
                "node_type": item.node_type,
                "confidence": "inferred",
                "description": item.description or "",
            }
        })

    for rel in decomposition.relationships:
        from_id = node_map.get(normalize_label(rel.from_label))
        to_id = node_map.get(normalize_label(rel.to_label))
        if not from_id or not to_id:
            continue
        edge_id = create_edge(from_id, to_id, rel.relationship, rel.confidence)
        yield json.dumps({
            "event": "edge_added",
            "edge": {
                "id": edge_id,
                "from": from_id,
                "to": to_id,
                "relationship": rel.relationship,
                "confidence": rel.confidence,
            }
        })

    yield json.dumps({"event": "thinking", "message": "Synthesizing answer..."})
    graph_context = "\n".join([
        f"- {item.text}: {item.description or ''}" for item in decomposition.sub_questions
    ])
    answer = generate_answer(question, graph_context)

    answer_node_id = create_node(
        graph_id=graph_id, label="Answer", node_type="answer",
        confidence="sourced", summary=answer,
    )

    yield json.dumps({
        "event": "answer_ready",
        "graph_id": graph_id,
        "answer": answer,
        "answer_node_id": answer_node_id,
    })


async def build_graph_from_document(question: str, document_text: str) -> AsyncGenerator[str, None]:
    graph_id = create_graph(question)
    yield json.dumps({"event": "graph_created", "graph_id": graph_id})
    yield json.dumps({"event": "thinking", "message": "Analyzing document..."})

    decomposition = analyze_document(document_text, question)
    node_map: dict[str, str] = {}

    for item in decomposition.sub_questions:
        node_id = create_node(
            graph_id=graph_id, label=item.text, node_type=item.node_type,
            confidence="sourced", summary=item.description,
        )
        node_map[normalize_label(item.text)] = node_id
        yield json.dumps({
            "event": "node_added",
            "node": {
                "id": node_id, "label": item.text, "node_type": item.node_type,
                "confidence": "sourced", "description": item.description or "",
            }
        })

    for rel in decomposition.relationships:
        from_id = node_map.get(normalize_label(rel.from_label))
        to_id = node_map.get(normalize_label(rel.to_label))
        if not from_id or not to_id:
            continue
        edge_id = create_edge(from_id, to_id, rel.relationship, rel.confidence)
        yield json.dumps({
            "event": "edge_added",
            "edge": {"id": edge_id, "from": from_id, "to": to_id,
                     "relationship": rel.relationship, "confidence": rel.confidence}
        })

    yield json.dumps({"event": "thinking", "message": "Generating insights..."})
    answer = decomposition.answer_summary

    answer_node_id = create_node(
        graph_id=graph_id, label="Key Insights", node_type="answer",
        confidence="sourced", summary=answer,
    )

    yield json.dumps({
        "event": "answer_ready", "graph_id": graph_id,
        "answer": answer, "answer_node_id": answer_node_id,
    })


async def handle_challenge(edge_id: str, from_label: str, to_label: str, relationship: str) -> dict:
    result = challenge_edge(from_label, to_label, relationship)
    confidence_map = {"confirmed": "sourced", "uncertain": "uncertain", "refuted": "uncertain"}
    new_confidence = confidence_map.get(result["verdict"], "uncertain")
    update_edge_confidence(edge_id, new_confidence, result.get("weight", 0.5))
    return {**result, "edge_id": edge_id, "new_confidence": new_confidence}


async def handle_expand(node_id: str, label: str, graph_id: str, context: str = "") -> dict:
    expansion = expand_node(label, context)
    node_map: dict[str, str] = {normalize_label(label): node_id}
    new_nodes = []
    new_edges = []
    node_description = expansion.get("node_description", "")

    if graph_id and node_description:
        update_node_description(node_id, node_description)

    for sub in expansion.get("sub_nodes", []):
        nid = create_node(
            graph_id=graph_id, label=sub["text"],
            node_type=sub.get("node_type", "concept"),
            confidence="inferred", summary=sub.get("description", ""),
        )
        node_map[normalize_label(sub["text"])] = nid
        new_nodes.append({
            "id": nid, "label": sub["text"],
            "node_type": sub.get("node_type", "concept"),
            "description": sub.get("description", ""),
        })

    for rel in expansion.get("relationships", []):
        from_id = node_map.get(normalize_label(rel["from_label"]))
        to_id = node_map.get(normalize_label(rel["to_label"]))
        if not from_id or not to_id:
            continue
        eid = create_edge(from_id, to_id, rel["relationship"], rel.get("confidence", "inferred"))
        new_edges.append({"id": eid, "from": from_id, "to": to_id, "relationship": rel["relationship"]})

    return {"new_nodes": new_nodes, "new_edges": new_edges, "node_description": node_description}
