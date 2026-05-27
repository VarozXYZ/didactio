<div align="center">

<h1>
  <img src="frontend/assets/logos/logo.png" alt="Didactio logo" width="44" align="center" />
  Didactio
</h1>

### An AI-assisted workspace for learning

Didactio turns an idea into a structured teaching plan. On the backend, it combines AI generation with research-oriented prompt chaining to create educationally sound learning content. On the frontend, it provides a user-friendly content creation process and a book-like reading experience designed for working on a computer.

<br />

<img src="frontend/assets/screenshots/editor-dark.png" alt="Didactio editor in dark mode" width="96%" />

<br />

</div>

---

## The Idea

The idea comes from the frustration of working with traditional chatbots to learn about a new topic. If you have tried this before, you may have found that traditional chatbots often stay on the surface and rarely go deep into a subject, making learning and practice difficult unless you already have access to structured learning material.

Didactio was built to combine generative AI with guardrails based on educational theory, producing didactic units that are coherent, structured, and useful. Over time, it evolved into a broader learning suite with a user-friendly UI that keeps the learning process inside the Didactio platform.

---

## Showcase

### Library and Dashboard

The dashboard brings together units, folders, progress, creation actions, and fast access to content. The interface supports both light and dark modes.

<div align="center">
  <img src="frontend/assets/screenshots/dashboard-light.png" alt="Didactio dashboard in light mode" width="48%" />
  <img src="frontend/assets/screenshots/dashboard-dark.png" alt="Didactio dashboard in dark mode" width="48%" />
</div>

### Unit Viewer and Editor

The viewer/editor is the main workspace: reading, chapter navigation, rich editing, formatting tools, export views, and continuation of generated content.

<div align="center">
  <img src="frontend/assets/screenshots/editor-light.png" alt="Didactio editor in light mode" width="48%" />
  <img src="frontend/assets/screenshots/editor-dark.png" alt="Didactio editor in dark mode" width="48%" />
</div>

### Mobile Experience

Didactio also supports smaller screens with a mobile editor experience adapted for reading, reviewing, and essential actions.

<div align="center">
  <img src="frontend/assets/screenshots/editor-light-mobile.png" alt="Didactio mobile editor in light mode" width="30%" />
  <img src="frontend/assets/screenshots/editor-dark-mobile.png" alt="Didactio mobile editor in dark mode" width="30%" />
</div>

---

## Learning Activities

Didactio does not stop at the document. Each unit can be extended with learning activities that turn content into guided practice.

<table>
  <tr>
    <td width="50%">
      <h3>Quick check</h3>
      <p>Fast questions to verify immediate understanding and reveal gaps before moving forward.</p>
      <img src="frontend/assets/screenshots/quick-check.png" alt="Quick check activity" width="100%" />
    </td>
    <td width="50%">
      <h3>Flash cards</h3>
      <p>Review cards for concepts, definitions, key terms, and active recall.</p>
      <img src="frontend/assets/screenshots/flash-cards.png" alt="Flash cards activity" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>Open response</h3>
      <p>Open-ended prompts for reasoning, justification, and deeper comprehension checks.</p>
      <img src="frontend/assets/screenshots/open-response.png" alt="Open response activity" width="100%" />
    </td>
    <td width="50%">
      <h3>Case study</h3>
      <p>Applied scenarios that connect theory with decisions, analysis, and classroom-friendly situations.</p>
      <img src="frontend/assets/screenshots/case-study.png" alt="Case study activity" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>Code practice</h3>
      <p>Coding exercises for technical subjects, with prompts designed for step-by-step practice.</p>
      <img src="frontend/assets/screenshots/code-practice.png" alt="Code practice activity" width="100%" />
    </td>
    <td width="50%">
      <h3>Mini project</h3>
      <p>Larger challenges that synthesize content into a practical, assessable deliverable.</p>
      <img src="frontend/assets/screenshots/mini-project.png" alt="Mini project activity" width="100%" />
    </td>
  </tr>
</table>

---

## Authentication and Security

Authentication is owned by the backend. Users create and access accounts via Google OAuth. The server creates the session, persists refresh-token state, and issues a short-lived access token for authenticated API calls. The durable part of the session stays in an HTTP cookie, while the access token is intentionally temporary, so the frontend can make lightweight requests without becoming the source of truth for identity.

Protected feature routes resolve the current user before reaching domain logic such as units, notes, folders, credits, or billing. Admin-only behavior is separated from regular user routes.

The same boundary exists for generated content. AI output and editor input eventually become HTML rendered back to the user, so the backend treats that content as data that must be normalized, hashed, extracted, and sanitized before reuse. Authentication, API validation, and content safety therefore work as one request pipeline instead of as isolated checks.

---

## Viewer and Editor Engine

The unit viewer/editor is the core production surface of Didactio. It combines a readable chapter experience with a rich editing environment built on Tiptap and ProseMirror. Behind the interface, the app handles HTML normalization, paste cleanup, heading identifiers, code highlighting, chapter rendering, reading progress, export views, and continuity between generated sections.

This is where Didactio behaves less like a chat wrapper and more like an authoring tool: content can be generated, inspected, edited, styled, exported, and revisited as part of a durable didactic unit.

<div align="center">
  <img src="frontend/assets/screenshots/editor-light.png" alt="Didactio editor with generated didactic content" width="48%" />
  <img src="frontend/assets/screenshots/editor-dark.png" alt="Didactio editor in dark mode" width="48%" />
</div>

---

## Exporting Content and Exercises

Users can export didactic unit content after editing it, and they can also export the generated learning activities attached to the unit. That matters because the material is not locked inside the app: chapters, explanations, and exercises can move into the formats teachers actually use for delivery, review, or classroom preparation.


<div align="center">
  <img src="frontend/assets/screenshots/export.png" alt="Didactio export options for unit content and exercises" width="72%" />
</div>

---

## AI, Preferences, and Personalization

The AI layer is configurable around the way each user wants to work. Didactio supports model selection, authoring language, tone, learner level, extra instructions, and cost-aware generation paths. The backend separates prompt building, schemas, providers, streaming, telemetry, and generation run state so long-running content creation remains observable and recoverable.

User preferences are not decorative settings. They shape how content is created, how the interface behaves, and how the product adapts to different teaching styles.

<div align="center">
  <img src="frontend/assets/screenshots/preferences.png" alt="Didactio user preferences and model settings" width="72%" />
</div>

---

## Notes, History, Styles, and Guidance

Didactio adds supporting tools around the editor so a unit can evolve over time. Notes let users keep contextual annotations close to the material. Version history gives visibility into changes. Presentation styles make the same content feel different depending on the teaching context. The tutorial helps new users understand the workflow without leaving the product.

<table>
  <tr>
    <td width="50%">
      <h3>Notes</h3>
      <p>Contextual annotations attached to the working unit.</p>
      <img src="frontend/assets/screenshots/notes.png" alt="Notes in Didactio" width="100%" />
    </td>
    <td width="50%">
      <h3>Version history</h3>
      <p>A timeline for tracking how generated and edited material changes.</p>
      <img src="frontend/assets/screenshots/version-history.png" alt="Version history in Didactio" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>Tutorial</h3>
      <p>In-product guidance for understanding the workspace and creation flow.</p>
      <img src="frontend/assets/screenshots/tutorial.png" alt="Didactio tutorial" width="100%" />
    </td>
    <td width="50%">
      <h3>Analytics</h3>
      <p>Usage insights for understanding activity, credits, and product behavior.</p>
      <img src="frontend/assets/screenshots/analytics.png" alt="Didactio analytics" width="100%" />
    </td>
  </tr>
</table>

### Presentation Styles

The same unit can be displayed through different visual treatments, making the authoring experience adaptable to different materials and audiences.

<div align="center">
  <img src="frontend/assets/screenshots/style-classic.png" alt="Classic presentation style" width="32%" />
  <img src="frontend/assets/screenshots/style-modern.png" alt="Modern presentation style" width="32%" />
  <img src="frontend/assets/screenshots/style-plain.png" alt="Plain presentation style" width="32%" />
</div>

---

## Credits and Plans

Didactio includes a credit-based generation model. Credits make AI usage explicit, measurable, and easier to connect to pricing. The backend tracks generation costs and reservations, while the product layer connects plans, Stripe billing, account state, and available balance.

<div align="center">
  <img src="frontend/assets/screenshots/credits-plans.png" alt="Didactio credits and plans" width="72%" />
</div>

---

## Architecture

```txt
didactio/
|-- backend/
|   |-- src/
|   |   |-- ai/                  # Model catalog, prompt builders, schemas, streaming, and telemetry
|   |   |-- analytics/           # Usage analytics and reporting routes
|   |   |-- auth/                # Core auth, Google OAuth, cookies, sessions, users, and admin routes
|   |   |-- billing/             # Stripe pricing, checkout, webhooks, and billing event storage
|   |   |-- commands/            # Operational scripts for onboarding resets and template exports
|   |   |-- config/              # Environment parsing and runtime configuration
|   |   |-- credits/             # Generation costs, reservations, and credit accounting
|   |   |-- didactic-unit/       # Units, planning, chapters, notes, progress, templates, and HTTP routes
|   |   |-- folders/             # Folder defaults, persistence, and organization routes
|   |   |-- generation-runs/     # Long-running generation state and persistence
|   |   |-- html/                # Sanitization, hashing, continuity, and content block extraction
|   |   |-- http/                # API helpers, route dependencies, auth helpers, and health checks
|   |   |-- learning-activities/ # Activity models, stores, and routes
|   |   |-- logging/             # Application logger
|   |   |-- mongo/               # MongoDB connection lifecycle
|   |   |-- presentation-theme/  # Presentation theme types and validation
|   |   |-- providers/           # Syllabus and chapter generation providers
|   |   |-- utils/               # Shared backend utilities
|   |   |-- app.ts               # Express application assembly
|   |   `-- server.ts            # Runtime entrypoint
|   `-- tests/
|
|-- frontend/
|   |-- assets/                  # Static frontend assets
|   |-- src/
|   |   |-- components/          # UI, dashboard, marketing, auth, and onboarding
|   |   |-- dashboard/           # API client, editor, export, hooks, and utilities
|   |   |-- pages/               # Home, login, pricing, dashboard, onboarding
|   |   `-- theme/               # Light/dark appearance
|   `-- tests/
|
`-- package.json                 # npm workspace for frontend and backend
```

---

## Technical Stack

Didactio is structured as a TypeScript npm workspace with two private packages: `frontend` and `backend`. The root workspace owns cross-project commands for development, build, tests, coverage, and linting, while each package keeps its own runtime dependencies and build configuration.

### Frontend Runtime

| Area | Stack | How it is used |
| --- | --- | --- |
| Application shell | React 19, React DOM, React Router 7 | Page routing, authenticated dashboard views, marketing pages, onboarding, pricing, and account flows. |
| Build system | Vite 7, `@vitejs/plugin-react-swc`, TypeScript 5.9 | Fast local development, SWC-powered React compilation, type checking through `tsc -b`, and production bundling. |
| Styling | Tailwind CSS 4, `@tailwindcss/vite`, `tailwind-merge`, `clsx`, `class-variance-authority` | Utility-first styling, variant-driven component classes, theme-aware composition, and conflict-free class merging. |
| UI primitives | Radix UI Dialog, Dropdown Menu, Popover, Hover Card, Alert Dialog, Progress, Toast | Accessible primitives for menus, modals, feedback, overlays, and dashboard interactions. |
| Interaction | Motion, lucide-react, cmdk, React Wheel Picker | Animated transitions, iconography, command-style interactions, and compact selection controls. |
| Data visualization | Recharts | Dashboard and analytics charts. |

Vite also proxies API and auth routes to the backend during development, so the frontend can call `/api`, `/auth/me`, `/auth/google`, `/auth/refresh`, and related endpoints without hardcoding backend URLs in UI code.

### Editor and Content Rendering

| Area | Stack | How it is used |
| --- | --- | --- |
| Rich editor | Tiptap 3, ProseMirror, `@tiptap/react`, StarterKit | The editable unit surface: headings, paragraphs, lists, rich formatting, structured document state, and extension-driven behavior. |
| Editor extensions | Tiptap underline, highlight, link, table, subscript, superscript, code block lowlight | Teaching-oriented formatting, tables, inline emphasis, links, academic notation, and code-aware material. |
| Code rendering | lowlight, Shiki | Syntax highlighting for generated and edited technical content. |
| Markdown/HTML pipeline | unified, remark-parse, remark-gfm, remark-breaks, remark-rehype, rehype-stringify, html-react-parser | Conversion and rendering between generated markdown-like content, HTML, and React-rendered educational blocks. |
| Text measurement | `@chenglou/pretext` | Layout-sensitive text measurement used by dashboard presentation utilities. |
| Activity UI | react-quizlet-flashcard, canvas-confetti | Interactive learning activities and feedback moments. |

The editor is not isolated from the rest of the product. Generated chapters are rendered, edited, cleaned after paste operations, assigned heading IDs, highlighted when they contain code, tracked for reading progress, and prepared for export. That is why the stack includes both document editing libraries and lower-level content parsing utilities.

### Backend Runtime

| Area | Stack | How it is used |
| --- | --- | --- |
| HTTP server | Node.js, Express 5, TypeScript, tsx | API routes, auth routes, health checks, local watch mode, and compiled production output. |
| Persistence | MongoDB driver 7 | Users, sessions, units, folders, notes, learning activities, generation runs, credit transactions, and billing events. |
| Configuration | dotenv, typed environment parsing | Runtime configuration for MongoDB, AI providers, auth secrets, cookies, CORS, Stripe, and public app URLs. |
| Validation | Zod | Runtime validation for API payloads, AI contracts, presentation theme data, and feature boundaries. |
| HTML processing | parse5, sanitize-html | Parsing, extracting, normalizing, hashing, and sanitizing generated or edited HTML before it is reused. |
| Security middleware | Helmet, CORS, cookie-parser, jsonwebtoken | HTTP hardening, origin control, signed/parsed cookies, access tokens, and refresh-token session flows. |

The backend is organized by domain rather than by generic MVC folders. Units, chapters, notes, folders, activities, credits, billing, analytics, generation runs, and auth each have their own route/store/service boundaries, with Mongo-backed implementations where persistence is needed.

### AI and Generation

| Area | Stack | How it is used |
| --- | --- | --- |
| AI runtime | Vercel AI SDK (`ai`) | Provider-agnostic generation calls and model integration. |
| Model strategy | Model configuration through environment variables and frontend | Lets the product route different generation tasks through different cost/quality profiles. |
| Streaming | NDJSON generation routes | Long-running generation can stream progress and partial results instead of blocking the UI. |
| Contracts | Shared AI types, backend schemas, prompt builders | Keeps generated syllabi, chapters, activities, and continuation flows closer to expected shapes. |
| Telemetry | Generation telemetry and run stores | Tracks generation behavior, costs, and long-running operation state. |

The AI layer is separated from the HTTP layer. Routes receive requests and resolve users; prompt builders and providers shape the generation task; schemas validate the result; generation runs preserve state; credits account for cost. That separation keeps AI behavior inspectable instead of burying it inside controller code.

### Auth, Billing, and Product Infrastructure

| Area | Stack | How it is used |
| --- | --- | --- |
| Authentication | Passport, Google OAuth 2.0, JWT, refresh cookies | Google sign-in, backend-owned sessions, short-lived access tokens, and cookie-backed refresh flows. |
| Authorization | Authenticated route helpers and admin route separation | Domain routes resolve the current user before accessing private units, notes, credits, billing, or admin behavior. |
| Billing | Stripe | Pricing, checkout, subscription/payment flows, and webhook-backed billing events. |
| Credits | Internal credit cost and reservation modules | Makes generation usage explicit and ties AI work to account balance and plan state. |
| Analytics | Backend analytics routes plus Recharts on the frontend | Usage reporting and visual account/product insights. |

### Testing and Quality

| Area | Stack | How it is used |
| --- | --- | --- |
| Unit/integration tests | Vitest | Frontend and backend test execution through workspace scripts. |
| React tests | Testing Library, user-event, jsdom | Component behavior and user interaction tests. |
| Backend HTTP tests | Supertest | API route testing without needing a real browser client. |
| Coverage | `@vitest/coverage-v8` | Coverage reporting across both workspaces. |
| Linting | ESLint 9, TypeScript ESLint, React Hooks, React Refresh | Static checks for TypeScript and React code. |
| Build validation | `tsc -b`, Vite build, backend `tsc -p` | Separate type/build validation for frontend and backend packages. |

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your real MongoDB, authentication, AI provider, and Stripe values if you want to test payments.

### 3. Start the services

In one terminal:

```bash
npm run dev:backend
```

In another terminal:

```bash
npm run dev:frontend
```

Defaults:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

---

## Useful Scripts

| Command | Description |
| --- | --- |
| `npm run dev:frontend` | Starts the Vite frontend. |
| `npm run dev:backend` | Starts the backend with `tsx watch`. |
| `npm run build` | Builds all workspaces. |
| `npm run test` | Runs frontend and backend tests. |
| `npm run test:coverage` | Runs tests with coverage. |
| `npm run lint` | Runs ESLint where available. |

---

## Project Status and Author

Didactio is a private educational project in active development, designed and developed by **Alvaro Rodriguez Pizarro**. This repository works as a product foundation, technical showcase, and demonstration of a complete generative education experience.

The source code is made available here only for authorized review. Check the license before using any part of the project.

---

## License

This project uses a proprietary license. All rights are reserved. No permission is granted to copy, modify, distribute, sublicense, host, resell, or use the code for commercial or public purposes without express written authorization.

See [LICENSE](LICENSE) for details.
