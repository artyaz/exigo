export interface LessonSection {
  content: string;
  inputRequest?: {
    type: string;
    question: string;
    expectedAnswer: string;
  };
}

export type LessonInputRequest = NonNullable<LessonSection["inputRequest"]>;

export type LessonVerification = {
  is_correct: boolean;
  feedback_block: string;
};

export type LessonCheckpointStatus = "pending" | "answered" | "skipped";

export type PersistedLessonCheckpointState = {
  sectionIndex: number;
  question: string;
  status: LessonCheckpointStatus;
  answer?: string;
  verification?: LessonVerification;
};

export type RestoredCheckpointState = {
  answer?: string;
  skipped?: boolean;
  verification?: LessonVerification;
};

type LessonVerifierLog = {
  question: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback: string;
};

type LessonMessageSnapshot = {
  role: string;
  content: string;
  messageType?: string;
};

export type RestoredLessonRuntimeState = {
  fullText: string;
  answeredCheckpoints: Map<number, RestoredCheckpointState>;
  currentInputRequest: LessonInputRequest | null;
  isLessonComplete: boolean;
  lastVerification: LessonVerification | null;
  revealedCount: number;
};

export function shouldMarkLessonComplete({
  hasCompletionSignal,
  currentInputRequest,
}: {
  hasCompletionSignal: boolean;
  currentInputRequest: LessonInputRequest | null;
}) {
  return hasCompletionSignal && currentInputRequest === null;
}

export function parseLessonSections(fullText: string): LessonSection[] {
  const sections: LessonSection[] = [];
  const inputRegex = /\[INPUT_REQUEST:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*(?:\|\s*([^\]]*?))?\s*\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inputRegex.exec(fullText)) !== null) {
    const content = fullText.slice(lastIndex, match.index).trim();
    sections.push({
      content,
      inputRequest: {
        type: match[1]!.trim(),
        question: match[2]!.trim(),
        expectedAnswer: match[3]?.trim() ?? "",
      },
    });
    lastIndex = match.index + match[0].length;
  }

  const remaining = fullText.slice(lastIndex).trim();
  if (remaining) {
    sections.push({ content: remaining });
  }

  return sections;
}

function getCheckpointIndices(sections: LessonSection[]) {
  return sections.flatMap((section, index) => (section.inputRequest ? [index] : []));
}

function buildCheckpointStates(sections: LessonSection[]): PersistedLessonCheckpointState[] {
  return getCheckpointIndices(sections).flatMap((sectionIndex) => {
    const question = sections[sectionIndex]?.inputRequest?.question;
    if (!question) return [];

    return [{
      sectionIndex,
      question,
      status: "pending",
    }] as PersistedLessonCheckpointState[];
  });
}

function parseLessonVerifierLogs(serialized?: string): LessonVerifierLog[] | null {
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) return null;

    return parsed.flatMap((entry) => {
      if (
        typeof entry === "object"
        && entry !== null
        && typeof (entry as LessonVerifierLog).question === "string"
        && typeof (entry as LessonVerifierLog).userAnswer === "string"
        && typeof (entry as LessonVerifierLog).isCorrect === "boolean"
        && typeof (entry as LessonVerifierLog).feedback === "string"
      ) {
        return [entry as LessonVerifierLog];
      }

      return [];
    });
  } catch {
    return null;
  }
}

function mergePersistedCheckpointStates(
  sections: LessonSection[],
  checkpointStates: PersistedLessonCheckpointState[],
) {
  const defaults = buildCheckpointStates(sections);
  if (checkpointStates.length === 0) return defaults;

  const mergedStates = new Map(
    defaults.map((checkpointState) => [checkpointState.sectionIndex, checkpointState]),
  );

  for (const checkpointState of checkpointStates) {
    const defaultState = mergedStates.get(checkpointState.sectionIndex);
    if (!defaultState) continue;

    mergedStates.set(checkpointState.sectionIndex, {
      ...defaultState,
      status: checkpointState.status,
      answer: checkpointState.answer,
      verification: checkpointState.verification,
    });
  }

  return defaults.map(
    (checkpointState) => mergedStates.get(checkpointState.sectionIndex) ?? checkpointState,
  );
}

function restoreFromVerifierLogs(
  sections: LessonSection[],
  verifierLogs?: string,
) {
  const checkpointStates = buildCheckpointStates(sections);
  const parsedVerifierLogs = parseLessonVerifierLogs(verifierLogs);
  if (!parsedVerifierLogs) return null;

  let checkpointPointer = 0;

  for (const log of parsedVerifierLogs) {
    const checkpointState = checkpointStates[checkpointPointer];
    if (!checkpointState) break;

    checkpointStates[checkpointPointer] = {
      ...checkpointState,
      status: log.isCorrect ? "answered" : "pending",
      answer: log.userAnswer,
      verification: {
        is_correct: log.isCorrect,
        feedback_block: log.feedback,
      },
    };

    if (log.isCorrect) {
      checkpointPointer += 1;
    }
  }

  return checkpointStates;
}

function restoreFromLegacyMessages(
  sections: LessonSection[],
  lessonMessages: LessonMessageSnapshot[],
) {
  const checkpointStates = buildCheckpointStates(sections);
  const verifications = lessonMessages.filter((message) => message.messageType === "verification");
  let verificationIndex = 0;

  while (verificationIndex < checkpointStates.length) {
    const verificationMessage = verifications[verificationIndex];
    if (!verificationMessage) break;

    const verificationMessageIndex = lessonMessages.indexOf(verificationMessage);
    const userMessage = verificationMessageIndex > 0
      ? lessonMessages
          .slice(0, verificationMessageIndex)
          .reverse()
          .find((message) => message.role === "user" && message.messageType !== "clarification")
      : undefined;

    checkpointStates[verificationIndex] = {
      ...checkpointStates[verificationIndex]!,
      status: "answered",
      answer: userMessage?.content,
    };
    verificationIndex += 1;
  }

  return checkpointStates;
}

export function restoreLessonProgress({
  sections,
  lessonMessages,
  verifierLogs,
  checkpointStates,
}: {
  sections: LessonSection[];
  lessonMessages: LessonMessageSnapshot[];
  verifierLogs?: string;
  checkpointStates?: PersistedLessonCheckpointState[];
}) {
  const restoredCheckpointStates = checkpointStates && checkpointStates.length > 0
    ? mergePersistedCheckpointStates(sections, checkpointStates)
    : restoreFromVerifierLogs(sections, verifierLogs)
      ?? restoreFromLegacyMessages(sections, lessonMessages);

  const answeredCheckpoints = new Map<number, RestoredCheckpointState>();
  for (const checkpointState of restoredCheckpointStates) {
    if (checkpointState.status === "pending") continue;

    const restoredState: RestoredCheckpointState = checkpointState.status === "skipped"
      ? { skipped: true }
      : {
          answer: checkpointState.answer,
          skipped: false,
          verification: checkpointState.verification,
        };

    answeredCheckpoints.set(checkpointState.sectionIndex, restoredState);
  }

  const pendingCheckpoint = restoredCheckpointStates.find(
    (checkpointState) => checkpointState.status === "pending",
  );

  return {
    checkpointStates: restoredCheckpointStates,
    answeredCheckpoints,
    currentInputRequest: pendingCheckpoint
      ? sections[pendingCheckpoint.sectionIndex]?.inputRequest ?? null
      : null,
    lastVerification: pendingCheckpoint?.verification ?? null,
    revealedCount: pendingCheckpoint ? pendingCheckpoint.sectionIndex + 1 : sections.length,
  };
}

export function restoreLessonRuntimeState({
  lessonMessages,
  verifierLogs,
  checkpointStates,
}: {
  lessonMessages: LessonMessageSnapshot[];
  verifierLogs?: string;
  checkpointStates?: PersistedLessonCheckpointState[];
}): RestoredLessonRuntimeState | null {
  const teacherMessages = lessonMessages.filter(
    (message) => message.role === "teacher" && message.messageType !== "clarification",
  );
  if (teacherMessages.length === 0) return null;

  const fullText = teacherMessages.map((message) => message.content).join("\n\n");
  const sections = parseLessonSections(fullText);
  const restoredProgress = restoreLessonProgress({
    sections,
    lessonMessages,
    verifierLogs,
    checkpointStates,
  });
  const hasCompletionSignal = teacherMessages[teacherMessages.length - 1]?.messageType === "lesson_complete"
    || fullText.includes("[LESSON_COMPLETE]");
  const lessonCompleted = shouldMarkLessonComplete({
    hasCompletionSignal,
    currentInputRequest: restoredProgress.currentInputRequest,
  });

  return {
    fullText,
    answeredCheckpoints: restoredProgress.answeredCheckpoints,
    currentInputRequest: lessonCompleted ? null : restoredProgress.currentInputRequest,
    isLessonComplete: lessonCompleted,
    lastVerification: lessonCompleted ? null : restoredProgress.lastVerification,
    revealedCount: lessonCompleted ? sections.length : restoredProgress.revealedCount,
  };
}
