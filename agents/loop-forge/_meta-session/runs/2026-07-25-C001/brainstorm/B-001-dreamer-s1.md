# B-001 — dreamer / s1

## Subagent meta
- cycle_id: cycle-001
- subagent_id: B-001
- persona: dreamer
- seed: s1
- started_at: 2026-07-24T22:49:39Z
- completed_at: 2026-07-24T22:55:00Z

## Problem echoed
Design a loop that creates other loops — universal, autonomy-enabling, combinable, mid-task-extracting.

## Inherited constraints echoed
(none — inaugural cycle)

## Ideas

### I-001-001: Self-rewriting LOOP.md as ship target
- Description: The meta-loop's ship target IS its own LOOP.md, rewritten every cycle as the γ-synthesis output. Each cycle produces a new hash-versioned protocol; the prior protocol is archived, never edited in place. The loop ships by mutating its own protocol, not by producing an external artifact.
- Why it's novel: cd-review and brainstorm treat LOOP.md as immutable protocol; loop-forge treats it as the shipped product itself.
- Riskiest assumption: That a self-rewriting protocol stays stable enough across cycles to remain executable by the next cycle's agent.
- Warrant: Existing loops already version LOOP.md via git commits; promoting it to ship target makes explicit what was implicit.
- Parent idea: none

### I-001-002: Wave-zero "domain probe" for autonomy-criteria discovery
- Description: A mandatory reconnaissance wave (Wave Ω) runs before protocol authoring: the agent dispatches N cheap probes into the target domain (read its artifacts, run a no-op action, observe which signals return without HITL) and derives the domain's autonomy criteria from what came back. Discovered criteria become inputs to the LOOP.md being authored.
- Why it's novel: Neither existing loop has a reconnaissance step that discovers what "autonomy" means in-situ — both assume it.
- Riskiest assumption: That autonomy criteria can be reliably inferred from probe responses rather than declared by a domain expert.
- Warrant: cd-review already discovers its scope from the codebase via §4 slicing; this generalizes that discovery to the autonomy dimension.
- Parent idea: none

### I-001-003: Typed "ports" as composition primitive
- Description: Every authored LOOP.md declares typed input ports (what cycle-scope inputs it consumes) and typed output ports (what artifacts it produces). Composition = port-matching. `loop-forge + brainstorm` works because brainstorm emits an `ideas-port` and loop-forge consumes a `problem-port`.
- Why it's novel: Existing loops have no formal I/O contract; interfaces are discovered by reading prose.
- Riskiest assumption: That domain loops have meaningfully typeable ports rather than just freeform prose interfaces.
- Warrant: brainstorm and cd-review already implicitly produce known artifact types (idea-docs, audit-fix pairs); ports make that explicit.
- Parent idea: none

### I-001-004: "Loop-itch" detector for mid-task extraction
- Description: Any subagent, at any wave, may file a `loop-itch.md` when it detects the sub-problem it's grinding on exhibits autonomy-envelope properties (repeating decision points, multiple wave-worthy slices, would benefit from its own stop conditions). Orchestrator promotes top-itched sub-problems to a mid-cycle extraction step that spawns a child loop-forge cycle.
- Why it's novel: Neither existing loop allows mid-task extraction of a sub-loop — they explicitly forbid nested agents.
- Riskiest assumption: That subagents can reliably distinguish "this sub-problem deserves its own loop" from "this sub-problem is just hard."
- Warrant: brainstorm already uses persona×seed diversification to detect when an idea warrants its own research dossier; itch-filing generalizes that detection.
- Parent idea: none

### I-001-005: Self-simulation gate before ship
- Description: Before shipping a candidate LOOP.md, the meta-loop runs ONE synthetic cycle of that LOOP.md on a fabricated input (e.g., "author a loop for sorting numbers") and ships only if the simulation closes cleanly — no `fatal_blocked`, no unresolved `Stopped at`. The sim is the verify step; the protocol must run itself before it ships.
- Why it's novel: Existing loops verify outputs post-hoc; loop-forge verifies the protocol itself by executing it once.
- Riskiest assumption: That a synthetic-input cycle can catch enough protocol bugs to justify its token cost.
- Warrant: cd-review already runs Wave D pre-PR review on its own work; self-simulation is the structural analog applied to protocols.
- Parent idea: none

### I-001-006: Autonomy-as-contract wave (PO reversal)
- Description: PO: instead of the agent deciding what autonomy means, the target domain declares its own autonomy budget. A Wave-Ω' presents the domain with a draft autonomy envelope; the domain (via its existing artifacts, a stub, or a representative oracle) accepts or rejects clauses; the loop ships only when both sign. Autonomy is negotiated, not authored.
- Why it's novel: Both existing loops unilaterally declare their autonomy rules; none negotiate them with the target.
- Riskiest assumption: That a target domain has a legible agent to negotiate with (versus being purely passive artifacts).
- Warrant: Brainstorm's launcher↔cycle-scope split already treats autonomy as a negotiated boundary (launcher sets scope, worker sets execution); this surfaces that negotiation as a first-class wave.
- Parent idea: none

### I-001-007: Loop genome with lineage + mutation operator
- Description: Every authored LOOP.md carries a `lineage` block: parent loop hashes, mutation operator (e.g., `+wave`, `port-swap`, `compose`, `reduce`), and inheritance mask. cd-review and brainstorm are designated founder genomes. Combinability is a property of compatible lineages, not ad-hoc.
- Why it's novel: Existing loops have no notion of genetic descent or mutation operator — they're authored as if ex nihilo.
- Riskiest assumption: That the space of loops is meaningfully searchable via mutation rather than always requiring fresh authoring.
- Warrant: brainstorm already uses novelty-archive hashing for idea dedup; genome hashing is the protocol-level analog.
- Parent idea: none

## Self-report
- Ideas generated: 7
- Ideas skipped as duplicate of novelty archive: 0
- Mutations of prior-cycle ideas: 0
- Constraint violations caught and corrected: 0
