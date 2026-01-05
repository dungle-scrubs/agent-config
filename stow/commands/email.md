---
description: Send emails via iCloud or Fastmail with template support and attachments
---

# Email Command

## Purpose

Send emails through configured SMTP accounts (iCloud or Fastmail) with support for:

- Template-based composition with variable substitution
- Direct message composition
- File attachments including document-generator integration
- Preview before sending

Designed for voice-friendly prompts with step-by-step confirmation.

## Usage

```bash
/email                           # Interactive guided flow
/email --to user@example.com     # Pre-fill recipient
```

## Workflow

**STEP 1 - CHECK CONFIGURATION:**

- Call `mcp__tool-proxy__execute_tool` with app="email", tool="get_senders"
- IF no senders configured, show setup instructions and exit
- Store available senders for selection

**STEP 2 - SELECT SENDER:**

Always prompt for sender, showing iCloud as default:

```
Use AskUserQuestion:
- question: "Which email account would you like to send from?"
- header: "Sender"
- options:
  - "iCloud (your@icloud.com) (Recommended)"
  - "Fastmail (your@fastmail.com)"
```

Store response as $SENDER (either "icloud" or "fastmail").

**STEP 3 - GET RECIPIENT:**

- Ask: "Who would you like to send this email to?"
- Validate email format (contains @ and domain)
- Store as $RECIPIENT

**STEP 4 - COMPOSE OR TEMPLATE:**

```
Use AskUserQuestion:
- question: "How would you like to compose this email?"
- header: "Compose"
- options:
  - "Write message" - Compose a new message
  - "Use template" - Select from saved templates
```

**IF "Use template":**

1. Call `mcp__tool-proxy__execute_tool` with app="email", tool="list_templates"
2. Show available templates with descriptions
3. Ask user to select one
4. Call `mcp__tool-proxy__execute_tool` with app="email", tool="render_template"
5. Ask for each missing variable
6. Store rendered content as $BODY and template subject as $SUBJECT

**ELSE "Write message":**

1. Ask: "What is the subject of your email?"
2. Store as $SUBJECT
3. Ask: "What would you like to say in the email?"
4. Store as $BODY

**STEP 5 - ATTACHMENTS:**

```
Use AskUserQuestion:
- question: "Would you like to attach any files?"
- header: "Attach"
- options:
  - "No attachments"
  - "Attach file" - Attach an existing file
  - "Generate document" - Create and attach PDF or DOCX
```

**IF "Attach file":**

1. Ask: "What is the path to the file?"
2. Validate file exists
3. Add to $ATTACHMENTS list
4. Ask: "Attach another file? (y/n)"

**IF "Generate document":**

1. Ask for document content
2. Call document-generator MCP app
3. Add generated file path to $ATTACHMENTS

**STEP 6 - PREVIEW:**

Call `mcp__tool-proxy__execute_tool` with app="email", tool="preview_email" with collected data.

Display preview:

```
═══════════════════════════════════════════
              EMAIL PREVIEW
═══════════════════════════════════════════
To:      $RECIPIENT
From:    $SENDER_EMAIL
Subject: $SUBJECT
───────────────────────────────────────────
$BODY
───────────────────────────────────────────
Attachments: $ATTACHMENTS (or "None")
═══════════════════════════════════════════
```

**STEP 7 - CONFIRM:**

```
Use AskUserQuestion:
- question: "Send this email?"
- header: "Confirm"
- options:
  - "Send" - Send the email now
  - "Edit" - Go back and make changes
  - "Cancel" - Discard and cancel
```

**IF "Send":**

Call `mcp__tool-proxy__execute_tool` with app="email", tool="send_email":

```json
{
  "to": "$RECIPIENT",
  "subject": "$SUBJECT",
  "body": "$BODY",
  "sender": "$SENDER",
  "attachments": $ATTACHMENTS,
  "html": false
}
```

Report success or error.

**IF "Edit":** Return to appropriate step.

**IF "Cancel":** Report "Email cancelled."

## Setup Instructions

If email accounts are not configured, display:

```
═══════════════════════════════════════════
       EMAIL SETUP REQUIRED
═══════════════════════════════════════════

Add credentials to ~/.env/services:

# iCloud (generate app password at appleid.apple.com)
ICLOUD_EMAIL=your@icloud.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Fastmail (Settings > Password & Security > App Passwords)
FASTMAIL_EMAIL=your@fastmail.com
FASTMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx

After adding credentials, run:
cd ~/dev/ai/services/tool-proxy && pnpm index
═══════════════════════════════════════════
```

## Examples

### Example 1: Quick Email

**User**: "/email"

**Flow**:

1. Prompt sender selection (iCloud default)
2. Ask for recipient
3. User chooses "Write message"
4. Ask for subject and body
5. User skips attachments
6. Show preview
7. User confirms "Send"
8. Report: "Email sent to recipient@example.com"

### Example 2: Template with Attachment

**User**: "/email"

**Flow**:

1. Select sender
2. Enter recipient
3. Choose "Use template"
4. Select "invoice" template
5. Fill in variables: client_name, invoice_number, amount, due_date
6. Choose "Generate document" for attachment
7. Create PDF invoice
8. Preview and confirm
9. Send with PDF attached
