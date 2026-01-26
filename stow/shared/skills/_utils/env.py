"""Environment loading utilities for Claude Code skills."""

import os
import sys
from pathlib import Path

from box import print_error_box

ENV_LOCAL = Path.home() / ".env" / "local"
ENV_SERVICES = Path.home() / ".env" / "services"


def load_env_local():
    """Load environment variables from ~/.env/local."""
    if ENV_LOCAL.exists():
        with open(ENV_LOCAL) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip().replace("~", str(Path.home()))
                    if key not in os.environ:
                        os.environ[key] = value


def load_env_file(path: str | Path) -> dict[str, str]:
    """Load environment variables from a file, returning as dict."""
    path = Path(path).expanduser()
    env_vars = {}
    if path.exists():
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip().strip("'\"")
                    env_vars[key] = value
    return env_vars


def require_env(
    var_name: str,
    skill_name: str,
    env_file: str = "~/.env/services",
    example: str | None = None,
    exit_on_missing: bool = True,
) -> str:
    """
    Check for required env var and exit if missing.

    Args:
        var_name: Environment variable name
        skill_name: Name of the skill requiring this var
        env_file: Path to env file to check
        example: Example value to show in error message
        exit_on_missing: If True (default), exit immediately when missing

    Returns:
        The environment variable value

    Raises:
        SystemExit: If variable is missing and exit_on_missing is True
    """
    value = os.environ.get(var_name)
    if value:
        return value

    # Try loading from env file
    env_path = Path(env_file).expanduser()
    if env_path.exists():
        env_vars = load_env_file(env_path)
        if env_vars.get(var_name):
            os.environ[var_name] = env_vars[var_name]
            return env_vars[var_name]

    # Not found - print error and exit
    print_error_box(
        f"Missing required environment variable: {var_name}",
        details=[
            f"The {skill_name} skill requires this variable to be set.",
            "",
            f"To fix, add to {env_file}:",
            "",
            f"  {var_name}={example or '<your-value-here>'}",
        ],
    )
    if exit_on_missing:
        sys.exit(1)
    return ""
