---
name: ts-standards
description: TypeScript standards - strict mode, Result types, discriminated unions, readonly default, import type, as const. Triggers: TypeScript, defining types, error handling, TypeScript patterns.
---

# TypeScript Best Practices

## When to Use This Skill

This skill should be triggered when:

- Writing or reviewing TypeScript code
- Defining types, interfaces, or type utilities
- Handling errors and result types
- Discussing TypeScript patterns and conventions
- Setting up tsconfig.json
- Working with generics or discriminated unions

## Core Capabilities

1. **Type System**: Strict mode, discriminated unions, readonly defaults
2. **Error Handling**: Result types over throwing, tryCatch utility
3. **Code Style**: Alphabetical ordering, import type, named exports
4. **React Integration**: Props destructuring, typed components

## Compiler Configuration

### Required tsconfig.json Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Types & Interfaces

### When to Use Each

- **`type`**: Unions, intersections, utility types
- **`interface`**: Object shapes intended to be extended

### Interface Extends Over Intersections

```typescript
// BAD - intersections can be slow and complex
type A = { a: string };
type B = { b: string };
type C = A & B;

// GOOD - interface inheritance
interface IA { a: string }
interface IB { b: string }
interface IC extends IA, IB { /* extra */ }
```

### Avoid `any`, Use `unknown`

```typescript
// BAD
function parse(input: any) { return input.data; }

// GOOD
function parse(input: unknown) {
  if (typeof input === 'object' && input !== null && 'data' in input) {
    return (input as { data: unknown }).data;
  }
  throw new Error('Invalid input');
}
```

### `any` in Generic Functions (Exception)

Inside generic functions, constrained return types can be hard to express. Using `any` locally is acceptable:

```typescript
const youSayGoodbyeISayHello = <TInput extends "hello" | "goodbye">(
  input: TInput,
): TInput extends "hello" ? "goodbye" : "hello" => {
  if (input === "goodbye") {
    return "hello" as any;
  } else {
    return "goodbye" as any;
  }
};
```

## Discriminated Unions

Prefer discriminated unions to avoid "bags of optionals":

```typescript
// Events
type UserCreatedEvent = { type: "user.created"; data: { id: string; email: string } };
type UserDeletedEvent = { type: "user.deleted"; data: { id: string } };
type Event = UserCreatedEvent | UserDeletedEvent;

const handleEvent = (event: Event) => {
  switch (event.type) {
    case "user.created":
      console.log(event.data.email);
      break;
    case "user.deleted":
      console.log(event.data.id);
      break;
  }
};

// Fetch state
type FetchingState<TData> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: Error };
```

## Error Handling

### Result Type Over Throwing

Prefer explicit result types over try/catch at call sites:

```typescript
type Result<T, E extends Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const parseJson = (input: string): Result<unknown, Error> => {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
};

const result = parseJson('{"name": "John"}');
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

### tryCatch Utility

Use for elegant error handling with both sync and async functions:

```typescript
type TryCatchResult<T> = readonly [Error, undefined] | readonly [undefined, T];

function tryCatch<T>(fn: () => Promise<T>): Promise<TryCatchResult<T>>;
function tryCatch<T, TArgs extends readonly unknown[]>(
  fn: (...args: TArgs) => Promise<T>,
  ...args: TArgs
): Promise<TryCatchResult<T>>;
function tryCatch<T>(fn: () => T): TryCatchResult<T>;
function tryCatch<T, TArgs extends readonly unknown[]>(
  fn: (...args: TArgs) => T,
  ...args: TArgs
): TryCatchResult<T>;

// Usage
const [error, data] = await tryCatch(fetchUser, "123");
const [parseError, parsed] = tryCatch(JSON.parse, '{"name": "John"}');

if (error) {
  console.error("Failed:", error.message);
  return;
}
console.log("Success:", data);
```

### Typed Error Classes

Never throw raw strings; always Error subclasses:

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

## Readonly by Default

Use `readonly` to prevent accidental mutation:

```typescript
// BAD
type User = { id: string };
const user: User = { id: "1" };
user.id = "2"; // Allowed but dangerous

// GOOD
type SafeUser = { readonly id: string };
const safeUser: SafeUser = { id: "1" };
// safeUser.id = "2"; // Error!
```

## Optional Properties

Use sparingly. If a value must be provided (even `undefined`), encode that:

```typescript
// BAD - unclear if userId was forgotten or intentionally omitted
type AuthOptions = { userId?: string };

// GOOD - explicit about requiring the key
type AuthOptionsStrict = { userId: string | undefined };
```

## Enums: Use `as const` Instead

Do not introduce new enums. Prefer `as const` objects:

```typescript
const backendToFrontendEnum = {
  xs: "EXTRA_SMALL",
  sm: "SMALL",
  md: "MEDIUM",
} as const;

type Lower = keyof typeof backendToFrontendEnum; // "xs" | "sm" | "md"
type Upper = (typeof backendToFrontendEnum)[Lower]; // "EXTRA_SMALL" | "SMALL" | "MEDIUM"
```

## Import Type

Prefer `import type` for type-only imports:

```typescript
// BAD - inline type import
import { type User } from "./user";

// GOOD - separate type import
import type { User } from "./user";
```

## Named Exports Over Default

Prefer named exports. Use default only where frameworks require (Next.js pages):

```typescript
// BAD
export default function myFunction() { return "Hello" }

// GOOD
export function myFunction() { return "Hello" }

// Framework-required default is acceptable
export default function MyPage() { return "Hello" }
```

## Alphabetical Property Ordering

All added properties should be alphabetized:

```typescript
// GOOD
const config = {
  apiKey: "key",
  baseUrl: "url",
  debug: true,
  timeout: 5000,
};

interface User {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
}
```

## Return Types

Declare explicit return types for top-level module functions. Exception: React components.

```typescript
// Explicit return type
const myFunc = (): string => {
  return "hello";
};

// React component - no return type needed
function Button(props: ButtonProps) {
  return <button>{props.label}</button>;
}
```

## React Functional Components

Destructure props inside the function body (not in parameters):

```typescript
interface ButtonProps {
  className?: string;
  label: string;
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  // Destructure inside the body
  const { className, label, onClick } = props;

  return (
    <button className={className} onClick={onClick}>
      {label}
    </button>
  );
}
```

Benefits:
- Easier to provide defaults
- Can forward full props object when needed
- Improved readability

## Naming Conventions

- **camelCase**: variables and functions
- **PascalCase**: classes, types, interfaces
- **UPPER_SNAKE_CASE**: constants and enum values

```typescript
type RecordOfArrays<TItem> = Record<string, TItem[]>;
const MAX_RETRIES = 3;
function getUserById(id: string): User { /* ... */ }
```

## Generic Type Parameters

Use descriptive prefixes:

```typescript
type RecordOfArrays<TItem> = Record<string, TItem[]>;
function map<TInput, TOutput>(arr: TInput[], fn: (item: TInput) => TOutput): TOutput[];
```

## JSDoc Comments

Use for non-obvious behavior and public APIs:

```typescript
/** Subtracts two numbers */
const subtract = (a: number, b: number) => a - b;

/** Does the opposite to {@link subtract} */
const add = (a: number, b: number) => a + b;
```

## noUncheckedIndexedAccess

When enabled, indexing results in `T | undefined`:

```typescript
const obj: Record<string, string> = {};
const v1 = obj.key; // string | undefined

const arr: string[] = [];
const v2 = arr[0]; // string | undefined
```

## Quick Reference

| Pattern | Preference |
|---------|------------|
| Type vs Interface | `type` for unions, `interface` for extendable shapes |
| Error handling | Result types over try/catch |
| Enums | `as const` objects |
| Imports | `import type` for types |
| Exports | Named exports (default only for frameworks) |
| Properties | Alphabetical order |
| Mutability | `readonly` by default |
| Optional props | Explicit `string \| undefined` over `?` |
| any | Avoid; use `unknown` (exception: generic functions) |

## Notes

- Enable all strict compiler options
- Discriminated unions make impossible states impossible
- Result types make error handling explicit at call sites
- Readonly prevents accidental mutation bugs
- Alphabetical ordering improves scanability
