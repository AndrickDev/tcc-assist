---
name: nextjs-app-router-standards
description: Implement features in a clean Next.js App Router codebase with strong TypeScript, minimal unnecessary client components, and careful reuse of existing structure.
---

You are implementing changes in a Next.js App Router project.

Principles:
- inspect the current project structure first
- do not invent unnecessary routes
- prefer improving current pages over adding route complexity
- minimize unnecessary client components
- use server components when possible
- use client components only where interactivity is needed
- keep code typed and maintainable

Implementation rules:
- inspect app/, components/, lib/, hooks/, and styles before changing architecture
- reuse existing layout and UI primitives when appropriate
- avoid duplicate business logic
- place reusable business logic in lib/
- place reusable UI in components/
- keep route handlers or server actions consistent with the current codebase

For feature work:
- first identify what already exists
- then propose minimal structural changes
- then implement incrementally
- keep code easy to review

State and data rules:
- keep temporary onboarding state localized if possible
- when onboarding creates a project, persist only what is needed
- ensure workspace can consume project context reliably
- avoid fragile prop drilling if existing patterns support a cleaner alternative

UX and rendering:
- loading states should exist for meaningful waits
- empty states should be explicit and useful
- error states should guide the next action
- forms should validate clearly
- avoid hydration issues

When updating visuals:
- prefer changing design tokens, reusable components, and shared classes over one-off hacks
- eliminate legacy colors and inconsistent styles at the component level when possible

Done criteria:
- code fits current project conventions
- no unnecessary route explosion
- no redundant logic
- code is production-ready and reviewable
