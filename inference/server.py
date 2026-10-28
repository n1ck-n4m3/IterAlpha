"""Optional authenticated frozen-model readout service for an NVIDIA GPU host."""
import asyncio
from contextlib import asynccontextmanager
import hmac
import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

MODEL = "Qwen/Qwen3.5-4B"
REVISION = "851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a"
MAX_BODY = 32768
runtime = {}
lock = asyncio.Lock()


class Option(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=32, pattern=r"^[a-z-]+$")
    description: str = Field(min_length=1, max_length=300)


class Row(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Literal["support", "focus"]
    question: str = Field(min_length=1, max_length=1000)
    options: list[Option] = Field(min_length=2, max_length=6)
    state: dict


class Batch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal["iteralpha-decider-v1"]
    rows: list[Row] = Field(min_length=2, max_length=2)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    key = os.environ.get("DECISION_API_KEY", "")
    if len(key) < 24:
        raise RuntimeError("DECISION_API_KEY must contain at least 24 characters.")
    import torch
    from transformers import AutoConfig, AutoTokenizer, BitsAndBytesConfig, Qwen3_5ForCausalLM
    if not torch.cuda.is_available():
        raise RuntimeError("A CUDA-enabled NVIDIA GPU is required for this profile.")
    torch.set_num_threads(2)
    config = AutoConfig.from_pretrained(MODEL, revision=REVISION, trust_remote_code=False)
    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, trust_remote_code=False)
    model, loading = Qwen3_5ForCausalLM.from_pretrained(
        MODEL, revision=REVISION, config=config.get_text_config(), trust_remote_code=False,
        quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16),
        device_map={"": 0}, dtype=torch.bfloat16, output_loading_info=True,
    )
    if any(loading.get(key) for key in ("missing_keys", "mismatched_keys", "error_msgs")):
        raise RuntimeError("The pinned model checkpoint did not load completely.")
    model.eval()
    runtime.update(model=model, tokenizer=tokenizer, key=key)
    yield
    runtime.clear()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def authenticate_and_bound(request: Request, call_next):
    expected = runtime.get("key", "")
    supplied = request.headers.get("authorization", "").removeprefix("Bearer ")
    if not expected or not hmac.compare_digest(supplied, expected):
        from starlette.responses import JSONResponse
        return JSONResponse({"error": "Unauthorized."}, status_code=401)
    size = 0
    body = bytearray()
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BODY:
            from starlette.responses import JSONResponse
            return JSONResponse({"error": "Request is too large."}, status_code=413)
        body.extend(chunk)
    # Starlette replays this bounded cache to the route body parser.
    request._body = bytes(body)
    return await call_next(request)


def score_batch(batch: Batch):
    from semif_phase1.direct import score
    results = []
    for row in batch.rows:
        result = score(runtime["model"], runtime["tokenizer"], row.model_dump(), {"model_source": MODEL, "model_revision": REVISION}, max_tokens=1536)
        results.append({"id": row.id, "option_ids": result["option_ids"], "scores": result["probabilities"], "prompt_sha256": result["prompt_sha256"]})
    return {"version": "iteralpha-decider-v1", "model": MODEL, "revision": REVISION, "quantization": "nf4", "results": results}


@app.post("/v1/decide")
async def decide(batch: Batch):
    if {row.id for row in batch.rows} != {"support", "focus"}:
        raise HTTPException(422, "Both decision questions are required.")
    if lock.locked():
        raise HTTPException(503, "The model is busy. Retry later.")
    async with lock:
        try:
            return await asyncio.to_thread(score_batch, batch)
        except (ValueError, RuntimeError):
            # Avoid reflecting prompts, credentials, or provider stack traces.
            raise HTTPException(503, "The model could not score this bounded request.") from None
