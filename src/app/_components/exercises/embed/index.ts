/* Client-safe surface for the free-HTML embedded path. The constructor is
   server-only and imported directly by the API route, not re-exported here. */
export { EmbedExercise, type EmbedResult } from "./EmbedExercise";
export { buildEmbedDoc, STAGE_IMPORT_MAP, STAGE_GLOBALS, STAGE_MANIFEST } from "./runtime";
