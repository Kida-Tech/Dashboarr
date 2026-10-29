import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Square, SquareCheck, Trash2 } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { ConfirmModal } from "@/components/common/confirm-modal";
import { lightHaptic } from "@/lib/haptics";
import {
  getDeleteExclusionPref,
  setDeleteExclusionPref,
  type DeleteExclusionKind,
} from "@/store/delete-options-store";

const ITEM_NOUN: Record<DeleteExclusionKind, string> = {
  radarr: "movie",
  sonarr: "show",
  lidarr: "artist",
};

/** What the user picked in the confirm, on top of the sheet's Delete Files. */
export interface ArrDeleteChoice {
  addExclusion: boolean;
}

interface ArrDeleteConfirmProps {
  visible: boolean;
  kind: DeleteExclusionKind;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: (choice: ArrDeleteChoice) => void;
  onCancel: () => void;
  /** Forwarded to ConfirmModal, so `flow.bind(...)` keeps working. */
  onClosed?: () => void;
}

/**
 * The danger confirm behind every Radarr / Sonarr / Lidarr library delete,
 * with the "Add list exclusion" box from the *arr web UI's own delete dialog
 * (#472). Ticking it stops import lists from adding the item back.
 *
 * It is a ConfirmModal underneath, so it is still a valid useModalFlow step:
 * spread `flow.bind(...)` onto it exactly like a ConfirmModal. The box adds no
 * modal of its own, so the flow's sequencing is unchanged.
 */
export function ArrDeleteConfirm({
  visible,
  kind,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  onClosed,
}: ArrDeleteConfirmProps) {
  const [addExclusion, setAddExclusion] = useState(() =>
    getDeleteExclusionPref(kind),
  );

  // Re-read on every open: another delete surface for the same service may
  // have changed the remembered choice since this one was mounted.
  useEffect(() => {
    if (visible) setAddExclusion(getDeleteExclusionPref(kind));
  }, [visible, kind]);

  const toggleExclusion = () => {
    lightHaptic();
    const next = !addExclusion;
    setAddExclusion(next);
    setDeleteExclusionPref(kind, next);
  };

  return (
    <ConfirmModal
      visible={visible}
      title={title}
      message={
        <View className="gap-3">
          <Text className="text-zinc-400 text-sm leading-5">{message}</Text>
          <Pressable
            onPress={toggleExclusion}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: addExclusion }}
            className={`flex-row items-center gap-3 px-3 py-3 rounded-xl border active:opacity-80 ${
              addExclusion
                ? "bg-primary/10 border-primary/40"
                : "bg-surface-light border-border"
            }`}
          >
            <Icon
              icon={addExclusion ? SquareCheck : Square}
              size={20}
              color={addExclusion ? "#3b82f6" : "#71717a"}
            />
            <View className="flex-1">
              <Text className="text-zinc-100 text-sm font-medium">
                Add list exclusion
              </Text>
              <Text className="text-zinc-500 text-xs mt-0.5">
                Prevent import lists from adding this {ITEM_NOUN[kind]} again
              </Text>
            </View>
          </Pressable>
        </View>
      }
      icon={Trash2}
      tone="danger"
      confirmLabel={confirmLabel}
      onConfirm={() => onConfirm({ addExclusion })}
      onCancel={onCancel}
      onClosed={onClosed}
    />
  );
}
