---
name: lua-standards
description: "MANDATORY for ALL Lua output - files AND conversational snippets. Covers local over global, LuaLS type annotations, StyLua formatting, module patterns, pcall error handling. Trigger: any Lua code, Neovim config, Hammerspoon, LÖVE2D, game scripting. No exceptions."
---

# Lua Best Practices

## When to Use This Skill

This skill should be triggered when:

- Writing or reviewing Lua code
- Configuring Neovim, Hammerspoon, or other Lua-scriptable tools
- Working with game engines (LÖVE2D, Defold, Roblox)
- Discussing Lua patterns and conventions
- Setting up Lua tooling or type checking

## Core Capabilities

1. **Scoping**: `local` everywhere, avoid globals
2. **Type Safety**: LuaLS annotations for IDE support and checking
3. **Code Quality**: StyLua for formatting, luacheck for linting
4. **Error Handling**: pcall/xpcall for recoverable errors
5. **Module Pattern**: Clean exports, no global pollution

## Tooling

### LuaLS (Lua Language Server)

Primary tool for type checking and IDE support. Understands EmmyLua-style annotations.

```bash
# Install via Homebrew
brew install lua-language-server

# Or via Mason in Neovim
:MasonInstall lua-language-server
```

### StyLua

Modern Lua formatter (like prettier for Lua):

```bash
brew install stylua
```

Configuration (`.stylua.toml`):

```toml
column_width = 100
line_endings = "Unix"
indent_type = "Spaces"
indent_width = 2
quote_style = "AutoPreferDouble"
call_parentheses = "Always"
```

### luacheck

Static analyzer and linter:

```bash
brew install luacheck
```

Configuration (`.luacheckrc`):

```lua
std = "lua51+luajit"  -- or "lua54" for Lua 5.4
globals = {
  "hs",      -- Hammerspoon
  "vim",     -- Neovim
  "love",    -- LÖVE2D
}
ignore = {
  "212",     -- Unused argument (often intentional in callbacks)
}
max_line_length = 100
```

## local Over Global

**This is the most important Lua rule.** Globals pollute the environment and are slower.

```lua
-- BAD - creates global
name = "Kevin"
function greet() end

-- GOOD - always use local
local name = "Kevin"
local function greet() end
```

### Why This Matters

1. **Performance**: Local variables are stored in registers, globals require table lookup
2. **Safety**: Globals leak between modules and can cause subtle bugs
3. **Clarity**: Explicit scope makes code easier to understand

### Detecting Globals

luacheck catches accidental globals:

```bash
luacheck --globals hs vim -- myfile.lua
```

## Type Annotations (LuaLS)

Use EmmyLua-style annotations for type safety:

### Basic Types

```lua
---@type string
local name = "Kevin"

---@type number
local count = 0

---@type boolean
local enabled = true

---@type string[]
local names = { "Alice", "Bob" }

---@type table<string, number>
local scores = { alice = 100, bob = 95 }
```

### Function Annotations

```lua
---Calculate the area of a rectangle
---@param width number The width
---@param height number The height
---@return number area The calculated area
local function calculateArea(width, height)
  return width * height
end
```

### Class-like Tables

```lua
---@class User
---@field id string
---@field name string
---@field email string
---@field age number?

---@type User
local user = {
  id = "123",
  name = "Kevin",
  email = "user@example.com",
}
```

### Union Types

```lua
---@alias LoadingState
---| "idle"
---| "loading"
---| "success"
---| "error"

---@type LoadingState
local state = "idle"
```

### Discriminated Unions (Tagged Tables)

```lua
---@class IdleState
---@field status "idle"

---@class LoadingState
---@field status "loading"

---@class SuccessState
---@field status "success"
---@field data any

---@class ErrorState
---@field status "error"
---@field error string

---@alias FetchState IdleState | LoadingState | SuccessState | ErrorState

---@param state FetchState
local function render(state)
  if state.status == "idle" then
    showPlaceholder()
  elseif state.status == "loading" then
    showSpinner()
  elseif state.status == "success" then
    showData(state.data)
  elseif state.status == "error" then
    showError(state.error)
  end
end
```

### Generic Types

```lua
---@generic T
---@param items T[]
---@return T?
local function first(items)
  return items[1]
end
```

## Module Pattern

### Standard Module Structure

```lua
-- mymodule.lua
local M = {}

---@type string
M.VERSION = "1.0.0"

---Process data
---@param input string
---@return string
function M.process(input)
  return input:upper()
end

-- Private function (not exported)
local function helper()
  -- ...
end

return M
```

### Usage

```lua
local mymodule = require("mymodule")
local result = mymodule.process("hello")
```

### Avoid Global Exports

```lua
-- BAD - pollutes global namespace
MyModule = {}
function MyModule.doThing() end

-- GOOD - return module table
local M = {}
function M.doThing() end
return M
```

## Error Handling

### pcall for Recoverable Errors

```lua
-- BAD - crashes on error
local data = json.decode(input)

-- GOOD - handle errors
local ok, data = pcall(json.decode, input)
if not ok then
  print("Failed to parse JSON:", data)  -- data is error message
  return nil
end
return data
```

### xpcall with Stack Trace

```lua
local function errorHandler(err)
  return debug.traceback(err, 2)
end

local ok, result = xpcall(function()
  return riskyOperation()
end, errorHandler)

if not ok then
  print("Error with trace:", result)
end
```

### Result Pattern

```lua
---@class Result
---@field ok boolean
---@field value any?
---@field error string?

---@param value any
---@return Result
local function Ok(value)
  return { ok = true, value = value }
end

---@param error string
---@return Result
local function Err(error)
  return { ok = false, error = error }
end

---@param input string
---@return Result
local function parseJson(input)
  local ok, data = pcall(json.decode, input)
  if ok then
    return Ok(data)
  else
    return Err(data)
  end
end

-- Usage
local result = parseJson('{"name": "Kevin"}')
if result.ok then
  print(result.value.name)
else
  print("Error:", result.error)
end
```

## Tables

### Array vs Dictionary

```lua
-- Array (sequential integer keys)
local fruits = { "apple", "banana", "cherry" }
print(#fruits)  -- 3

-- Dictionary (string keys)
local user = {
  name = "Kevin",
  age = 30,
}

-- Mixed (avoid this)
local mixed = { "a", "b", key = "value" }  -- confusing
```

### Iterate Correctly

```lua
-- Arrays: use ipairs
for i, fruit in ipairs(fruits) do
  print(i, fruit)
end

-- Dictionaries: use pairs
for key, value in pairs(user) do
  print(key, value)
end

-- NEVER use pairs on arrays (order not guaranteed)
```

### Table Operations

```lua
-- Insert at end
table.insert(fruits, "date")

-- Insert at position
table.insert(fruits, 2, "blueberry")

-- Remove
table.remove(fruits, 1)

-- Sort
table.sort(fruits)

-- Concatenate
local str = table.concat(fruits, ", ")
```

## Metatables (OOP Pattern)

### Simple Class

```lua
---@class Counter
---@field count number
local Counter = {}
Counter.__index = Counter

---@return Counter
function Counter.new()
  local self = setmetatable({}, Counter)
  self.count = 0
  return self
end

function Counter:increment()
  self.count = self.count + 1
end

function Counter:getValue()
  return self.count
end

-- Usage
local counter = Counter.new()
counter:increment()
print(counter:getValue())  -- 1
```

### Inheritance

```lua
---@class Animal
local Animal = {}
Animal.__index = Animal

function Animal.new(name)
  local self = setmetatable({}, Animal)
  self.name = name
  return self
end

function Animal:speak()
  error("Not implemented")
end

---@class Dog : Animal
local Dog = setmetatable({}, { __index = Animal })
Dog.__index = Dog

function Dog.new(name)
  local self = setmetatable(Animal.new(name), Dog)
  return self
end

function Dog:speak()
  return self.name .. " says woof!"
end
```

## String Handling

### Prefer String Methods

```lua
-- String methods
local upper = str:upper()
local lower = str:lower()
local trimmed = str:match("^%s*(.-)%s*$")  -- trim whitespace
local parts = {}
for part in str:gmatch("[^,]+") do
  table.insert(parts, part)
end
```

### String Formatting

```lua
-- string.format (printf-style)
local msg = string.format("Hello, %s! You have %d messages.", name, count)

-- Concatenation (simple cases only)
local greeting = "Hello, " .. name
```

## Hammerspoon Specific

```lua
-- init.lua
local M = {}

-- Use hs.loadSpoon for Spoons
hs.loadSpoon("ReloadConfiguration")
spoon.ReloadConfiguration:start()

-- Bind hotkeys
hs.hotkey.bind({ "cmd", "alt" }, "r", function()
  hs.reload()
end)

-- Async tasks (non-blocking)
local task = hs.task.new("/usr/bin/curl", function(exitCode, stdout, stderr)
  if exitCode == 0 then
    print(stdout)
  else
    print("Error:", stderr)
  end
end, { "-s", "https://api.example.com" })
task:start()

return M
```

## Neovim Specific

```lua
-- lua/plugins/init.lua
return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    config = function()
      require("nvim-treesitter.configs").setup({
        ensure_installed = { "lua", "typescript", "python" },
        highlight = { enable = true },
      })
    end,
  },
}

-- Options
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true

-- Keymaps
vim.keymap.set("n", "<leader>w", ":w<CR>", { desc = "Save file" })

-- Autocommands
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*.lua",
  callback = function()
    vim.lsp.buf.format()
  end,
})
```

## Project Structure

### Library/Module Project

```text
mylib/
├── .luacheckrc
├── .stylua.toml
├── mylib/
│   ├── init.lua        # Main module (returns M)
│   ├── utils.lua       # Utility functions
│   └── types.lua       # Type definitions
└── tests/
    └── mylib_spec.lua  # busted tests
```

### Neovim Plugin

```text
myplugin.nvim/
├── .luacheckrc
├── .stylua.toml
├── lua/
│   └── myplugin/
│       ├── init.lua
│       └── config.lua
├── plugin/
│   └── myplugin.lua    # Auto-loaded by Neovim
└── README.md
```

### Hammerspoon Config

```text
~/.hammerspoon/
├── init.lua
├── .luacheckrc
├── .stylua.toml
├── Spoons/
│   └── MySpoon.spoon/
│       ├── init.lua
│       └── docs.json
└── lib/
    └── utils.lua
```

## Quick Reference

| Tool | Purpose | Command |
|------|---------|---------|
| LuaLS | Type checking + LSP | Built into editor |
| StyLua | Formatting | `stylua .` |
| luacheck | Linting | `luacheck .` |
| busted | Testing | `busted` |

| Pattern | Preference |
|---------|------------|
| Scoping | `local` always (never implicit global) |
| Modules | Return table, don't set globals |
| Iteration | `ipairs` for arrays, `pairs` for dicts |
| Errors | `pcall`/`xpcall` for recoverable errors |
| Types | LuaLS annotations for IDE support |
| OOP | Metatables with `__index` |
| Strings | Methods (`:upper()`) over functions (`string.upper()`) |

## Notes

- Lua is 1-indexed (arrays start at 1, not 0)
- `nil` and `false` are falsy, everything else is truthy (including 0 and "")
- Tables are the only data structure - use them for arrays, dicts, objects, modules
- No built-in class system - metatables provide OOP patterns
- `#` operator only works reliably on arrays without holes
- Always declare variables `local` at the top of their scope
