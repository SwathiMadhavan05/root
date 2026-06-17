from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "thinkmap123"

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "thinkmap_chunks"

    groq_api_key: str = ""
    llm_model: str = "llama-3.1-8b-instant"

    embedding_model: str = "all-MiniLM-L6-v2"

    class Config:
        env_file = ".env"

settings = Settings()
