---
name: python
description: Python standards - pydantic-settings for env validation, BaseSettings with type hints, fail fast on startup. Triggers: Python, environment variables, settings validation.
---

# Python Best Practices

## When to Use This Skill

- Writing or reviewing Python code
- Setting up environment variable validation
- Configuring pydantic-settings

## Environment Validation

Use `pydantic-settings` for environment variable validation:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    api_key: str
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()  # Fails fast on missing/invalid vars
```

## Core Principles

- Define settings as a class extending `BaseSettings` with type hints
- Fail fast on missing/invalid env vars at startup
- Use `.env` files for local development
