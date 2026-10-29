import { getBoolean, setBoolean } from "@/store/storage";

// The "Add list exclusion" box on the *arr delete confirms (#472) starts
// unchecked and then remembers the last choice, the way Radarr's and Sonarr's
// own web UIs persist `deleteOptions` (their default is false). It is written
// on toggle, like upstream, so ticking it and then cancelling still sticks.
// Delete Files is not remembered: it is picked in the action sheet that opens
// the confirm.
//
// Kept per service kind, not per instance, matching upstream (one web UI, one
// remembered choice), and kept out of the exported config like the other
// `ui.*` keys: a local convenience, not a setting worth backing up. Plain
// functions over the sync storage cache, so there is nothing to hydrate.

export type DeleteExclusionKind = "radarr" | "sonarr" | "lidarr";

export function deleteExclusionKey(kind: DeleteExclusionKind): string {
  return `ui.deleteExclusion.${kind}`;
}

export function getDeleteExclusionPref(kind: DeleteExclusionKind): boolean {
  return getBoolean(deleteExclusionKey(kind));
}

export function setDeleteExclusionPref(
  kind: DeleteExclusionKind,
  value: boolean,
): void {
  setBoolean(deleteExclusionKey(kind), value);
}
