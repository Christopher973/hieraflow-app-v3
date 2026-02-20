"use client";

export type AdminEntityName =
  | "locations"
  | "departments"
  | "sectors"
  | "positions"
  | "collaborators";

export const ADMIN_DATA_REFRESH_EVENT = "admin:data:refresh";

export function emitAdminDataRefresh(entity: AdminEntityName) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ entity: AdminEntityName }>(ADMIN_DATA_REFRESH_EVENT, {
      detail: { entity },
    }),
  );
}

export function isAdminEntityRefreshEvent(
  event: Event,
  entity: AdminEntityName,
): event is CustomEvent<{ entity: AdminEntityName }> {
  if (!(event instanceof CustomEvent)) {
    return false;
  }

  return event.detail?.entity === entity;
}
