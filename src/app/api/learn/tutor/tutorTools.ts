import type { GoogleGenAI } from "@google/genai";
import { GoogleGenAI as GoogleGenAIClient, Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { ConvexHttpClient } from "convex/browser";
import {
  CURRENT_MODULE_INSERT_PLACEMENTS,
  type CurrentModuleInsertionPlacement,
} from "../../../../../shared/currentModuleInsertion";

/** Embeddings always use the server Gemini key (not user BYOK). */
export function getEmbeddingClient(): GoogleGenAI {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY not set");
  }
  return new GoogleGenAIClient({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
}

export async function generateEmbedding(
  ai: GoogleGenAI,
  text: string,
): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return result.embeddings?.[0]?.values ?? [];
}

export function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getRequiredStringArg(
  args: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = getOptionalString(args[key]);
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getOptionalInsertPlacement(
  value: unknown,
): CurrentModuleInsertionPlacement | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return CURRENT_MODULE_INSERT_PLACEMENTS.includes(
    value as CurrentModuleInsertionPlacement,
  )
    ? (value as CurrentModuleInsertionPlacement)
    : undefined;
}

function getCourseKnowledgePieceSource(courseId: Id<"courses">): string {
  return `adaptive-course:${courseId}`;
}

async function getOrCreateCourseKnowledgePieceId(
  convex: ConvexHttpClient,
  spaceId: Id<"spaces">,
  courseId: Id<"courses">,
): Promise<Id<"knowledgePieces">> {
  const knowledgePieces = await convex.query(api.knowledgePieces.getForSpace, {
    spaceId,
  });
  const coursePiece = knowledgePieces.find(
    (piece: { source?: string }) =>
      piece.source === getCourseKnowledgePieceSource(courseId),
  );
  if (coursePiece) {
    return coursePiece._id;
  }

  const fallbackPiece = knowledgePieces[0];
  if (fallbackPiece) {
    return fallbackPiece._id;
  }

  const course = await convex.query(api.courses.get, { courseId });
  if (!course) {
    throw new Error("Course not found.");
  }

  return await convex.mutation(api.knowledgePieces.add, {
    spaceId,
    title: `${course.refinedTitle} notes`,
    content: `Tutor-managed curriculum notes for ${course.refinedTitle}.`,
    source: getCourseKnowledgePieceSource(courseId),
  });
}

async function addCourseKnowledgeNode(params: {
  convex: ConvexHttpClient;
  spaceId: Id<"spaces">;
  courseId: Id<"courses">;
  type: "struggle" | "improvement" | "feels_hard";
  content: string;
}) {
  const knowledgePieceId = await getOrCreateCourseKnowledgePieceId(
    params.convex,
    params.spaceId,
    params.courseId,
  );

  await params.convex.mutation(api.knowledgeNodes.create, {
    spaceId: params.spaceId,
    knowledgePieceId,
    type: params.type,
    content: params.content,
  });
}

// ─── Tool Declarations for Gemini Function Calling ───

export const tutorToolDeclarations: FunctionDeclaration[] = [
  {
    name: "request_lesson",
    description:
      "Request a new lesson on a specific topic within the current course. Use when the student wants to learn about a topic not yet covered, or wants a deeper dive into something.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The topic the student wants a lesson on",
        },
        reason: {
          type: Type.STRING,
          description: "Why this lesson would be helpful (brief)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "suggest_curriculum_change",
    description:
      "Suggest a change to the course curriculum — reorder modules, adjust focus, skip or add topics. Use when the student expresses concern about the curriculum direction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        suggestion: {
          type: Type.STRING,
          description: "What change to make to the curriculum",
        },
        urgency: {
          type: Type.STRING,
          description: "How urgent: 'low', 'medium', or 'high'",
        },
      },
      required: ["suggestion"],
    },
  },
  {
    name: "insert_topic",
    description:
      "Insert a specific topic into the current active module as a lesson, placing it where it best fits in the remaining lesson sequence. Use when the student explicitly asks to add a topic to the module they are currently working through.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The topic to insert into the curriculum",
        },
        context: {
          type: Type.STRING,
          description: "Why this topic should be added and how it connects to the current module",
        },
        focusArea: {
          type: Type.STRING,
          description: "A concise focus area description for the inserted lesson",
        },
        placement: {
          type: Type.STRING,
          description:
            "Where to place the topic in the current module. Use one of: after_current_lesson, before_lesson, after_lesson, end_of_module",
        },
        referenceLessonTitle: {
          type: Type.STRING,
          description:
            "When placement is before_lesson or after_lesson, give the exact lesson title to place this topic relative to",
        },
        targetsWeakness: {
          type: Type.BOOLEAN,
          description:
            "Set true when the inserted lesson is primarily remediating a weakness or confusion",
        },
      },
      required: ["topic"],
    },
  },
];

// ─── Tool Execution ───

export interface ToolResult {
  success: boolean;
  message: string;
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  convex: ConvexHttpClient,
  spaceId: Id<"spaces">,
  courseId: Id<"courses"> | null,
): Promise<ToolResult> {
  switch (toolName) {
    case "request_lesson": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course — the student needs to start or select a course first.",
        };
      }

      try {
        const topic = getRequiredStringArg(args, "topic", "A lesson topic");
        const reason = getOptionalString(args.reason) ?? "Student interest";

        await addCourseKnowledgeNode({
          convex,
          spaceId,
          courseId,
          type: "feels_hard",
          content: `Student requested lesson on: ${topic}. Reason: ${reason}`,
        });

        return {
          success: true,
          message: `Noted! I've flagged "${topic}" as a topic you want covered. The adaptive curriculum will prioritize this in upcoming module generation.`,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(
            error,
            "Failed to register the lesson request.",
          ),
        };
      }
    }

    case "suggest_curriculum_change": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course to modify curriculum for.",
        };
      }

      try {
        const suggestion = getRequiredStringArg(
          args,
          "suggestion",
          "A curriculum suggestion",
        );

        await addCourseKnowledgeNode({
          convex,
          spaceId,
          courseId,
          type: "struggle",
          content: `Curriculum feedback: ${suggestion}`,
        });

        return {
          success: true,
          message: `Curriculum feedback recorded: "${suggestion}". The adaptive system will consider this when generating the next module.`,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(
            error,
            "Failed to record curriculum suggestion.",
          ),
        };
      }
    }

    case "insert_topic": {
      if (!courseId) {
        return {
          success: false,
          message: "No active course — need a course context to insert a topic.",
        };
      }

      try {
        const topic = getRequiredStringArg(args, "topic", "A topic");
        const context = getOptionalString(args.context) ?? "Student request";
        const focusArea = getOptionalString(args.focusArea) ?? context;
        const placement = getOptionalInsertPlacement(args.placement);
        const referenceLessonTitle = getOptionalString(args.referenceLessonTitle);
        const targetsWeakness = args.targetsWeakness === true;

        const result = await convex.mutation(
          api.courseLessons.insertIntoCurrentModule,
          {
            courseId,
            title: topic,
            focusArea,
            placement,
            referenceLessonTitle: referenceLessonTitle ?? undefined,
            targetsWeakness,
          },
        );

        await addCourseKnowledgeNode({
          convex,
          spaceId,
          courseId,
          type: "improvement",
          content: `Tutor inserted "${topic}" into the current module "${result.moduleTitle}" ${result.placementSummary}. Context: ${context}`,
        });

        return {
          success: true,
          message: `Inserted "${topic}" into the current module ${result.placementSummary}.`,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Failed to insert topic."),
        };
      }
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}
