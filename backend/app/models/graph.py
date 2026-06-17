from pydantic import BaseModel
from typing import Optional, Literal

class QueryRequest(BaseModel):
    question: str

class GraphResponse(BaseModel):
    graph_id: str
    nodes: list[dict]
    edges: list[dict]

class NodeCreate(BaseModel):
    graph_id: str
    label: str
    node_type: Literal["concept", "entity", "question", "answer"]
    confidence: Literal["sourced", "inferred", "uncertain"] = "inferred"
    summary: Optional[str] = None
    description: Optional[str] = None

class EdgeCreate(BaseModel):
    graph_id: str
    from_node_id: str
    to_node_id: str
    relationship: str
    confidence: Literal["sourced", "inferred", "uncertain"] = "inferred"
    weight: float = 0.7

class ChallengeRequest(BaseModel):
    edge_id: str
    graph_id: str
    from_label: Optional[str] = ""
    to_label: Optional[str] = ""
    relationship: Optional[str] = ""

class ExpandRequest(BaseModel):
    node_id: str
    graph_id: str
    label: Optional[str] = ""
    context: Optional[str] = ""

class DocumentRequest(BaseModel):
    question: str
    document_text: str

class SubQuestion(BaseModel):
    text: str
    node_type: Literal["question", "concept", "entity"]
    description: Optional[str] = None

class Relationship(BaseModel):
    from_label: str
    to_label: str
    relationship: str
    confidence: Literal["sourced", "inferred", "uncertain"]

class DecompositionOutput(BaseModel):
    sub_questions: list[SubQuestion]
    relationships: list[Relationship]
    answer_summary: str
