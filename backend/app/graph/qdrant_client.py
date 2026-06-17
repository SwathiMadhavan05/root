from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)
from fastembed import TextEmbedding
from app.core.config import settings
import uuid

client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

VECTOR_SIZE = 384

def ensure_collection():
    collections = [c.name for c in client.get_collections().collections]
    if settings.qdrant_collection not in collections:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )

def embed_text(text: str) -> list[float]:
    return list(embedder.embed([text]))[0].tolist()

def upsert_chunk(text: str, metadata: dict) -> str:
    point_id = str(uuid.uuid4())
    vector = embed_text(text)
    client.upsert(
        collection_name=settings.qdrant_collection,
        points=[PointStruct(id=point_id, vector=vector, payload={**metadata, "text": text})]
    )
    return point_id

def search(query: str, top_k: int = 5, graph_id: str = None) -> list[dict]:
    vector = embed_text(query)
    search_filter = None
    if graph_id:
        search_filter = Filter(
            must=[FieldCondition(key="graph_id", match=MatchValue(value=graph_id))]
        )
    results = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=vector,
        limit=top_k,
        query_filter=search_filter,
        with_payload=True,
    )
    return [{"text": r.payload["text"], "score": r.score, **r.payload} for r in results]
