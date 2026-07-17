/* Exigo markup frontend: HTML-shaped syntax, closed scene-graph semantics,
   lowered onto the existing ReactiveSpec IR. The MANIFEST is the single
   source of truth for the authoring vocabulary. */
export { parseMarkup } from "./parse";
export type { ParseResult, MarkupError } from "./parse";
export { MANIFEST, ACCENTS, TONES } from "./manifest";
export type { TagSpec, AttrSpec, AttrKind } from "./manifest";
