---
name: py-standards
description: "MANDATORY for ALL Python output - files AND conversational snippets. Covers uv for package management, ruff for linting/formatting, ty for type checking, and project structure patterns. Trigger: any Python code, packages, dependencies, linting, type hints. No exceptions."
---

# Python Best Practices

## When to Use This Skill

This skill should be triggered when:

- Writing or reviewing Python code
- Setting up Python projects or dependencies
- Configuring linting, formatting, or type checking
- Discussing Python patterns and conventions
- Working with FastAPI, Click/Typer, or any Python framework

## Core Capabilities

1. **Package Management**: uv for fast, reliable dependency management
2. **Code Quality**: ruff for linting and formatting (replaces black, isort, flake8)
3. **Type Checking**: ty for type validation
4. **Project Structure**: Shared core pattern for API + CLI projects

## Package Management with uv

### Why uv

- 10-100x faster than pip
- Replaces pip, pip-tools, virtualenv, and pyenv
- Lockfile support for reproducible builds
- Built-in Python version management

### Common Commands

```bash
# Create new project
uv init my-project
cd my-project

# Add dependencies
uv add fastapi uvicorn
uv add --dev pytest ruff

# Sync dependencies (install from lockfile)
uv sync

# Run commands in venv
uv run python script.py
uv run pytest

# Pin Python version
uv python pin 3.12
```

### pyproject.toml Structure

```toml
[project]
name = "my-project"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn>=0.32.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "ruff>=0.8.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0.0",
    "ruff>=0.8.0",
]
```

## Code Quality with ruff

### Configuration

```toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",      # pycodestyle errors
    "W",      # pycodestyle warnings
    "F",      # Pyflakes
    "I",      # isort
    "B",      # flake8-bugbear
    "C4",     # flake8-comprehensions
    "UP",     # pyupgrade
    "ARG",    # flake8-unused-arguments
    "SIM",    # flake8-simplify
]
ignore = [
    "E501",   # line too long (handled by formatter)
]

[tool.ruff.lint.isort]
known-first-party = ["my_project"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

### Commands

```bash
# Check for issues
uv run ruff check .

# Fix auto-fixable issues
uv run ruff check --fix .

# Format code
uv run ruff format .
```

## Type Checking with ty

### Configuration

```toml
[tool.ty]
python-version = "3.12"
```

### Commands

```bash
# Type check
uv run ty check
```

## Project Structure

### Single Package Project

```text
my-project/
├── pyproject.toml
├── uv.lock
├── src/
│   └── my_project/
│       ├── __init__.py
│       └── main.py
└── tests/
    └── test_main.py
```

### API + CLI with Shared Core

When building projects with both a web API and CLI:

```text
your_app/
├── pyproject.toml
├── uv.lock
├── src/
│   └── your_app/
│       ├── __init__.py
│       ├── core/           # Shared business logic + DB access
│       │   ├── __init__.py
│       │   ├── models.py   # Domain models, Pydantic schemas
│       │   ├── services.py # Business logic
│       │   └── db.py       # Database access
│       ├── api/            # FastAPI endpoints import from core
│       │   ├── __init__.py
│       │   ├── main.py
│       │   └── routes/
│       └── cli/            # Click/Typer commands import from core
│           ├── __init__.py
│           └── main.py
└── tests/
```

**Why this pattern:**

- Single source of truth for business logic and validation
- No network dependency for CLI operations
- No code duplication between API and CLI
- CLI and API behave consistently
- Direct DB access means no latency penalty for CLI

### Example Core Module

```python
# src/your_app/core/services.py
from your_app.core.db import get_db
from your_app.core.models import User, CreateUserRequest

def create_user(request: CreateUserRequest) -> User:
    """Business logic shared by API and CLI."""
    db = get_db()
    user = User(name=request.name, email=request.email)
    db.add(user)
    db.commit()
    return user
```

### Example API Using Core

```python
# src/your_app/api/routes/users.py
from fastapi import APIRouter
from your_app.core.models import User, CreateUserRequest
from your_app.core.services import create_user

router = APIRouter()

@router.post("/users", response_model=User)
def create_user_endpoint(request: CreateUserRequest) -> User:
    return create_user(request)
```

### Example CLI Using Core

```python
# src/your_app/cli/main.py
import typer
from your_app.core.services import create_user
from your_app.core.models import CreateUserRequest

app = typer.Typer()

@app.command()
def add_user(name: str, email: str) -> None:
    """Create a new user."""
    request = CreateUserRequest(name=name, email=email)
    user = create_user(request)
    typer.echo(f"Created user: {user.id}")
```

## Type Hints

### Always Use Type Hints

```python
# BAD
def process(data):
    return data["value"]

# GOOD
def process(data: dict[str, Any]) -> str:
    return data["value"]
```

### Use Modern Syntax (3.10+)

```python
# BAD - old style
from typing import List, Dict, Optional, Union

def process(items: List[str]) -> Optional[Dict[str, int]]:
    pass

# GOOD - modern syntax
def process(items: list[str]) -> dict[str, int] | None:
    pass
```

### Pydantic for Data Validation

```python
from pydantic import BaseModel, EmailStr

class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str
    age: int | None = None

class User(BaseModel):
    id: int
    email: EmailStr
    name: str
    age: int | None = None
```

## Naming Conventions

- **snake_case**: variables, functions, modules
- **PascalCase**: classes
- **UPPER_SNAKE_CASE**: constants

```python
MAX_RETRIES = 3

class UserService:
    def get_user_by_id(self, user_id: int) -> User:
        pass
```

## Imports

### Order (handled by ruff)

1. Standard library
2. Third-party packages
3. Local imports

```python
import os
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from your_app.core.models import User
from your_app.core.services import create_user
```

## Error Handling

### Custom Exception Classes

```python
class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, code: str) -> None:
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppError):
    """Resource not found."""
    def __init__(self, resource: str, id: str) -> None:
        super().__init__(
            message=f"{resource} with id {id} not found",
            code="NOT_FOUND"
        )
```

### Result Pattern (Optional)

For functions that can fail predictably:

```python
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=Exception)

@dataclass
class Ok(Generic[T]):
    value: T

@dataclass
class Err(Generic[E]):
    error: E

type Result[T, E] = Ok[T] | Err[E]

def parse_config(path: str) -> Result[Config, ConfigError]:
    try:
        data = load_file(path)
        return Ok(Config.model_validate(data))
    except ValidationError as e:
        return Err(ConfigError(str(e)))
```

## CLI Applications

### Required Stack

| Purpose | Package |
|---------|---------|
| CLI framework | Typer |
| Colors/output | Rich |
| Spinners | halo |
| Progress bars | tqdm |

### Example CLI Setup

```python
import typer
from rich import print
from rich.console import Console
from halo import Halo
from tqdm import tqdm

app = typer.Typer()
console = Console()

@app.command()
def process(
    path: str = typer.Argument(..., help="Path to process"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """Process files at the given path."""
    spinner = Halo(text="Loading files...", spinner="dots")
    spinner.start()

    try:
        files = load_files(path)
        spinner.succeed(f"Loaded {len(files)} files")
    except Exception as e:
        spinner.fail(f"Failed to load files: {e}")
        raise typer.Exit(1)

    for file in tqdm(files, desc="Processing"):
        process_file(file)

    print("[green]Done![/green]")

if __name__ == "__main__":
    app()
```

### Dependencies

```bash
uv add typer rich halo tqdm
```

### LLM-Friendly Output

All CLIs must support both human and machine consumption:

```python
import json
import typer
from rich import print
from rich.console import Console
from rich.table import Table
from pydantic import BaseModel

app = typer.Typer()
console = Console()

class User(BaseModel):
    id: str
    name: str
    email: str

@app.command()
def list_users(
    json_output: bool = typer.Option(False, "--json", help="Output as JSON for programmatic consumption"),
    limit: int = typer.Option(50, "--limit", "-l", help="Maximum number of users to return"),
) -> None:
    """
    List all users.

    Returns array of user objects with id, name, and email fields.
    Use --json for structured output suitable for piping to other tools or LLMs.
    """
    users = get_users(limit)

    if json_output:
        # Machine-readable: structured, no formatting
        print(json.dumps([u.model_dump() for u in users], indent=2))
    else:
        # Human-readable: colors, tables, pleasant
        table = Table(title="Users")
        table.add_column("Name", style="cyan")
        table.add_column("Email")
        for user in users:
            table.add_row(user.name, user.email)
        console.print(table)

if __name__ == "__main__":
    app()
```

**Rules:**
1. `--json` flag on every command that outputs data
2. JSON output: structured, complete, no ANSI codes (Rich auto-strips when not TTY)
3. Default output: human-readable with Rich formatting
4. Docstrings must explain what the command returns, not just what it does

## Quick Reference

| Tool | Purpose | Command |
|------|---------|---------|
| uv | Package management | `uv add`, `uv sync`, `uv run` |
| ruff | Linting + formatting | `ruff check`, `ruff format` |
| ty | Type checking | `ty check` |

| Pattern | Preference |
|---------|------------|
| Package manager | uv (not pip, poetry, pipenv) |
| Linter/formatter | ruff (replaces black, isort, flake8) |
| Type checker | ty |
| Type hints | Modern syntax (`list[str]` not `List[str]`) |
| Data validation | Pydantic |
| API framework | FastAPI |
| CLI framework | Typer (or Click) |
| Project structure | Shared core for API + CLI |

## Notes

- Always use uv for new projects
- ruff replaces multiple tools - don't install black, isort, or flake8 separately
- Use the shared core pattern when building API + CLI to avoid duplication
- Modern type hint syntax requires Python 3.10+
- Pydantic v2 for data validation and serialization
