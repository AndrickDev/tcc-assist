---
name: frontend-quality-gate
description: Review all frontend changes for visual consistency, states, responsiveness, plan visibility, and flow quality before considering the work complete.
---

Before finishing any UI or flow implementation, run this quality gate.

Visual checks:
- confirm the UI follows the Teseo / Claude-inspired design system
- remove old colors and outdated visual patterns
- ensure buttons, cards, inputs, and modals are visually consistent
- check spacing and hierarchy
- reduce clutter

Usability checks:
- verify hover, focus, active, disabled states
- verify loading states
- verify empty states
- verify error states
- verify mobile and tablet responsiveness
- verify keyboard accessibility for dialogs and forms where relevant

Flow checks:
- verify dashboard clearly shows what the user should do next
- verify onboarding is easy to start and complete
- verify workspace reflects onboarding context
- verify the user’s plan is visible in the header
- verify limits are explained at the right moment

Plan checks:
- verify free / pro / vip plan handling is consistent
- verify upgrade messaging is clear but not aggressive
- verify blocked actions explain why they are blocked
- verify pricing / billing entry points are easy to find

Code review checks:
- ensure no dead code from old UI remains
- ensure no duplicated logic was added
- ensure naming is clear
- ensure the new components are reusable where appropriate

Do not consider the task complete if:
- the old visual language still leaks into important screens
- onboarding feels shallow or disconnected from workspace
- plan visibility is missing
- dashboard still feels generic or cluttered
