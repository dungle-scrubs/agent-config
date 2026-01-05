---
description: Fetch recent AI coding assistant news with focus on Claude Code, Codex, and Gemini CLI
---

# AI News Command

## Purpose

Aggregates recent updates (last 2 weeks) for AI coding assistants and major AI news. Primary focus is Claude Code feature changes, with secondary coverage of OpenAI Codex and Gemini CLI updates, plus notable Anthropic and general AI industry news.

## Usage Pattern

```text
/ai-news
```

## Process Flow

### Step 1: Claude Code Updates (Primary Focus)

Search for Claude Code changes from the last 2 weeks.

**Search Queries:**
- "Claude Code" changelog OR updates OR features site:anthropic.com
- "Claude Code" new features 2025
- anthropic/claude-code releases github

**IMPORTANT:** Include even small changes like:
- Default tool interface modifications
- New slash commands or hooks
- MCP server updates
- Settings or configuration changes
- Bug fixes and performance improvements

### Step 2: Anthropic Company News

Search for notable Anthropic announcements.

**Search Queries:**
- Anthropic announcements December 2025
- Anthropic blog posts recent
- Claude model updates

**Focus Areas:**
- New model releases or updates
- API changes
- Safety research publications
- Partnerships or product launches

### Step 3: OpenAI Codex Updates

Search for OpenAI Codex and coding-related updates.

**Search Queries:**
- OpenAI Codex updates December 2025
- OpenAI coding assistant news
- ChatGPT code interpreter updates

### Step 4: Gemini CLI Updates

Search for Google Gemini CLI developments.

**Search Queries:**
- Gemini CLI updates December 2025
- Google AI coding tools news
- Gemini API developer updates

### Step 5: General AI Industry News

Briefly cover major AI industry developments.

**Search Queries:**
- AI news December 2025
- LLM developments recent

**Filter For:**
- Only significant announcements (funding, major releases, breakthroughs)
- Skip minor updates from companies not in focus

## Expected Output

### Report Format

```markdown
# AI Coding Assistant News (Past 2 Weeks)

## Claude Code Updates
[List each update with date and brief description]
- **[Date]**: [Feature/Change description]

## Anthropic News
[Notable company announcements]

## OpenAI Codex
[Recent updates and features]

## Gemini CLI
[Recent updates and features]

## Industry Highlights
[Major AI news items - brief bullets only]

---
*Report generated: [Current Date]*
*Sources: [List key sources used]*
```

## Success Criteria

- Claude Code section has the most detail
- All updates from last 2 weeks are captured
- Each item includes approximate date
- Sources are cited for verification
- Report is concise but comprehensive

## Notes

Run this command weekly to stay current on AI coding tool developments. The focus on Claude Code reflects the primary use case, while competitor coverage provides useful context for feature comparisons.
