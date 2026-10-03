"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRecheckOnFocus } from "@/hooks/use-recheck-on-focus";
import { causeMessage } from "@/lib/error-message";
import { NOTIFY_EVENTS, type NotifyEvent } from "@/lib/studio/attention";
import {
  openNotificationSettings,
  type Permission,
  readPermission,
  requestPermission,
} from "@/lib/studio/notifications";
import { currentPlatform } from "@/lib/studio/platform";
import {
  type StudioSettings,
  saveNotifications,
  saveNotifyEvent,
} from "@/lib/studio/settings";

export type PermissionReading = Permission | "unavailable" | "unknown";

export interface NotificationConsent {
  readonly events: Readonly<Record<NotifyEvent, boolean>>;
  readonly grant: () => void;
  readonly isEnabled: boolean;
  readonly isEventEnabled: (event: NotifyEvent) => boolean;
  readonly isOn: boolean;
  readonly permission: PermissionReading;
  readonly setEvent: (event: NotifyEvent, enabled: boolean) => void;
  readonly toggle: (enabled: boolean) => void;
  readonly trouble: string | null;
}

type EventChoices = Partial<Record<NotifyEvent, boolean>>;

export function useNotificationConsent(
  settings: StudioSettings | null
): NotificationConsent {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [chosenEvents, setChosenEvents] = useState<EventChoices>({});
  const [permission, setPermission] = useState<PermissionReading>("unknown");
  const [trouble, setTrouble] = useState<string | null>(null);

  const isEnabled = chosen ?? settings?.notifications ?? false;

  const probe = useCallback(() => {
    Effect.runPromiseExit(readPermission).then((exit) => {
      setPermission(Exit.isSuccess(exit) ? exit.value : "unavailable");
    });
  }, []);

  useEffect(probe, [probe]);
  useRecheckOnFocus(permission !== "unavailable", probe);

  const openSystemSettings = useCallback(() => {
    Effect.runPromiseExit(openNotificationSettings).then((exit) => {
      setTrouble(Exit.isFailure(exit) ? causeMessage(exit.cause) : null);
    });
  }, []);

  // macOS keeps a refusal and only System Settings can undo it. A Linux
  // desktop's notification service has no per-app settings row to open, so
  // a refusal there can only be asked about again.
  const grant = useCallback(() => {
    const isMac = currentPlatform() === "mac";
    if (isMac && permission === "denied") {
      openSystemSettings();
      return;
    }
    Effect.runPromiseExit(requestPermission).then((exit) => {
      if (Exit.isFailure(exit)) {
        setPermission("unavailable");
        return;
      }
      setPermission(exit.value);
      if (isMac && exit.value === "denied") {
        openSystemSettings();
      }
    });
  }, [openSystemSettings, permission]);

  const toggle = useCallback(
    (enabled: boolean) => {
      setChosen(enabled);
      Effect.runFork(saveNotifications(enabled));
      if (enabled && permission !== "granted" && permission !== "unavailable") {
        grant();
      }
    },
    [grant, permission]
  );

  const setEvent = useCallback((event: NotifyEvent, enabled: boolean) => {
    setChosenEvents((current) => ({ ...current, [event]: enabled }));
    Effect.runFork(saveNotifyEvent(event, enabled));
  }, []);

  const events = useMemo(() => {
    const merged = {} as Record<NotifyEvent, boolean>;
    for (const event of NOTIFY_EVENTS) {
      merged[event] =
        chosenEvents[event] ?? settings?.notifyEvents[event] ?? true;
    }
    return merged;
  }, [chosenEvents, settings?.notifyEvents]);

  const isEventEnabled = useCallback(
    (event: NotifyEvent) => events[event],
    [events]
  );

  return useMemo(
    () => ({
      events,
      grant,
      isEnabled,
      isEventEnabled,
      isOn: isEnabled && permission === "granted",
      permission,
      setEvent,
      toggle,
      trouble,
    }),
    [
      events,
      grant,
      isEnabled,
      isEventEnabled,
      permission,
      setEvent,
      toggle,
      trouble,
    ]
  );
}
