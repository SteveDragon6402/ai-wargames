#!/usr/bin/env python3
"""
Local Orpheus French TTS Server (Apple Silicon MLX + SNAC 24kHz)
Serves OpenAI-compatible POST /v1/audio/speech on http://127.0.0.1:5005
Voices: pierre (male French), amelie (warm female French), marie (spirited female French)
Paralinguistic tags: <laugh>, <chuckle>, <sigh>, <gasp>
"""

import io
import os
import threading
from typing import Optional

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

CANDIDATE_MODELS = [
    os.environ.get("ORPHEUS_MLX_MODEL", "").strip(),
    "mlx-community/3b-fr-ft-research_release-4bit",
    "mlx-community/3b-fr-ft-research_release-8bit",
    "mlx-community/3b-fr-ft-research_release-bf16",
]
CANDIDATE_MODELS = [m for m in CANDIDATE_MODELS if m]

app = FastAPI(title="Orpheus French TTS (MLX)")

_model = None
_loaded_model_id: Optional[str] = None
_load_error: Optional[str] = None
_lock = threading.Lock()


def get_or_load_model():
    global _model, _loaded_model_id, _load_error
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        from mlx_audio.tts.utils import load_model

        last_err = None
        for repo_id in CANDIDATE_MODELS:
            try:
                print(f"[orpheus-server] Loading French Orpheus MLX model: {repo_id} ...", flush=True)
                _model = load_model(repo_id)
                _loaded_model_id = repo_id
                _load_error = None
                print(f"[orpheus-server] Ready: {repo_id}", flush=True)
                return _model
            except Exception as exc:
                last_err = str(exc)
                print(f"[orpheus-server] Could not load {repo_id}: {exc}", flush=True)
        _load_error = last_err or "Failed to load any Orpheus MLX model"
        raise RuntimeError(_load_error)


class SpeechRequest(BaseModel):
    model: Optional[str] = "canopylabs/3b-fr-ft-research_release"
    input: str
    voice: Optional[str] = "amelie"
    prompt: Optional[str] = None
    response_format: Optional[str] = "wav"
    temperature: Optional[float] = 0.6
    top_p: Optional[float] = 0.8


@app.on_event("startup")
def preload_in_background():
    threading.Thread(target=_safe_preload, daemon=True).start()


def _safe_preload():
    try:
        get_or_load_model()
    except Exception as exc:
        print(f"[orpheus-server] Preload warning: {exc}", flush=True)


@app.get("/health")
def health():
    return {
        "status": "ready" if _model is not None else "loading",
        "model": _loaded_model_id,
        "error": _load_error,
    }


@app.post("/v1/audio/speech")
def synthesize(req: SpeechRequest):
    text = (req.input or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Input text is empty.")

    voice = (req.voice or "amelie").strip().lower()
    if voice not in {"pierre", "amelie", "marie"}:
        voice = "amelie"

    try:
        model = get_or_load_model()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Orpheus model unavailable: {exc}")

    with _lock:
        chunks = []
        sample_rate = getattr(model, "sample_rate", 24000)
        for res in model.generate(
            text=text,
            voice=voice,
            temperature=req.temperature or 0.6,
            top_p=req.top_p or 0.8,
            max_tokens=900,
            verbose=False,
        ):
            audio_arr = np.asarray(res.audio, dtype=np.float32)
            if audio_arr.size > 0:
                chunks.append(audio_arr)
            sample_rate = getattr(res, "sample_rate", sample_rate)

    if not chunks:
        raise HTTPException(status_code=500, detail="Orpheus produced no audio frames.")

    waveform = np.concatenate(chunks, axis=0)
    buf = io.BytesIO()
    sf.write(buf, waveform, sample_rate, format="WAV", subtype="PCM_16")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    port = int(os.environ.get("ORPHEUS_PORT", "5005"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
