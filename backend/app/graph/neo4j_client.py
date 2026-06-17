from neo4j import GraphDatabase
from app.core.config import settings
from typing import Optional
import uuid

driver = GraphDatabase.driver(
    settings.neo4j_uri,
    auth=(settings.neo4j_user, settings.neo4j_password)
)

def get_session():
    return driver.session()

# ── Schema setup ──────────────────────────────────────────────

def create_constraints():
    """Run once on startup to set up indexes."""
    with get_session() as session:
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (n:Node) REQUIRE n.id IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (g:Graph) REQUIRE g.id IS UNIQUE")

# ── Graph CRUD ────────────────────────────────────────────────

def create_graph(question: str) -> str:
    """Create a root graph record for a user query. Returns graph_id."""
    graph_id = str(uuid.uuid4())
    with get_session() as session:
        session.run(
            """
            CREATE (g:Graph {id: $id, question: $question, created_at: datetime()})
            """,
            id=graph_id, question=question
        )
    return graph_id

def create_node(
    graph_id: str,
    label: str,
    node_type: str,          # "concept" | "entity" | "question" | "answer"
    confidence: str = "inferred",  # "sourced" | "inferred" | "uncertain"
    summary: Optional[str] = None,
) -> str:
    """Add a node to a graph. Returns node_id."""
    node_id = str(uuid.uuid4())
    with get_session() as session:
        session.run(
            """
            MATCH (g:Graph {id: $graph_id})
            CREATE (n:Node {
                id: $node_id,
                label: $label,
                node_type: $node_type,
                confidence: $confidence,
                summary: $summary,
                created_at: datetime()
            })
            CREATE (g)-[:CONTAINS]->(n)
            """,
            graph_id=graph_id,
            node_id=node_id,
            label=label,
            node_type=node_type,
            confidence=confidence,
            summary=summary,
        )
    return node_id

def create_edge(
    from_node_id: str,
    to_node_id: str,
    relationship: str,       # e.g. "caused_by", "supports", "contradicts"
    confidence: str = "inferred",
    weight: float = 0.7,
) -> str:
    """Add a directed edge between two nodes. Returns edge_id."""
    edge_id = str(uuid.uuid4())
    with get_session() as session:
        session.run(
            """
            MATCH (a:Node {id: $from_id})
            MATCH (b:Node {id: $to_id})
            CREATE (a)-[r:RELATES_TO {
                id: $edge_id,
                relationship: $relationship,
                confidence: $confidence,
                weight: $weight
            }]->(b)
            """,
            from_id=from_node_id,
            to_id=to_node_id,
            edge_id=edge_id,
            relationship=relationship,
            confidence=confidence,
            weight=weight,
        )
    return edge_id

def get_graph(graph_id: str) -> dict:
    """Return all nodes and edges for a graph_id."""
    with get_session() as session:
        nodes_result = session.run(
            """
            MATCH (g:Graph {id: $graph_id})-[:CONTAINS]->(n:Node)
            RETURN n
            """,
            graph_id=graph_id,
        )
        nodes = [dict(record["n"]) for record in nodes_result]

        edges_result = session.run(
            """
            MATCH (g:Graph {id: $graph_id})-[:CONTAINS]->(a:Node)
            MATCH (a)-[r:RELATES_TO]->(b:Node)
            RETURN r, a.id AS from_id, b.id AS to_id
            """,
            graph_id=graph_id,
        )
        edges = [
            {**dict(record["r"]), "from": record["from_id"], "to": record["to_id"]}
            for record in edges_result
        ]

    return {"graph_id": graph_id, "nodes": nodes, "edges": edges}

def update_node_confidence(node_id: str, confidence: str):
    with get_session() as session:
        session.run(
            "MATCH (n:Node {id: $id}) SET n.confidence = $confidence",
            id=node_id, confidence=confidence
        )

def update_node_description(node_id: str, description: str):
    with get_session() as session:
        session.run(
            "MATCH (n:Node {id: $id}) SET n.summary = $description",
            id=node_id, description=description
        )

def update_edge_confidence(edge_id: str, confidence: str, weight: float):
    with get_session() as session:
        session.run(
            """
            MATCH ()-[r:RELATES_TO {id: $id}]->()
            SET r.confidence = $confidence, r.weight = $weight
            """,
            id=edge_id, confidence=confidence, weight=weight
        )

def get_global_stats() -> dict:
    with get_session() as session:
        node_res = session.run("MATCH (n:Node) RETURN count(n) AS c")
        total_nodes = node_res.single()["c"]
        
        edge_res = session.run("MATCH ()-[r:RELATES_TO]->() RETURN count(r) AS c")
        total_edges = edge_res.single()["c"]
        
        top_res = session.run(
            """
            MATCH (n:Node)-[r:RELATES_TO]-()
            RETURN n.label AS label, count(r) AS degree
            ORDER BY degree DESC
            LIMIT 5
            """
        )
        top_entities = [{"label": rec["label"], "degree": rec["degree"]} for rec in top_res]
        
    return {
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "top_entities": top_entities
    }

def get_global_graph(limit: int = 150) -> dict:
    with get_session() as session:
        nodes_result = session.run(
            """
            MATCH (n:Node)
            WITH n, rand() AS r
            ORDER BY r
            LIMIT $limit
            RETURN n
            """,
            limit=limit
        )
        nodes = [dict(record["n"]) for record in nodes_result]
        node_ids = [n["id"] for n in nodes]
        
        if not node_ids:
            return {"nodes": [], "edges": []}
            
        edges_result = session.run(
            """
            MATCH (a:Node)-[r:RELATES_TO]->(b:Node)
            WHERE a.id IN $node_ids AND b.id IN $node_ids
            RETURN r, a.id AS from_id, b.id AS to_id
            """,
            node_ids=node_ids
        )
        edges = [
            {**dict(record["r"]), "from": record["from_id"], "to": record["to_id"]}
            for record in edges_result
        ]
        
    return {"nodes": nodes, "edges": edges}

