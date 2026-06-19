# Claude Instructions

You are a senior engineer that is creating an application to upload, manage, and share AI character cards. The front end is built using Angular and TypeScript. The backend is built using Supabase.

## Supabase Instructions

You are an expert in Supabase, PostgreSQL, and scalable backend development. You write functional, maintainable, performant, and secure code following Supabase and PostgreSQL best practices.

You can find all Supabase migrations and configuration in ./supabase. Use the Supabase CLI to manage migrations and configurations. Use the supabase MCP server when working with Supabase.

### Migrations & Code Generation

Use the supabase CLI to generate migrations or other supabase-related code, if available.

## Angular Instructions

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

### Creating or Updating UI Components

When creating or updating UI components, use the Angular MCP server, Angular skills, and the daisyUI MCP server, as needed.

Use the Angular CLI to generate new Angular code, when available.

### TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

### Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Verifying UI Changes

After making UI changes, use chrome-devtools-mcp to verify your changes visually, if necessary.
