from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.agent.pipeline import build_graph_streaming, build_graph_from_document, handle_challenge, handle_expand
from app.graph.neo4j_client import get_graph, get_global_stats, get_global_graph
from app.models.graph import ChallengeRequest, ExpandRequest, DocumentRequest

router = APIRouter(prefix="/api")


@router.websocket("/ws/query")
async def query_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        question = data.get("question", "").strip()
        if not question:
            await websocket.send_json({"event": "error", "message": "Question cannot be empty."})
            return
        async for event in build_graph_streaming(question):
            await websocket.send_text(event)
        await websocket.send_json({"event": "done"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"event": "error", "message": str(e)})


@router.websocket("/ws/document")
async def document_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        question = data.get("question", "").strip()
        document_text = data.get("document_text", "").strip()
        if not document_text:
            await websocket.send_json({"event": "error", "message": "No document content provided."})
            return
        async for event in build_graph_from_document(question or "Summarize the key concepts", document_text):
            await websocket.send_text(event)
        await websocket.send_json({"event": "done"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"event": "error", "message": str(e)})


@router.get("/graph/{graph_id}")
async def fetch_graph(graph_id: str):
    graph = get_graph(graph_id)
    if not graph["nodes"]:
        raise HTTPException(status_code=404, detail="Graph not found")
    return graph


@router.post("/challenge")
async def challenge_edge_endpoint(body: ChallengeRequest):
    result = await handle_challenge(
        edge_id=body.edge_id,
        from_label=body.from_label or "",
        to_label=body.to_label or "",
        relationship=body.relationship or "",
    )
    return result


@router.post("/expand")
async def expand_node_endpoint(body: ExpandRequest):
    result = await handle_expand(
        node_id=body.node_id,
        label=body.label or "",
        graph_id=body.graph_id,
        context=body.context or "",
    )
    return result


class MCQRequest(BaseModel):
    topic: str
    nodes: list[dict]


@router.post("/mcq")
async def generate_mcq_endpoint(body: MCQRequest):
    from app.agent.llm import generate_mcqs
    questions = generate_mcqs(body.topic, body.nodes)
    return {"questions": questions}


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/dashboard/stats")
async def dashboard_stats():
    return get_global_stats()


@router.get("/dashboard/global")
async def dashboard_global():
    return get_global_graph()


@router.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    try:
        import pypdf
        import io
        content = await file.read()
        reader = pypdf.PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")
