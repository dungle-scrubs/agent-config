#!/usr/bin/env python3
"""
Shared Vision API utilities for Claude Code skills.
Provides OpenRouter API access with LMArena model selection.
"""

import base64
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
LMARENA_VISION_URL = "https://lmarena.ai/leaderboard/vision"
ENV_FILE = Path.home() / ".env" / "models"
CACHE_DIR = Path.home() / ".cache" / "vision-api"
LMARENA_CACHE = CACHE_DIR / "lmarena-vision-top.json"
OPENROUTER_CACHE = CACHE_DIR / "openrouter-vision-models.json"
CACHE_TTL = 86400  # 24 hours

# Model name to OpenRouter ID mapping
MODEL_MAPPINGS = {
    # Google
    "gemini-3-pro": "google/gemini-3-pro-preview",
    "gemini-3-pro-preview": "google/gemini-3-pro-preview",
    "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
    "gemini-2.5-flash": "google/gemini-2.5-flash-preview",
    "gemini-2.0-flash": "google/gemini-2.0-flash-exp",
    "gemini-1.5-pro": "google/gemini-pro-1.5",
    "gemini-pro-vision": "google/gemini-pro-vision",
    # OpenAI
    "gpt-5.2": "openai/gpt-5.2",
    "gpt-5.1": "openai/gpt-5.1",
    "gpt-5.1-high": "openai/gpt-5.1-high",
    "gpt-5": "openai/gpt-5",
    "gpt-4.5": "openai/gpt-4.5-preview",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4-vision": "openai/gpt-4-vision-preview",
    "gpt-4-turbo": "openai/gpt-4-turbo",
    # Anthropic
    "claude-opus-4.5": "anthropic/claude-opus-4.5",
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "claude-3-opus": "anthropic/claude-3-opus",
    "claude-3-sonnet": "anthropic/claude-3-sonnet",
    # xAI
    "grok-4": "x-ai/grok-4",
    "grok-4.1": "x-ai/grok-4.1",
    "grok-3": "x-ai/grok-3",
    "grok-2-vision": "x-ai/grok-2-vision",
    # Meta
    "llama-4-maverick": "meta-llama/llama-4-maverick",
    "llama-4-scout": "meta-llama/llama-4-scout",
    "llama-3.2-90b-vision": "meta-llama/llama-3.2-90b-vision-instruct",
    "llama-3.2-11b-vision": "meta-llama/llama-3.2-11b-vision-instruct",
    # Qwen
    "qwen2.5-vl-72b": "qwen/qwen2.5-vl-72b-instruct",
    "qwen2.5-vl-32b": "qwen/qwen2.5-vl-32b-instruct",
}


def load_api_key() -> str:
    """Load OpenRouter API key from ~/.env/models or environment."""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                return line.split("=", 1)[1].strip()
    env_key = os.environ.get("OPENROUTER_API_KEY")
    if env_key:
        return env_key
    raise ValueError("No OPENROUTER_API_KEY found in ~/.env/models or environment")


def encode_image(image_path: str) -> tuple[str, str]:
    """Encode image to base64 and detect media type."""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    suffix = path.suffix.lower()
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_types.get(suffix, "image/png")

    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")

    return data, media_type


def scrape_lmarena_vision_top() -> str | None:
    """Scrape LMArena Vision leaderboard for the #1 ranked model."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml",
    }
    req = Request(LMARENA_VISION_URL, headers=headers, method="GET")

    try:
        with urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8")

        # Try to parse JSON rating data embedded in the page
        # Look for patterns like: "model":"gemini-3-pro","rating":1309.49
        rating_pattern = r'"(?:model|name)"\s*:\s*"([^"]+)"[^}]*"rating"\s*:\s*([\d.]+)'
        matches = re.findall(rating_pattern, html)
        if matches:
            # Sort by rating descending and return the highest
            models_with_ratings = [(name, float(rating)) for name, rating in matches]
            models_with_ratings.sort(key=lambda x: x[1], reverse=True)
            top_model = models_with_ratings[0][0]
            return top_model

        # Fallback to known model list (prioritize Google models as they currently lead)
        known_models = [
            "gemini-3",
            "gemini-2.5",
            "gemini-2",
            "gpt-5",
            "gpt-4o",
            "gpt-4.5",
            "claude-opus",
            "claude-3.5-sonnet",
            "claude-3-opus",
            "grok-4",
            "grok-3",
            "llama-4",
            "llama-3.2",
        ]

        for model in known_models:
            pattern = rf"\b({re.escape(model)}[A-Za-z0-9\-\._]*)\b"
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    except (HTTPError, URLError, TimeoutError) as e:
        print(f"Warning: Failed to scrape LMArena: {e}", file=sys.stderr)
        return None


def get_lmarena_top_vision_model(config_file: Path | None = None) -> str | None:
    """Get the #1 ranked vision model from LMArena with caching."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    if LMARENA_CACHE.exists():
        try:
            cache = json.loads(LMARENA_CACHE.read_text())
            if time.time() - cache.get("timestamp", 0) < CACHE_TTL:
                return cache.get("model")
        except (json.JSONDecodeError, KeyError):
            pass

    # Check manual override config if provided
    if config_file and config_file.exists():
        try:
            config = json.loads(config_file.read_text())
            if config.get("vision_model_override"):
                return config["vision_model_override"]
        except (json.JSONDecodeError, KeyError):
            pass

    model = scrape_lmarena_vision_top()
    if model:
        LMARENA_CACHE.write_text(
            json.dumps(
                {
                    "timestamp": time.time(),
                    "model": model,
                    "source": "lmarena_scrape",
                }
            )
        )

    return model


def map_to_openrouter_id(lmarena_name: str) -> str | None:
    """Map LMArena model name to OpenRouter model ID."""
    if not lmarena_name:
        return None

    name_lower = lmarena_name.lower().replace(" ", "-").replace("_", "-")

    if name_lower in MODEL_MAPPINGS:
        return MODEL_MAPPINGS[name_lower]

    for key, value in MODEL_MAPPINGS.items():
        if key in name_lower or name_lower in key:
            return value

    if "/" in lmarena_name:
        return lmarena_name

    return None


def fetch_openrouter_vision_models(api_key: str) -> list[dict]:
    """Fetch all vision-capable models from OpenRouter API."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    req = Request(f"{OPENROUTER_BASE}/models", headers=headers, method="GET")

    with urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    vision_models = []
    for model in data.get("data", []):
        arch = model.get("architecture", {})
        input_modalities = arch.get("input_modalities", [])
        if "image" in input_modalities:
            vision_models.append(
                {
                    "id": model.get("id"),
                    "name": model.get("name"),
                    "context_length": model.get("context_length"),
                    "pricing": model.get("pricing", {}),
                }
            )

    return vision_models


def get_openrouter_vision_models() -> list[dict]:
    """Get vision models from OpenRouter with caching."""
    api_key = load_api_key()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    if OPENROUTER_CACHE.exists():
        try:
            cache = json.loads(OPENROUTER_CACHE.read_text())
            if time.time() - cache.get("timestamp", 0) < CACHE_TTL:
                return cache.get("models", [])
        except (json.JSONDecodeError, KeyError):
            pass

    models = fetch_openrouter_vision_models(api_key)
    OPENROUTER_CACHE.write_text(
        json.dumps(
            {
                "timestamp": time.time(),
                "models": models,
            }
        )
    )

    return models


def get_best_vision_model(config_file: Path | None = None) -> str:
    """
    Get the best vision model by:
    1. Check LMArena #1 ranking
    2. Map to OpenRouter ID
    3. Verify model exists on OpenRouter
    4. Fallback to best available on OpenRouter
    """
    lmarena_top = get_lmarena_top_vision_model(config_file)
    if lmarena_top:
        openrouter_id = map_to_openrouter_id(lmarena_top)
        if openrouter_id:
            models = get_openrouter_vision_models()
            model_ids = {m["id"] for m in models}
            if openrouter_id in model_ids:
                print(f"Using LMArena #1: {lmarena_top} -> {openrouter_id}", file=sys.stderr)
                return openrouter_id

    models = get_openrouter_vision_models()
    if not models:
        raise RuntimeError("No vision-capable models found")

    def sort_key(m):
        prompt_cost = float(m["pricing"].get("prompt", "0") or "0")
        is_paid = prompt_cost > 0
        return (not is_paid, -m.get("context_length", 0))

    models_sorted = sorted(models, key=sort_key)
    fallback = models_sorted[0]["id"]
    print(f"Fallback to OpenRouter best: {fallback}", file=sys.stderr)
    return fallback


def call_vision_api(
    image_path: str,
    prompt: str,
    model: str | None = None,
    max_tokens: int = 4096,
) -> str:
    """Call vision API with a single image and prompt."""
    api_key = load_api_key()
    model = model or get_best_vision_model()

    image_data, media_type = encode_image(image_path)

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{image_data}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "max_tokens": max_tokens,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/anthropics/claude-code",
        "X-Title": "Claude Code Vision",
    }

    req = Request(
        f"{OPENROUTER_BASE}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"Vision API error ({e.code}): {error_body}")


def call_vision_api_multi(
    images: list[tuple[str, str]],  # List of (image_path, label)
    prompt: str,
    model: str | None = None,
    max_tokens: int = 4096,
) -> str:
    """Call vision API with multiple images and a prompt."""
    api_key = load_api_key()
    model = model or get_best_vision_model()

    content = []
    for image_path, label in images:
        image_data, media_type = encode_image(image_path)
        content.append({"type": "text", "text": f"[{label}]"})
        content.append(
            {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_data}"}}
        )

    content.append({"type": "text", "text": prompt})

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": max_tokens,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/anthropics/claude-code",
        "X-Title": "Claude Code Vision",
    }

    req = Request(
        f"{OPENROUTER_BASE}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"Vision API error ({e.code}): {error_body}")


def clear_cache() -> None:
    """Clear all cached data."""
    for cache_file in [LMARENA_CACHE, OPENROUTER_CACHE]:
        if cache_file.exists():
            cache_file.unlink()
            print(f"Cleared: {cache_file}")
