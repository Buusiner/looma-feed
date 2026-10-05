import { useEffect, useRef, useState } from "react";
import { audioManager } from "@/lib/audio-manager";

// Some branded dialogs override Radix's exit animation and immediately unmount.
// Observe accepted open state as well, so Escape/outside-click closure still has
// its short reverse cue. The manager's cooldown coalesces the CSS animation cue.
export function useUIOverlaySound({
  open,
  defaultOpen = false,
  onOpenChange,
}: {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const visible = open ?? internalOpen;
  const previous = useRef(visible);
  useEffect(() => {
    if (previous.current && !visible) audioManager.play("modalClose");
    previous.current = visible;
  }, [visible]);
  return {
    open: visible,
    onOpenChange: (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
  };
}
