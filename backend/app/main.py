from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models import Base
from .api import characters, reactions, meta


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Genshin Smart Team Builder API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(characters.router)
app.include_router(reactions.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "genshin-smart-team-builder"}
