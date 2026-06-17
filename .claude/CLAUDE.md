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

When creating or updating UI components, use the Angular MCP server and the daisyUI MCP server, as needed.

Use the Angular CLI to generate new Angular code, when available.

### ARIA & Accessibility

All UI components must use accessibility best practices so that the application is accessible to all users, including those using accessibility devices.

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

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
