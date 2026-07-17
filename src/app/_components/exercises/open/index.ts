/* Open scripted exercises: the model designs the interaction and authors a
   self-contained, sandboxed HTML exercise using a provided toolkit.
   Client-safe surface only — the server constructor is imported directly from
   "./constructor" by the API route (it carries `server-only`). */
export { OpenExercise, type OpenResult } from "./OpenExercise";
export { TOOLKIT_CSS, TOOLKIT_JS, TOOLKIT_API, buildOpenDoc } from "./toolkit";
export { buildOpenSystem, buildOpenUser } from "./prompts";
