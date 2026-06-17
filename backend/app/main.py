from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.graph.neo4j_client import create_constraints
from app.graph.qdrant_client import ensure_collection

app = FastAPI(title="ThinkMap API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    create_constraints()
    ensure_collection()

app.include_router(router)
