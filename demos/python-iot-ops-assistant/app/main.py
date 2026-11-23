from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import httpx
from .agent import ask
from .tools import execute_tool

app = FastAPI(title="Synthetic IoT Operations Assistant", version="1.0.0")

class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)

@app.get("/healthz")
def health():
    return {"status": "ok", "mode": "synthetic-read-only"}

@app.get("/api/sites/{site_id}")
def site(site_id: str):
    try:
        return execute_tool("get_site_details", site_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@app.post("/api/ask")
async def chat(request: AskRequest):
    try:
        return await ask(request.question)
    except (httpx.HTTPError, KeyError) as exc:
        raise HTTPException(status_code=503, detail=f"Local Ollama unavailable or invalid response: {type(exc).__name__}") from exc
