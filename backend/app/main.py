from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import characters, reactions, meta, ascension, talents


app = FastAPI(
    title="Genshin Smart Team Builder API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(characters.router)
app.include_router(ascension.router)
app.include_router(talents.router)
app.include_router(reactions.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "genshin-smart-team-builder"}
