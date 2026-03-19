---
name: teseo-product-flow
description: Design and implement the Teseo product flow from dashboard to TCC creation and workspace, including onboarding context and plan-aware UX.
---

You are responsible for the core product flow of Teseo.

Product context:
Teseo is an AI SaaS that helps Brazilian university students create and structure TCCs and related academic work.

Main product flow:
1. user enters dashboard
2. dashboard shows current projects, progress, recent activity, plan badge, and main CTA
3. user starts creating a new TCC
4. onboarding happens inline, preferably in a modal, drawer, or embedded panel inside dashboard
5. onboarding collects the minimum strong context necessary for the AI workspace
6. user creates the project
7. workspace opens already contextualized
8. workspace guides the user through structure, writing, review, and export

Important rule:
- do not create a new route for onboarding if the current dashboard can support it well
- prefer a fast embedded experience over route sprawl

Onboarding must collect:
- tema
- curso
- faculdade
- tipo de trabalho
- norma
- prazo
- objetivo or problem statement
- optional tone / complexity / level if helpful

Onboarding quality rules:
- onboarding should not be a single long form
- break it into a few simple steps
- explain why each piece of information matters
- microcopy should make the user feel guided
- every step should contribute real context for the workspace

Workspace rules:
- workspace must visibly reflect the onboarding context
- user should see key project metadata
- AI generation should use context from onboarding
- workspace should feel like a serious writing environment, not a generic chatbot
- highlight next recommended step in the TCC process

Plan-aware UX:
- always show current plan in the header
- plan can be free, pro, or vip
- free users have stricter limits
- limitations should appear at the moment they matter
- do not use aggressive dark patterns
- upsell should feel clear and helpful, not annoying

Free / Pro / VIP logic:
- free: lower project and generation limits
- pro: more projects and stronger generation/review features
- vip: broad access, advanced review, premium capabilities

When modifying the current app:
- inspect what already exists before proposing new structures
- reuse existing routes, components, and patterns when possible
- improve the flow instead of rebuilding blindly

Done criteria:
- dashboard to workspace journey is clear
- onboarding is embedded and useful
- workspace starts with strong context
- plan logic is visible and understandable
