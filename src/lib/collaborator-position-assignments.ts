import { apiGet } from "@/src/lib/api-client";
import type { CollaboratorDetailPayload } from "@/src/types/collaborator";

export type CollaboratorPositionAssignmentState = {
  assignments: Array<{
    positionId: number;
    sectorId: number | null;
  }>;
  primaryPositionId: number | null;
};

export type CollaboratorAssignmentPayload = {
  positionIds: number[];
  primaryPositionId: number | null;
};

export async function fetchCollaboratorPositionAssignmentState(
  collaboratorId: number,
): Promise<CollaboratorPositionAssignmentState | null> {
  const result = await apiGet<CollaboratorDetailPayload>(
    `/collaborators/${collaboratorId}`,
  );

  if (result.error || !result.response.data?.collaborator) {
    return null;
  }

  const collaborator = result.response.data.collaborator;

  return {
    assignments: collaborator.positions.map((position) => ({
      positionId: Number(position.id),
      sectorId:
        position.sectorId === undefined || position.sectorId === null
          ? null
          : Number(position.sectorId),
    })),
    primaryPositionId: collaborator.primaryPositionId ?? null,
  };
}

export function buildNextCollaboratorAssignmentPayload(args: {
  state: CollaboratorPositionAssignmentState;
  targetPositionId: number;
  asPrimary: boolean;
}): CollaboratorAssignmentPayload {
  const { state, targetPositionId, asPrimary } = args;

  const withoutCurrentTarget = state.assignments.filter(
    (assignment) => assignment.positionId !== targetPositionId,
  );

  const nextPositionIds = Array.from(
    new Set([
      ...withoutCurrentTarget.map((assignment) => assignment.positionId),
      targetPositionId,
    ]),
  );

  const hasCurrentPrimary =
    state.primaryPositionId !== null &&
    nextPositionIds.includes(state.primaryPositionId);

  const nextPrimaryPositionId = asPrimary
    ? targetPositionId
    : (hasCurrentPrimary ? state.primaryPositionId : nextPositionIds[0] ?? null);

  return {
    positionIds: nextPositionIds,
    primaryPositionId: nextPrimaryPositionId,
  };
}

export function buildCollaboratorUnassignmentPayload(args: {
  state: CollaboratorPositionAssignmentState;
  positionIdToRemove: number;
}): CollaboratorAssignmentPayload {
  const { state, positionIdToRemove } = args;

  const nextPositionIds = state.assignments
    .map((assignment) => assignment.positionId)
    .filter((positionId) => positionId !== positionIdToRemove);

  const hasCurrentPrimary =
    state.primaryPositionId !== null &&
    nextPositionIds.includes(state.primaryPositionId);

  return {
    positionIds: nextPositionIds,
    primaryPositionId: hasCurrentPrimary
      ? state.primaryPositionId
      : nextPositionIds[0] ?? null,
  };
}
