import {
  requestPermission as askPermission,
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";

export class NotificationError extends Data.TaggedError("NotificationError")<{
  message: string;
}> {}

export type Permission = "default" | "denied" | "granted";

export const NOTIFICATION_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.Notifications-Settings.extension";

const fail = (cause: unknown) =>
  new NotificationError({ message: errorMessage(cause) });

export const isGranted: Effect.Effect<boolean, NotificationError> =
  Effect.tryPromise({ catch: fail, try: () => isPermissionGranted() });

// The shim knows a refusal it has seen; the core only answers whether it is
// granted, so while the shim still says "default" that answer decides.
export const readPermission: Effect.Effect<Permission, NotificationError> =
  Effect.try({
    catch: fail,
    try: (): Permission => {
      const { permission } = (
        window as unknown as { Notification: { permission: Permission } }
      ).Notification;
      return permission;
    },
  }).pipe(
    Effect.flatMap((permission) =>
      permission === "default"
        ? isGranted.pipe(
            Effect.map(
              (granted): Permission => (granted ? "granted" : "default")
            )
          )
        : Effect.succeed(permission)
    )
  );

export const requestPermission: Effect.Effect<Permission, NotificationError> =
  Effect.tryPromise({ catch: fail, try: () => askPermission() });

export function post(
  title: string,
  body: string
): Effect.Effect<void, NotificationError> {
  return Effect.try({
    catch: fail,
    try: () => sendNotification({ body, title }),
  });
}

export const openNotificationSettings: Effect.Effect<void, NotificationError> =
  Effect.tryPromise({
    catch: fail,
    try: () => openUrl(NOTIFICATION_SETTINGS_URL),
  });
