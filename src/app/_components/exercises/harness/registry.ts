/* Harness registry — codeProbe resolves a HarnessRef.id against this. */
import type { Harness } from "./types";
import { jsHarness } from "./jsHarness";
import { jsObservationHarness } from "./jsObservationHarness";
import { rustOwnershipMove } from "./rustOwnership";

export const HARNESSES: Record<string, Harness> = {
  [jsHarness.id]: jsHarness,
  [jsObservationHarness.id]: jsObservationHarness,
  [rustOwnershipMove.id]: rustOwnershipMove,
};

export function getHarness(id: string): Harness | undefined {
  return HARNESSES[id];
}
