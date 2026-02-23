/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as deepDives from "../deepDives.js";
import type * as knowledgePieces from "../knowledgePieces.js";
import type * as planLimits from "../planLimits.js";
import type * as questions from "../questions.js";
import type * as spaces from "../spaces.js";
import type * as testMessages from "../testMessages.js";
import type * as tests from "../tests.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  deepDives: typeof deepDives;
  knowledgePieces: typeof knowledgePieces;
  planLimits: typeof planLimits;
  questions: typeof questions;
  spaces: typeof spaces;
  testMessages: typeof testMessages;
  tests: typeof tests;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
