from contextlib import asynccontextmanager
from fastapi import FastAPI
from .database import engine
from .models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Genshin Smart Team Builder API",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "genshin-smart-team-builder"}
