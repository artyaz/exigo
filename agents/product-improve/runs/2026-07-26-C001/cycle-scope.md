# Cycle Scope — cycle-001

## Problem statement

Map Exigo's product areas and generate improvement suggestions that make the codebase easier to read, clearer, shorter, and more consistent while maintaining correctness and aligning with Exigo's core mission (adaptive AI-powered learning).

## Context

Exigo is an AI-powered adaptive learning platform. The codebase has grown organically across a dual-database system (Convex primary + legacy Prisma), multiple AI integration paths (Next API routes + Convex actions), and a complex course state machine. Prior cd-review cycles (2026-07-18) identified structural debt: duplicated AI helpers, inconsistent retry patterns, a course orchestrator that never terminates, and forked conventions. This cycle maps product areas holistically and proposes improvements that respect existing conventions.

## Inherited constraints

(none — first cycle)

## Stop condition

Goal-anchored: produce 3-5 verified improvement proposals (decision packages) worth implementing, each with a concrete implementation sketch that respects Exigo conventions (§11 of cd-review LOOP.md).

## Out of scope

- New product features unrelated to code quality / consistency
- Rewrites that break the public API surface of Convex functions
- Adding new dependencies
- Changes to `.env*`, `convex/_generated/`, CI config

## Success shape

3-5 decision packages with:
- Clear recommendation + rationale
- Approaches table (pros/cons/north-star score/effort)
- Minimal implementation sketch (files + steps)
- Consistency with Exigo conventions (Convex DB, auth patterns, AI integration, shared code)
- Prioritized by north-star: readable → clear → short → consistent → correct

## Cycle type

scout (default — first cycle, no prior data)

## Hard budget

380,000 tokens kill-switch; 350,000 target
