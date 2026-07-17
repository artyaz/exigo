import type {
  LessonVerification,
  RestoredCheckpointState as CheckpointState,
} from "~/lib/lessonCheckpoints";

export function serializeCheckpointMap(checkpoints: Map<number, CheckpointState>) {
  return JSON.stringify(
    Array.from(checkpoints.entries()).sort(([left], [right]) => left - right),
  );
}

export function serializeVerification(verification: LessonVerification | null) {
  return verification ? JSON.stringify(verification) : "";
}
