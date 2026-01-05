"""Box drawing utilities for formatted terminal output."""

import sys
from typing import TextIO


def print_box(
    lines: list[str],
    *,
    title: str | None = None,
    style: str = "rounded",
    file: TextIO = sys.stderr,
):
    """
    Print text in a bordered box with padding.

    Args:
        lines: Lines of text to display
        title: Optional title for the box
        style: Box style - "rounded", "square", or "double"
        file: Output stream (default: stderr)
    """
    styles = {
        "rounded": ("╭", "╮", "╰", "╯", "─", "│"),
        "square": ("┌", "┐", "└", "┘", "─", "│"),
        "double": ("╔", "╗", "╚", "╝", "═", "║"),
    }
    tl, tr, bl, br, h, v = styles.get(style, styles["rounded"])

    # Calculate box width
    width = max(len(line) for line in lines) + 4
    if title:
        width = max(width, len(title) + 6)

    # Top border with optional title
    if title:
        title_segment = f" {title} "
        remaining = width - len(title_segment)
        left_border = h * (remaining // 2)
        right_border = h * (remaining - remaining // 2)
        print(f"{tl}{left_border}{title_segment}{right_border}{tr}", file=file)
    else:
        print(f"{tl}{h * width}{tr}", file=file)

    # Top padding
    print(f"{v}{' ' * width}{v}", file=file)

    # Content lines
    for line in lines:
        padding = width - len(line) - 2
        print(f"{v}  {line}{' ' * padding}{v}", file=file)

    # Bottom padding
    print(f"{v}{' ' * width}{v}", file=file)

    # Bottom border
    print(f"{bl}{h * width}{br}", file=file)
    print(file=file)


def print_error_box(message: str, details: list[str] | None = None, **kwargs):
    """Print an error message in a box."""
    lines = [message]
    if details:
        lines.append("")
        lines.extend(details)
    print_box(lines, title="ERROR", style="rounded", **kwargs)


def print_warning_box(message: str, details: list[str] | None = None, **kwargs):
    """Print a warning message in a box."""
    lines = [message]
    if details:
        lines.append("")
        lines.extend(details)
    print_box(lines, title="WARNING", style="rounded", **kwargs)
