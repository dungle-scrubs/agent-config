# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by opening a GitHub issue.

For sensitive issues (e.g., exposed credentials), please contact the maintainer directly rather than opening a public issue.

## Security Considerations

This repository contains configuration files that may reference:
- API key locations (not the keys themselves)
- Service endpoints
- Tool configurations

**Never commit:**
- Actual API keys or tokens
- auth.json files
- .env files with real values
- Session data
