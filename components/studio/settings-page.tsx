"use client";

import {
  ArrowLeftIcon,
  BellIcon,
  CheckIcon,
  CircleArrowUpIcon,
  CopyIcon,
  KeyboardIcon,
  LightbulbIcon,
  MailIcon,
  MessageSquareIcon,
  PlugZapIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SlidersHorizontalIcon,
  SunMoonIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { Fragment, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCopyCommand } from "@/hooks/use-copy-command";
import type {
  NotificationConsent,
  PermissionReading,
} from "@/hooks/use-notification-consent";
import { useIsMac } from "@/hooks/use-platform";
import { usePresence } from "@/hooks/use-presence";
import { useScrolledIntoView } from "@/hooks/use-scrolled-into-view";
import {
  isSettingsSection,
  type SettingsSection,
} from "@/hooks/use-settings-view";
import {
  isThemeChoice,
  type ThemeChoice,
  useThemeChoice,
} from "@/hooks/use-theme-choice";
import type { NotifyEvent } from "@/lib/studio/attention";
import {
  formatShortcut,
  HOTKEY_GROUPS,
  SHORTCUT_TITLES,
  SHORTCUTS,
  shortcutKeys,
} from "@/lib/studio/command-registry";
import type { ShellMood } from "@/lib/studio/mood";
import { modKeyLabel } from "@/lib/studio/platform";
import { shortDay } from "@/lib/studio/time";
import { downloadedLabel, downloadedShare } from "@/lib/studio/updates";
import { cn } from "@/lib/utils";
import type {
  AppEnvironment,
  EnvironmentCheck,
  EnvironmentState,
} from "@/shared/ipc";
import {
  AGENT_PROVIDERS,
  type AgentProvider,
  PROVIDER_INFO,
} from "@/shared/providers";
import { CHECK_ICONS } from "./environment-checklist";
import { IntegrationsSection } from "./integrations-section";
import { ProjectSettingsSection } from "./project-settings-section";
import { ProviderIcon } from "./provider-icon";
import { ProviderSteps } from "./provider-steps";
import { SettingsPanel as Group } from "./settings-group";
import { useStudio } from "./studio-provider";
import { MoodField } from "./titlebar";
import { updateSummary } from "./update-status";

type SectionId = SettingsSection;

const SECTIONS: readonly {
  description: string;
  icon: typeof SunMoonIcon;
  id: SectionId;
  label: string;
}[] = [
  {
    description: "Name, location and brand for this project",
    icon: SlidersHorizontalIcon,
    id: "project",
    label: "Project",
  },
  {
    description: "How the studio looks",
    icon: SunMoonIcon,
    id: "appearance",
    label: "Appearance",
  },
  {
    description: "What the studio does on its own",
    icon: SlidersHorizontalIcon,
    id: "behavior",
    label: "Behavior",
  },
  {
    description: "How the studio calls you back when it is not in front",
    icon: BellIcon,
    id: "notifications",
    label: "Notifications",
  },
  {
    description: "Every keyboard shortcut, in one place",
    icon: KeyboardIcon,
    id: "hotkeys",
    label: "Hotkeys",
  },
  {
    description: "Services and AI accounts the studio can reach",
    icon: PlugZapIcon,
    id: "integrations",
    label: "Integrations",
  },
  {
    description: "Keep the studio current",
    icon: CircleArrowUpIcon,
    id: "updates",
    label: "Updates",
  },
  {
    description: "Tell us what broke, or what is missing",
    icon: MessageSquareIcon,
    id: "feedback",
    label: "Feedback",
  },
];

// Settings takes the window: a rail on the left, one readable column on the
// right, and nothing floating. The shell stays mounted underneath — inert, so
// keys and clicks cannot reach it — which is what keeps the preview's iframe
// and a running turn exactly where they were when the page closes. It only
// crossfades, briefly and without moving: this should feel like switching a
// tab, not opening a window.
export function SettingsPage() {
  const { settingsView } = useStudio();
  const { section, setSection } = settingsView;
  const presence = usePresence(settingsView.isOpen ? true : null);

  const onPickSection = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isSettingsSection(picked)) {
        setSection(picked);
      }
    },
    [setSection]
  );

  if (presence.shown === null) {
    return null;
  }

  const active = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];

  return (
    <section
      aria-label="Settings"
      className="fixed inset-0 z-40 flex animate-fade-in bg-background text-foreground transition-opacity duration-fast ease-out [animation-duration:var(--transition-duration-fast)] data-leaving:pointer-events-none data-leaving:opacity-0"
      data-leaving={presence.isLeaving ? "" : undefined}
      inert={presence.isLeaving || undefined}
    >
      <SectionRail
        active={section}
        onBack={settingsView.close}
        onPick={onPickSection}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="h-(--titlebar-block-inset) shrink-0"
          data-tauri-drag-region
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-2 pb-12 sm:px-10">
            <header className="flex flex-col gap-1 px-4">
              <h2 className="font-heading font-medium text-xl tracking-tight">
                {active.label}
              </h2>
              <p className="text-muted-foreground text-sm">
                {active.description}
              </p>
            </header>

            <div className="flex flex-col gap-10">
              {settingsView.blocked ? (
                <p className="text-destructive text-sm" role="alert">
                  Save or cancel your project changes before leaving.
                </p>
              ) : null}
              {section === "project" ? (
                <ProjectSettingsSection
                  key={settingsView.projectId ?? "none"}
                />
              ) : null}
              {section === "appearance" ? <AppearanceSection /> : null}
              {section === "behavior" ? <BehaviorSection /> : null}
              {section === "notifications" ? <NotificationsSection /> : null}
              {section === "hotkeys" ? <HotkeysSection /> : null}
              {section === "integrations" ? (
                <>
                  <IntegrationsSection />
                  <AccountsSection />
                </>
              ) : null}
              {section === "updates" ? <UpdatesSection /> : null}
              {section === "feedback" ? <FeedbackSection /> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// The rail follows the pane's menus: no weight change between states, a
// muted background for the open section, icons leading. The Updates row
// carries a dot while a release is waiting, so the dialog never hides it.
function SectionRail({
  active,
  onBack,
  onPick,
}: {
  active: SectionId;
  onBack: () => void;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { updates } = useStudio();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-sidebar p-3 pt-(--titlebar-block-inset)">
      {/* The arrow and the word are one control: the whole row goes back,
          and the word is what the row is named by. */}
      <div className="mb-3" data-tauri-drag-region>
        <Button
          aria-label="Back"
          className="w-full justify-start text-foreground"
          onClick={onBack}
          size="sm"
          variant="ghost"
        >
          <ArrowLeftIcon
            className="text-muted-foreground"
            data-icon="inline-start"
          />
          <span className="font-heading font-medium text-sm">Settings</span>
        </Button>
        <h1 className="sr-only">Settings</h1>
      </div>

      <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
        {SECTIONS.map((entry) => (
          <button
            aria-current={active === entry.id ? "true" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-accent",
              active === entry.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            key={entry.id}
            onClick={onPick}
            type="button"
            value={entry.id}
          >
            <entry.icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.id === "updates" && updates.release !== null ? (
              <span
                aria-label="An update is available"
                className="size-1.5 shrink-0 rounded-full bg-primary"
                role="status"
              />
            ) : null}
          </button>
        ))}
      </nav>

      <p className="mt-auto flex items-center gap-1.5 whitespace-nowrap px-2 text-muted-foreground text-xs">
        <KbdGroup>
          <Kbd>{modKeyLabel()}</Kbd>
          <Kbd>,</Kbd>
        </KbdGroup>
        opens Settings
      </p>
    </aside>
  );
}

const THEME_TILES: readonly {
  caption: string;
  id: ThemeChoice;
  label: string;
  swatch: string;
  bar: string;
  chip: string;
}[] = [
  {
    bar: "bg-white/25",
    caption: "The studio’s native palette",
    chip: "bg-white/10",
    id: "dark",
    label: "Dark",
    swatch: "bg-[#141318]",
  },
  {
    bar: "bg-black/40",
    caption: "Bright surfaces, dark text",
    chip: "bg-black/10",
    id: "light",
    label: "Light",
    swatch: "bg-white",
  },
  {
    bar: "bg-white/25",
    caption: "Follows macOS",
    chip: "bg-black/25",
    id: "system",
    label: "System",
    swatch: "bg-linear-to-br from-[#141318] from-50% to-white to-50%",
  },
];

function themeCaption(choice: ThemeChoice | null, isMac: boolean) {
  if (choice === "system" && !isMac) {
    return "Follows the system";
  }

  return THEME_TILES.find((tile) => tile.id === choice)?.caption;
}

// A setting: its name and a sentence on the leading side, the control on the
// trailing side, top-aligned so a description that wraps never moves the
// switch. `htmlFor` makes the name the control's label.
function Row({
  children,
  description,
  htmlFor,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  htmlFor?: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        {htmlFor === undefined ? (
          <span className="text-sm">{title}</span>
        ) : (
          <Label className="font-normal text-sm" htmlFor={htmlFor}>
            {title}
          </Label>
        )}
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function HotkeysSection() {
  return (
    <>
      {HOTKEY_GROUPS.map((group) => (
        <Group key={group.title} title={group.title}>
          <div className="flex flex-col divide-y divide-border/60">
            {group.ids.map((id) => (
              <div
                className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0"
                key={id}
              >
                <span className="text-sm">{SHORTCUT_TITLES[id]}</span>
                <KbdGroup aria-label={formatShortcut(SHORTCUTS[id])}>
                  {shortcutKeys(SHORTCUTS[id]).map((key) => (
                    <Kbd aria-hidden="true" key={key}>
                      {key}
                    </Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))}
          </div>
        </Group>
      ))}
    </>
  );
}

function AppearanceSection() {
  return (
    <>
      <ThemeGroup />
      <TitlebarGroup />
    </>
  );
}

function ThemeGroup() {
  const { choice, select } = useThemeChoice();
  const isMac = useIsMac();

  const onPickTheme = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isThemeChoice(picked)) {
        select(picked);
      }
    },
    [select]
  );

  return (
    <Group
      description={
        themeCaption(choice, isMac) ??
        "Dark is the default until a choice is made"
      }
      title="Theme"
    >
      <div className="flex gap-3">
        {THEME_TILES.map((tile) => (
          <button
            aria-pressed={choice === tile.id}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-2 rounded-md outline-none active:translate-y-px"
            key={tile.id}
            onClick={onPickTheme}
            type="button"
            value={tile.id}
          >
            <span
              className={cn(
                "flex h-24 flex-col justify-between rounded-md p-2 ring-1 ring-foreground/10 ring-inset transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring",
                tile.swatch,
                choice === tile.id && "ring-2 ring-primary"
              )}
            >
              <span className={cn("h-1.5 w-1/2 rounded-full", tile.bar)} />
              <span
                className={cn("h-4 w-2/3 self-end rounded-sm", tile.chip)}
              />
            </span>
            <span
              className={cn(
                "text-xs",
                choice === tile.id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tile.label}
            </span>
          </button>
        ))}
      </div>
    </Group>
  );
}

const SAMPLE_MOOD: ShellMood = { isBusy: false, tone: "idle" };

// The band under the traffic lights, with the shader the shell breathes
// through: on by default, and both halves are a person's to turn off. The
// sample is the same field the shell draws, so the switches show their
// effect where the person is looking rather than behind the page.
function TitlebarGroup() {
  const { preferences } = useStudio();
  const isMac = useIsMac();

  return (
    <Group
      description="The band at the top of the window carries a shader that shifts with what the studio is doing: calm while idle, faster while a turn runs, another hue while something waits on you or has failed."
      title="Title bar"
    >
      <div
        aria-hidden="true"
        className="relative h-24 overflow-hidden rounded-md bg-sidebar ring-1 ring-foreground/10 ring-inset"
      >
        {preferences.titlebarShader ? (
          <MoodField
            isBooting={false}
            isStill={!preferences.titlebarMotion}
            mood={SAMPLE_MOOD}
          />
        ) : null}
      </div>

      <div className="flex flex-col divide-y divide-border/60">
        <Row
          description="Off leaves the band plain, in the sidebar’s own colour"
          htmlFor="settings-titlebar-shader"
          title="Show the shader"
        >
          <Switch
            checked={preferences.titlebarShader}
            id="settings-titlebar-shader"
            onCheckedChange={preferences.setTitlebarShader}
          />
        </Row>

        <Row
          description={`Off holds one frame of the field; the hue still follows the mood. Also off whenever ${isMac ? "macOS" : "the system"} asks to reduce motion.`}
          htmlFor="settings-titlebar-motion"
          title="Animate it"
        >
          <Switch
            checked={preferences.titlebarMotion}
            disabled={!preferences.titlebarShader}
            id="settings-titlebar-motion"
            onCheckedChange={preferences.setTitlebarMotion}
          />
        </Row>
      </div>
    </Group>
  );
}

function BehaviorSection() {
  const { preferences, onboarding, updates } = useStudio();
  const isMac = useIsMac();

  return (
    <>
      <Group
        description="What the studio offers on its own, without being asked"
        title="Suggestions"
      >
        <div className="flex flex-col divide-y divide-border/60">
          <Row
            description="When a turn ends, offer to save the pictures and clips it carried into the asset library"
            htmlFor="settings-asset-offers"
            title="Library suggestions"
          >
            <Switch
              checked={preferences.assetOffers}
              id="settings-asset-offers"
              onCheckedChange={preferences.setAssetOffers}
            />
          </Row>

          <Row
            description="Short video walkthroughs of Inspect, Snapshot, assets, components, brand and export"
            title="Explore Studio"
          >
            <Button onClick={onboarding.open} size="sm" variant="outline">
              <LightbulbIcon data-icon="inline-start" />
              Explore Studio
            </Button>
          </Row>
        </div>
      </Group>

      <Group
        description={`Nothing leaves ${isMac ? "this Mac" : "this computer"} unless a switch here says so`}
        title="Privacy"
      >
        <CrashReportsRow
          environment={updates.environment}
          onChange={preferences.setCrashReports}
          value={preferences.crashReports}
        />
      </Group>
    </>
  );
}

const EVENT_ROWS: readonly {
  description: string;
  event: NotifyEvent;
  title: string;
}[] = [
  {
    description: "The agent has finished a turn in a chat",
    event: "turnEnded",
    title: "A turn finished",
  },
  {
    description:
      "A permission card or a question about a source is waiting on you",
    event: "waiting",
    title: "The agent is waiting for your answer",
  },
  {
    description: "A render wrote its file, or could not",
    event: "export",
    title: "An export finished or failed",
  },
  {
    description: "The studio's helper stopped and could not be brought back",
    event: "sidecar",
    title: "The studio's helper stopped",
  },
];

function NotificationsSection() {
  const { notifications } = useStudio();
  const { permission } = notifications;
  const isMac = useIsMac();
  const isUnavailable = permission === "unavailable";
  const needsPermission = permission === "default" || permission === "denied";

  return (
    <>
      <Group
        description="Only while another app is in front; the pane and the chat list already show everything while the studio is"
        title="Notifications"
      >
        <div className="flex flex-col gap-2">
          <Row
            description={
              isMac
                ? "Turn every notification on or off. macOS asks once, the first time this goes on."
                : "Turn every notification on or off. They are shown by your desktop's notification service."
            }
            htmlFor="settings-notifications"
            title="Notify me"
          >
            <Switch
              checked={notifications.isEnabled}
              disabled={isUnavailable}
              id="settings-notifications"
              onCheckedChange={notifications.toggle}
            />
          </Row>

          {isUnavailable ? (
            <p className="text-muted-foreground text-xs leading-snug">
              Notifications need the desktop app.
            </p>
          ) : null}

          {needsPermission ? (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <p className="text-muted-foreground text-xs leading-snug">
                {notificationPermissionText(isMac, permission)}
              </p>
              <Button onClick={notifications.grant} size="sm" variant="outline">
                Grant permission
              </Button>
            </div>
          ) : null}

          {notifications.trouble === null ? null : (
            <p className="text-destructive text-xs leading-snug">
              {notifications.trouble}
            </p>
          )}
        </div>
      </Group>

      <Group
        description="Which moments are worth a notification"
        title="Events"
      >
        <div className="flex flex-col divide-y divide-border/60">
          {EVENT_ROWS.map((row) => (
            <EventRow
              consent={notifications}
              description={row.description}
              event={row.event}
              key={row.event}
              title={row.title}
            />
          ))}
        </div>
      </Group>
    </>
  );
}

function notificationPermissionText(
  isMac: boolean,
  permission: PermissionReading
): string {
  if (!isMac) {
    return "Your desktop has not allowed the studio to notify. Nothing will arrive until notifications are allowed for it in your desktop's own settings.";
  }

  return permission === "denied"
    ? "Notifications are off for the studio in System Settings. Nothing will arrive until they are turned on there."
    : "macOS has not allowed the studio to notify yet. Nothing will arrive until it has.";
}
function EventRow({
  consent,
  description,
  event,
  title,
}: {
  consent: NotificationConsent;
  description: string;
  event: NotifyEvent;
  title: string;
}) {
  const id = `settings-notify-${event}`;
  const onChange = useCallback(
    (enabled: boolean) => consent.setEvent(event, enabled),
    [consent, event]
  );

  return (
    <Row description={description} htmlFor={id} title={title}>
      <Switch
        checked={consent.isEnabled && consent.events[event]}
        disabled={!consent.isEnabled}
        id={id}
        onCheckedChange={onChange}
      />
    </Row>
  );
}

// Off until it is switched on, and the wording has to earn the switch rather
// than reassure past it: what is sent, what is never sent, and — where the
// studio can already say so — that this particular build would send nothing
// whatever the switch says.
function CrashReportsRow({
  environment,
  onChange,
  value,
}: {
  environment: AppEnvironment | null;
  onChange: (enabled: boolean) => void;
  value: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Row
        description="When the studio, its agent process or its preview crashes, send the error and where in the code it happened. Off unless you turn it on."
        htmlFor="settings-crash-reports"
        title="Send crash reports"
      >
        <Switch
          checked={value}
          id="settings-crash-reports"
          onCheckedChange={onChange}
        />
      </Row>

      <p className="text-muted-foreground text-xs leading-snug">
        Your prompts, your conversations with the agent and the contents of your
        project files are never included, and paths are stripped of your home
        folder before anything is sent.
      </p>

      {environment === "development" ? (
        <p className="text-muted-foreground text-xs leading-snug">
          This is a development build — it reports nothing either way.
        </p>
      ) : null}
    </div>
  );
}

// One card, read top to bottom: what the button does, the button on the
// same line, and under a rule the four facts the email is filled with —
// so "what leaves the app" is answered where the sending happens, not in a
// second group the eye has to connect back.
function FeedbackSection() {
  const { feedback, provider, updates } = useStudio();
  const isMac = useIsMac();

  return (
    <Group
      description="Feedback is an email you write and send yourself; nothing leaves the app on its own"
      title="Email"
    >
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="min-w-0 flex-1 basis-48 text-muted-foreground text-xs leading-relaxed">
            Opens your mail client with the facts below already filled in. A
            screenshot says more than a paragraph, so attach one by hand before
            sending.
          </p>
          <Button
            className="shrink-0"
            onClick={feedback.send}
            size="sm"
            variant="outline"
          >
            <MailIcon data-icon="inline-start" />
            Email feedback
          </Button>
        </div>

        <div className="border-border border-t pt-3">
          <Facts
            rows={[
              ["Studio", updates.version ?? "—"],
              [
                "Build",
                updates.environment === null
                  ? "—"
                  : ENVIRONMENTS[updates.environment],
              ],
              [isMac ? "macOS" : "System", updates.os ?? "—"],
              ["Agent", PROVIDER_INFO[provider].name],
            ]}
          />
        </div>

        {feedback.error === null ? null : (
          <p className="break-words text-destructive text-xs" role="alert">
            {feedback.error}
          </p>
        )}
      </div>
    </Group>
  );
}

// Two columns of facts: the name in the leading column, the value in mono
// beside it, every row on the same two edges.
function Facts({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-xs">
      {rows.map(([name, value]) => (
        <Fragment key={name}>
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="font-mono tabular-nums">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

const ENVIRONMENTS: Record<AppEnvironment, string> = {
  development: "Development",
  production: "Production",
};

// The popover in the sidebar keeps `UpdatesBody`, sized for a popover. The
// page reads top to bottom as one card: the version, its build and the
// macOS it runs on, the studio's own sentence about it, and the check on the
// same line as the thing it checks. A release that is ready is a second
// card under it, with its notes and the install button, and it exists only
// while there is one — an empty "Releases" group said nothing.
function UpdatesSection() {
  const { hasRunningTurns, updates } = useStudio();
  const isMac = useIsMac();
  const { download, release } = updates;

  return (
    <>
      <Group
        description="Releases are checked once each time the studio opens; installing replaces the app and restarts it"
        title="This build"
      >
        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="font-heading font-semibold text-2xl tabular-nums tracking-tight">
                  {updates.version ?? "—"}
                </span>
                {updates.environment === null ? null : (
                  <Badge variant="outline">
                    {ENVIRONMENTS[updates.environment]}
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                {updateSummary(updates)}
              </span>
            </div>
            <Button
              className="shrink-0"
              disabled={
                updates.unavailable !== null ||
                updates.isChecking ||
                updates.isInstalling
              }
              onClick={updates.check}
              size="sm"
              title={updates.unavailable ?? "Ask GitHub for the newest release"}
              variant="outline"
            >
              {updates.isChecking ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Check now
            </Button>
          </div>

          <Facts rows={[[isMac ? "macOS" : "System", updates.os ?? "—"]]} />

          {updates.error === null ? null : (
            <p className="text-destructive text-xs">{updates.error}</p>
          )}
        </div>
      </Group>

      {release === null ? null : (
        <Group
          description={
            release.date === null
              ? "Newer than this build"
              : `Published ${shortDay(release.date)}, newer than this build`
          }
          title={`${release.version} is ready`}
        >
          <div className="grid min-w-0 gap-4">
            {release.body ? (
              <div className="max-h-64 overflow-y-auto rounded-md bg-muted/40 p-3">
                <p className="whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">
                  {release.body}
                </p>
              </div>
            ) : null}

            {download === null ? null : (
              <Progress className="gap-1.5" value={downloadedShare(download)}>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {downloadedLabel(download)}
                </span>
              </Progress>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={updates.isInstalling}
                onClick={updates.install}
                size="sm"
              >
                <CircleArrowUpIcon data-icon="inline-start" />
                Install and restart
              </Button>
              {hasRunningTurns && !updates.isInstalling ? (
                <span className="text-warning-foreground text-xs">
                  A turn is still running — installing restarts the app and
                  stops it.
                </span>
              ) : null}
            </div>
          </div>
        </Group>
      )}
    </>
  );
}

function AccountsSection() {
  const { accounts, settingsView } = useStudio();

  return (
    <Group
      action={
        <Button
          disabled={accounts.isChecking}
          onClick={accounts.recheck}
          size="sm"
          variant="outline"
        >
          {accounts.isChecking ? (
            <Spinner className="size-3.5" data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Recheck
        </Button>
      }
      description="Each provider is asked with its own probe; a chat can only start on one that is signed in"
      title="Providers"
    >
      <div className="flex flex-col divide-y divide-border/60">
        {AGENT_PROVIDERS.map((provider) => (
          <AccountRow
            isChecking={accounts.isChecking}
            isFocused={settingsView.provider === provider}
            key={provider}
            provider={provider}
            row={accounts.rows[provider]}
          />
        ))}
      </div>
    </Group>
  );
}

const STATE_LABELS = {
  failed: "Action needed",
  ok: "Signed in",
  pending: "Checking",
  warn: "Check",
} satisfies Record<EnvironmentState, string>;

const STATE_VARIANTS = {
  failed: "error",
  ok: "success",
  pending: "outline",
  warn: "warning",
} satisfies Record<
  EnvironmentState,
  "error" | "outline" | "success" | "warning"
>;

// Providers share one surface: the mark, then the name with the
// probe's sentence right under it, then the verdict as a chip that says it in
// a word and a colour. The setup steps, when there are any, unfold under the
// sentence in the same column, so a provider with work to do grows downward
// and its neighbours stay put.
function AccountRow({
  isChecking,
  isFocused,
  provider,
  row,
}: {
  isChecking: boolean;
  isFocused: boolean;
  provider: AgentProvider;
  row: EnvironmentCheck | undefined;
}) {
  const info = PROVIDER_INFO[provider];
  const anchor = useScrolledIntoView<HTMLDivElement>(isFocused);

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 py-4 first:pt-0 last:pb-0",
        isFocused &&
          "rounded-md bg-background/60 outline outline-border outline-offset-4"
      )}
      data-provider={provider}
      ref={anchor}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <ProviderIcon className="size-4" provider={provider} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-tight">{info.name}</span>
        <AccountStatus isChecking={isChecking} provider={provider} row={row} />
      </div>

      <StateChip isChecking={isChecking} row={row} />
    </div>
  );
}

function StateChip({
  isChecking,
  row,
}: {
  isChecking: boolean;
  row: EnvironmentCheck | undefined;
}) {
  if (row === undefined) {
    return isChecking ? (
      <Spinner className="mt-2 size-3.5 text-muted-foreground" />
    ) : null;
  }
  const Icon = CHECK_ICONS[row.state];

  return (
    <Badge
      className="mt-1.5 gap-1"
      size="lg"
      variant={STATE_VARIANTS[row.state]}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {STATE_LABELS[row.state]}
    </Badge>
  );
}

// A provider with no row yet is presented plainly: "unknown" must never read
// as "signed out".
function AccountStatus({
  isChecking,
  provider,
  row,
}: {
  isChecking: boolean;
  provider: AgentProvider;
  row: EnvironmentCheck | undefined;
}) {
  const { copied, onCopy } = useCopyCommand();

  if (row === undefined) {
    return (
      <span className="text-muted-foreground text-xs">
        {isChecking ? "Checking…" : "Not checked yet"}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs leading-snug">
        {row.title}
      </span>

      {row.detail === null ? null : (
        <span className="whitespace-pre-wrap break-words text-muted-foreground text-xs leading-snug">
          {row.detail}
        </span>
      )}

      {row.fix?.type === "provider" ? (
        <ProviderSteps provider={provider} row={row} />
      ) : null}

      {row.fix?.type === "command" ? (
        <span className="mt-1 flex items-center gap-2">
          <code className="select-text rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
            {row.fix.command}
          </code>
          <Button
            onClick={onCopy}
            size="xs"
            value={row.fix.command}
            variant="ghost"
          >
            {copied === row.fix.command ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied === row.fix.command ? "Copied" : "Copy"}
          </Button>
        </span>
      ) : null}
    </div>
  );
}
