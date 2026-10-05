import { useEffect } from "react";
import { audioManager } from "@/lib/audio-manager";
import { isUISound, type UISound } from "@/lib/ui-sound-catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// One bridge covers native controls and shared primitives. Async confirmations
// are emitted explicitly where the action actually succeeds.
export function UIAudio({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`ui-audio-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_events",
          filter: `user_id=eq.${userId}`,
        },
        ({ new: notification }) => {
          if (notification["actor_id"] === userId || notification["is_read"]) return;
          // Only new realtime inserts; loading history and read-count changes are silent.
          audioManager.play(
            notification["type"] === "proposal_received" || notification["type"] === "proposal"
              ? "messageReceived"
              : "notification",
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    audioManager.initialize();
    let lastGesture = -Infinity;
    const gesture = (event: Event) => {
      if (event.isTrusted) lastGesture = performance.now();
    };
    const click = (event: MouseEvent) => {
      if (
        !event.isTrusted ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>(
        "button, a[href], [role=tab], [role=switch], [role=menuitem]",
      );
      if (
        !control ||
        control.matches(":disabled, [aria-disabled=true], [data-disabled]") ||
        control.closest('[data-ui-sound="none"]')
      )
        return;
      const explicit = control.dataset["uiSound"];
      let sound: UISound = "click";
      let direction: -1 | 1 = 1;
      if (explicit && isUISound(explicit)) sound = explicit;
      else if (control.matches("[aria-haspopup], [aria-controls][aria-expanded]")) {
        if (control.getAttribute("aria-haspopup") === "dialog") return;
        sound = "menu";
      } else if (control.matches("[role=switch], [aria-pressed]")) {
        sound =
          control.getAttribute("aria-checked") === "true" ||
          control.getAttribute("aria-pressed") === "true"
            ? "toggleOff"
            : "toggleOn";
      } else if (
        control.matches(
          "[role=tab], .feed-tabs button, .workspace-tabs button, .settings-nav button, .workspace-filters button",
        )
      ) {
        if (control.matches(".active, [aria-selected=true]")) return;
        const siblings = [...(control.parentElement?.children ?? [])];
        const active = siblings.findIndex((element) =>
          element.matches(".active, [aria-selected=true]"),
        );
        direction = siblings.indexOf(control) < active ? -1 : 1;
        sound = "navigation";
      } else if (control instanceof HTMLAnchorElement) {
        if (
          control.target === "_blank" ||
          control.hasAttribute("download") ||
          control.origin !== location.origin
        )
          return;
        if (
          control.pathname === location.pathname &&
          control.search === location.search &&
          !control.hash
        )
          return;
        sound = "navigation";
      } else if (
        control.matches(
          ".publish-button, .workspace-primary-action, .feed-work-proposal, .post-edit-save, [data-ui-primary]",
        )
      ) {
        sound = "primary";
      }
      // Capture old selection before React commits; honor cancelled native actions.
      queueMicrotask(() => {
        if (event.defaultPrevented && !(control instanceof HTMLAnchorElement)) return;
        if (sound === "click" || sound === "primary") {
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (!reduced && control.isConnected && control.animate) {
            control.animate(
              [
                { scale: "1", easing: "ease-out" },
                { scale: "0.985", offset: 0.27, easing: "ease-out" },
                { scale: "1" },
              ],
              { duration: 120, easing: "linear" },
            );
          }
          audioManager.play(sound, { delayMs: reduced ? 0 : 32 });
        } else audioManager.play(sound, { direction });
      });
    };
    const change = (event: Event) => {
      if (!event.isTrusted) return;
      const input = event.target;
      if (
        input instanceof HTMLInputElement &&
        input.type === "checkbox" &&
        !input.disabled &&
        !input.closest('[data-ui-sound="none"]')
      )
        audioManager.play(input.checked ? "toggleOn" : "toggleOff");
    };
    const animation = (event: AnimationEvent) => {
      if (performance.now() - lastGesture > 1200) return;
      const element = event.target;
      if (!(element instanceof HTMLElement)) return;
      const surface = element.dataset["uiAudioSurface"];
      if (!surface) return;
      const opening = element.dataset["state"] === "open";
      audioManager.play(surface === "modal" ? (opening ? "modalOpen" : "modalClose") : "menu");
    };
    document.addEventListener("pointerdown", gesture, true);
    document.addEventListener("keydown", gesture, true);
    document.addEventListener("click", click, true);
    document.addEventListener("change", change, true);
    document.addEventListener("animationstart", animation);
    return () => {
      document.removeEventListener("pointerdown", gesture, true);
      document.removeEventListener("keydown", gesture, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("change", change, true);
      document.removeEventListener("animationstart", animation);
      audioManager.dispose();
    };
  }, []);
  return null;
}
