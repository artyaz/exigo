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
import type * as authDecorators from "../authDecorators.js";
import type * as courseAi from "../courseAi.js";
import type * as courseLessonMessages from "../courseLessonMessages.js";
import type * as courseLessons from "../courseLessons.js";
import type * as courseModules from "../courseModules.js";
import type * as courseOrchestrator from "../courseOrchestrator.js";
import type * as coursePrompts from "../coursePrompts.js";
import type * as courseTutor from "../courseTutor.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as debugPlan from "../debugPlan.js";
import type * as deepDives from "../deepDives.js";
import type * as exerciseComments from "../exerciseComments.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as knowledgeNodes from "../knowledgeNodes.js";
import type * as knowledgeNodesActions from "../knowledgeNodesActions.js";
import type * as knowledgePieces from "../knowledgePieces.js";
import type * as planLimits from "../planLimits.js";
import type * as plans from "../plans.js";
import type * as questions from "../questions.js";
import type * as seedPlans from "../seedPlans.js";
import type * as seedPrompts from "../seedPrompts.js";
import type * as spaces from "../spaces.js";
import type * as subscriptionService from "../subscriptionService.js";
import type * as subscriptionServiceInternal from "../subscriptionServiceInternal.js";
import type * as subscriptionsInternal from "../subscriptionsInternal.js";
import type * as testMessages from "../testMessages.js";
import type * as testMessagesActions from "../testMessagesActions.js";
import type * as testUtils from "../testUtils.js";
import type * as tests from "../tests.js";
import type * as usageService from "../usageService.js";
import type * as userSettings from "../userSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authDecorators: typeof authDecorators;
  courseAi: typeof courseAi;
  courseLessonMessages: typeof courseLessonMessages;
  courseLessons: typeof courseLessons;
  courseModules: typeof courseModules;
  courseOrchestrator: typeof courseOrchestrator;
  coursePrompts: typeof coursePrompts;
  courseTutor: typeof courseTutor;
  courses: typeof courses;
  crons: typeof crons;
  debugPlan: typeof debugPlan;
  deepDives: typeof deepDives;
  exerciseComments: typeof exerciseComments;
  health: typeof health;
  http: typeof http;
  knowledgeNodes: typeof knowledgeNodes;
  knowledgeNodesActions: typeof knowledgeNodesActions;
  knowledgePieces: typeof knowledgePieces;
  planLimits: typeof planLimits;
  plans: typeof plans;
  questions: typeof questions;
  seedPlans: typeof seedPlans;
  seedPrompts: typeof seedPrompts;
  spaces: typeof spaces;
  subscriptionService: typeof subscriptionService;
  subscriptionServiceInternal: typeof subscriptionServiceInternal;
  subscriptionsInternal: typeof subscriptionsInternal;
  testMessages: typeof testMessages;
  testMessagesActions: typeof testMessagesActions;
  testUtils: typeof testUtils;
  tests: typeof tests;
  usageService: typeof usageService;
  userSettings: typeof userSettings;
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
