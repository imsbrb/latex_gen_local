import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

PROVIDER = os.getenv("LLM_PROVIDER", "groq")  # "groq" | "local"

_CONFIGS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "generation_model": "openai/gpt-oss-120b",
        "extraction_model": "openai/gpt-oss-20b",
    },
    "local": {
        # Ollama exposes an OpenAI-compatible /v1 endpoint. To switch from a
        # laptop-local Ollama to the GPU server, no code change is needed -
        # just point LOCAL_LLM_BASE_URL at it, e.g.:
        #   LOCAL_LLM_BASE_URL=http://<gpu-server-ip>:11434/v1
        #   LOCAL_EXTRACT_MODEL=qwen2.5:14b-instruct
        #   LOCAL_GEN_MODEL=qwen2.5:14b-instruct
        # (whatever tag you `ollama pull`ed there) in the backend's .env file.
        "base_url": os.getenv("LOCAL_LLM_BASE_URL", "http://localhost:11434/v1"),
        "api_key_env": None,
        "generation_model": os.getenv("LOCAL_GEN_MODEL", "qwen2.5:14b-instruct"),
        "extraction_model": os.getenv("LOCAL_EXTRACT_MODEL", "qwen2.5:14b-instruct"),
    },
}

# Context window sent to Ollama via extra_body={"options": {"num_ctx": ...}}.
# 14B+ models handle this comfortably; drop it back down (e.g. 8192) via
# LOCAL_NUM_CTX in .env if you end up running something smaller.
LOCAL_NUM_CTX = int(os.getenv("LOCAL_NUM_CTX", "16384"))


def get_client() -> OpenAI:
    cfg = _CONFIGS[PROVIDER]
    api_key = os.getenv(cfg["api_key_env"]) if cfg["api_key_env"] else "not-needed"
    if cfg["api_key_env"] and not api_key:
        raise RuntimeError(f"{cfg['api_key_env']} is not set.")
    return OpenAI(base_url=cfg["base_url"], api_key=api_key)

def generation_model() -> str:
    return _CONFIGS[PROVIDER]["generation_model"]

def extraction_model() -> str:
    return _CONFIGS[PROVIDER]["extraction_model"]