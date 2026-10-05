"use client";

import type { ChangeEvent, MouseEvent } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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
  SearchIcon,
  SlidersHorizontalIcon,
  SunMoonIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { IntegrationsSection } from "./integrations-section";
import { ProjectSettingsSection } from "./project-settings-section";
import { ProviderSteps } from "./provider-steps";
import { SettingsPanel as Group } from "./settings-group";
import { SidebarSlide } from "./sidebar-slide";
import { useStudio } from "./studio-provider";
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
    description: "Make the studio feel right for you.",
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
    description: "Every keyboard shortcut, in one place.",
    icon: KeyboardIcon,
    id: "hotkeys",
    label: "Hotkeys",
  },
  {
    description: "Connect your tools and AI accounts.",
    icon: PlugZapIcon,
    id: "integrations",
    label: "Integrations",
  },
  {
    description: "Keep the studio up to date.",
    icon: CircleArrowUpIcon,
    id: "updates",
    label: "Updates",
  },
  {
    description: "Tell us what broke, or what is missing.",
    icon: MessageSquareIcon,
    id: "feedback",
    label: "Feedback",
  },
];

// Settings replaces the sidebar below stationary window chrome. The workspace
// remains mounted and inert so switching back preserves the preview and turn.
export function SettingsPage() {
  const { settingsView } = useStudio();
  const { section, setSection } = settingsView;
  const presence = usePresence(
    settingsView.isOpen ? true : null,
    settingsView.animate ? 200 : 0
  );
  const back = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (settingsView.isOpen) {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      back.current?.focus({ preventScroll: true });
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (opener.current?.isConnected) {
        opener.current.focus({ preventScroll: true });
      }
      opener.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [settingsView.isOpen]);

  const onPickSection = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isSettingsSection(picked)) {
        setSection(picked);
      }
    },
    [setSection]
  );

  return (
    <section
      aria-hidden={!settingsView.isOpen || undefined}
      aria-label="Settings"
      className="pointer-events-none absolute inset-x-0 top-[46px] bottom-0 z-40 flex text-foreground"
      inert={!settingsView.isOpen || undefined}
    >
      <div className="w-[238px] shrink-0 overflow-hidden max-sm:w-44">
        <SidebarSlide
          animate={settingsView.animate}
          inactive={!settingsView.isOpen}
          offset={settingsView.isOpen ? 0 : 1}
        >
          <SectionRail
            active={section}
            backRef={back}
            onBack={settingsView.close}
            onPick={onPickSection}
          />
        </SidebarSlide>
      </div>

      {presence.shown === null ? null : <SettingsContent />}
    </section>
  );
}

function SettingsContent() {
  const { settingsView } = useStudio();
  const { section } = settingsView;
  const active = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];
  return (
    <div className="pointer-events-auto mr-2 mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            "flex min-h-full w-full flex-col gap-6 px-6 pt-6 pb-2",
            section === "hotkeys" ? "max-w-[1040px]" : "max-w-[768px]"
          )}
        >
          <header className="flex flex-col gap-2">
            <h2 className="font-heading font-medium text-2xl leading-8 tracking-[-.025em]">
              {active.label}
            </h2>
            <p className="text-[14px] text-muted-foreground leading-5">
              {active.description}
            </p>
          </header>

          <div
            className={cn(
              "flex flex-col gap-4",
              section === "project" && "flex-1"
            )}
          >
            {settingsView.blocked ? (
              <p className="text-destructive text-sm" role="alert">
                Save or cancel your project changes before leaving.
              </p>
            ) : null}
            {section === "project" ? (
              <ProjectSettingsSection key={settingsView.projectId ?? "none"} />
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
          <SettingsFooter section={section} />
        </div>
      </div>
    </div>
  );
}

const FOOTNOTES: Record<SectionId, string | null> = {
  appearance: "Changes are saved automatically",
  behavior: "Changes are saved automatically",
  feedback: "Esc · Back to studio",
  hotkeys: "Shortcuts follow your platform. Use Ctrl instead of ⌘ on Windows.",
  integrations: "Changes are saved automatically",
  notifications: "Changes are saved automatically",
  project: null,
  updates: "Esc · Back to studio",
};

function SettingsFooter({ section }: { section: SectionId }) {
  const text = FOOTNOTES[section];
  if (text === null) {
    return null;
  }
  return (
    <p className="mt-auto flex min-h-14 shrink-0 items-center text-muted-foreground text-sm leading-[18px]">
      {text}
    </p>
  );
}

// The rail follows the pane's menus: no weight change between states, a
// muted background for the open section, icons leading. The Updates row
// carries a dot while a release is waiting, so the dialog never hides it.
function SectionRail({
  active,
  backRef,
  onBack,
  onPick,
}: {
  active: SectionId;
  backRef: React.RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { updates } = useStudio();

  return (
    <aside className="pointer-events-auto flex h-full w-full flex-col overflow-y-auto bg-sidebar px-3 pt-2 pb-4">
      {/* The arrow and the word are one control: the whole row goes back,
          and the word is what the row is named by. */}
      <div className="mb-[18px]" data-tauri-drag-region>
        <Button
          aria-label="Back"
          className="w-full justify-start gap-2 px-2 text-muted-foreground"
          onClick={onBack}
          ref={backRef}
          size="sm"
          variant="ghost"
        >
          <ArrowLeftIcon
            className="text-muted-foreground"
            data-icon="inline-start"
          />
          <span className="font-medium text-sm">Back</span>
        </Button>
      </div>
      <h1 className="mb-1 flex h-6 shrink-0 items-center px-2 font-normal text-muted-foreground text-xs">
        Settings
      </h1>
      <nav aria-label="Settings sections" className="flex flex-col">
        {SECTIONS.map((entry) => (
          <button
            aria-current={active === entry.id ? "true" : undefined}
            className={cn(
              "flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm leading-[18px] outline-none transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 active:bg-accent",
              active === entry.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
  id: ThemeChoice;
  label: string;
  swatch: string;
  bar: string;
  chip: string;
}[] = [
  {
    bar: "bg-[#f5f5f5]",
    chip: "bg-[#303030]",
    id: "dark",
    label: "Dark",
    swatch: "bg-[#1c1c1c]",
  },
  {
    bar: "bg-[#191919]",
    chip: "bg-[#eeeeee]",
    id: "light",
    label: "Light",
    swatch: "bg-white",
  },
  {
    bar: "bg-[#191919]",
    chip: "bg-[#eeeeee]",
    id: "system",
    label: "System",
    swatch: "bg-[#d0d0d0]",
  },
];

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
    <div className="flex min-w-0 items-center justify-between gap-6 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {htmlFor === undefined ? (
          <span className="text-[14px] leading-5">{title}</span>
        ) : (
          <Label
            className="font-normal text-[14px] leading-5"
            htmlFor={htmlFor}
          >
            {title}
          </Label>
        )}
        <p className="max-w-[480px] text-muted-foreground text-sm leading-[18px]">
          {description}
        </p>
      </div>
      <div className="flex w-[min(200px,40%)] shrink-0 items-center justify-end">
        {children}
      </div>
    </div>
  );
}

function HotkeysSection() {
  const [query, setQuery] = useState("");
  const onSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );
  const search = query.trim().toLowerCase();
  const groups = HOTKEY_GROUPS.map((group) => ({
    ...group,
    ids: group.ids.filter((id) =>
      `${group.title} ${SHORTCUT_TITLES[id]} ${formatShortcut(SHORTCUTS[id])}`
        .toLowerCase()
        .includes(search)
    ),
  })).filter((group) => group.ids.length > 0);

  return (
    <div className="@container/hotkeys grid gap-6">
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-[9px] z-1 size-4 text-muted-foreground"
        />
        <Input
          aria-label="Find a shortcut"
          className="h-9 pl-8"
          onChange={onSearch}
          placeholder="Find a shortcut…"
          type="search"
          value={query}
        />
      </div>
      <div className="grid @2xl/hotkeys:grid-cols-2 gap-8">
        {groups.map((group) => (
          <section
            aria-label={group.title}
            className="grid content-start gap-2"
            key={group.title}
          >
            <h3 className="font-medium text-[14px] leading-5">{group.title}</h3>
            {group.ids.map((id) => (
              <div
                className="flex min-h-7 items-center justify-between gap-4"
                key={id}
              >
                <span className="min-w-0 flex-1 text-sm leading-[18px]">
                  {SHORTCUT_TITLES[id]}
                </span>
                <span className="flex w-28 shrink-0 justify-end">
                  <Kbd
                    aria-label={formatShortcut(SHORTCUTS[id])}
                    className="h-auto rounded-md bg-secondary px-2 py-0.5 font-mono font-normal text-foreground text-sm leading-[18px]"
                  >
                    {shortcutKeys(SHORTCUTS[id]).join(" ")}
                  </Kbd>
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="py-6 text-muted-foreground text-sm" role="status">
          No shortcuts match “{query.trim()}”.
        </p>
      ) : null}
    </div>
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
    <Group description="Choose a theme, or follow your system." title="Theme">
      <div className="flex gap-3">
        {THEME_TILES.map((tile) => (
          <button
            aria-pressed={choice === tile.id}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-2.5 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
            key={tile.id}
            onClick={onPickTheme}
            type="button"
            value={tile.id}
          >
            <span
              className={cn(
                "flex h-[104px] flex-col justify-between rounded-md p-[9px]",
                tile.swatch
              )}
            >
              <span
                className={cn("h-[5px] w-16 max-w-full rounded-sm", tile.bar)}
              />
              <span
                className={cn(
                  "h-6 w-[100px] max-w-full self-end rounded-md",
                  tile.chip
                )}
              />
            </span>
            <span className="flex items-center justify-between text-sm leading-[18px]">
              {tile.label}
              {choice === tile.id ? <CheckIcon className="size-4" /> : null}
            </span>
          </button>
        ))}
      </div>
    </Group>
  );
}

function TitlebarGroup() {
  const { preferences } = useStudio();
  const isMac = useIsMac();

  return (
    <Group
      description="A subtle signal when a turn is running or needs attention."
      title="Title bar"
    >
      <div className="flex flex-col gap-4">
        <Row
          description="Keep the title bar plain when this is off."
          htmlFor="settings-titlebar-shader"
          title="Show activity in title bar"
        >
          <Switch
            checked={preferences.titlebarShader}
            id="settings-titlebar-shader"
            onCheckedChange={preferences.setTitlebarShader}
            size="default"
          />
        </Row>

        <Row
          description={
            isMac
              ? "Follows your system’s Reduce Motion preference."
              : "Follows your system’s reduce-motion setting."
          }
          htmlFor="settings-titlebar-motion"
          title="Animate activity"
        >
          <Switch
            checked={preferences.titlebarMotion}
            disabled={!preferences.titlebarShader}
            id="settings-titlebar-motion"
            onCheckedChange={preferences.setTitlebarMotion}
            size="default"
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
        <div className="flex flex-col gap-2">
          <Row
            description="When a turn ends, offer to save the pictures and clips it carried into the asset library"
            htmlFor="settings-asset-offers"
            title="Library suggestions"
          >
            <Switch
              checked={preferences.assetOffers}
              id="settings-asset-offers"
              onCheckedChange={preferences.setAssetOffers}
              size="default"
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
              size="default"
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
        <div className="flex flex-col gap-2">
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
        size="default"
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
          size="default"
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

function FeedbackSection() {
  const { feedback, provider, updates } = useStudio();
  const isMac = useIsMac();

  return (
    <>
      <Group
        description="Describe the problem or the improvement you would like."
        title="Email feedback"
      >
        <div className="grid min-w-0 justify-items-start gap-3">
          <p className="max-w-[580px] text-[14px] leading-5">
            Your mail app opens with the app details below. Add a screenshot and
            send the message when you’re ready.
          </p>
          <Button onClick={feedback.send} size="sm">
            <MailIcon data-icon="inline-start" />
            Email feedback
          </Button>
          {feedback.error === null ? null : (
            <p className="break-words text-destructive text-xs" role="alert">
              {feedback.error}
            </p>
          )}
        </div>
      </Group>
      <Group title="Included app details">
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
        <p className="text-muted-foreground text-sm leading-[18px]">
          Nothing is sent automatically.
        </p>
      </Group>
    </>
  );
}

function Facts({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid grid-cols-[minmax(80px,144px)_minmax(0,1fr)] gap-4 text-sm leading-[18px]">
      {rows.map(([name, value]) => (
        <Fragment key={name}>
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="break-words font-mono tabular-nums">{value}</dd>
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
        description="The studio checks for updates when it opens."
        title="This build"
      >
        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 py-[9px]">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="font-medium text-xl leading-7">
                Remocn Studio
              </span>
              <p className="text-muted-foreground text-sm leading-[18px]">
                {updates.version ?? "—"}
                {updates.environment === null
                  ? null
                  : ` · ${ENVIRONMENTS[updates.environment]}`}
                {" · "}
                <span>{isMac ? "macOS" : "System"}</span>
                {updates.os === null ? null : ` ${updates.os}`}
              </p>
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

          <p
            className="flex min-h-11 items-center gap-2.5 rounded-md p-3 text-[14px] leading-5"
            role="status"
          >
            <RefreshCwIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            {updateSummary(updates)}
          </p>
          <p className="text-muted-foreground text-sm leading-[18px]">
            Installing an update restarts the app. Finish active turns before
            installing.
          </p>

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
    <div className="pt-3">
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
        description="Sign in to at least one provider to start a turn."
        title="AI accounts"
      >
        <div className="@container/accounts flex flex-col gap-4">
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
    </div>
  );
}

const STATE_LABELS = {
  failed: "Action needed",
  ok: "Signed in",
  pending: "Checking",
  warn: "Check",
} satisfies Record<EnvironmentState, string>;

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
  const name = {
    claude: "Claude Code",
    codex: "Codex",
    copilot: "GitHub Copilot",
    grok: "Grok Build",
  }[provider];
  const anchor = useScrolledIntoView<HTMLDivElement>(isFocused);
  const [expanded, setExpanded] = useState(isFocused);
  const detailsId = useId();
  useEffect(() => {
    if (isFocused) {
      setExpanded(true);
    }
  }, [isFocused]);
  const onManage = useCallback(() => setExpanded((value) => !value), []);
  const action = row?.state === "ok" ? "Manage" : "Set up";
  const unknownStatus = isChecking ? "Checking…" : "Not checked yet";
  let status = row === undefined ? unknownStatus : STATE_LABELS[row.state];
  if (row?.state === "failed" && row.fix?.type === "provider") {
    status = row.fix.step === "install" ? "Not installed" : "Sign-in required";
  }

  return (
    <div className="min-w-0" data-provider={provider} ref={anchor}>
      <div className="grid min-h-12 @xl/accounts:grid-cols-[1fr_160px_88px] grid-cols-[1fr_88px] items-center gap-x-3 gap-y-1 py-2">
        <span className="text-[14px] leading-5">{name}</span>
        <span className="@xl/accounts:col-start-2 col-start-1 @xl/accounts:row-start-1 row-start-2 text-muted-foreground text-sm leading-[18px]">
          {status}
        </span>
        <Button
          aria-controls={detailsId}
          aria-expanded={expanded}
          aria-label={`${action} ${name}`}
          className="@xl/accounts:col-start-3 col-start-2 row-start-1 w-[88px]"
          onClick={onManage}
          size="sm"
          variant="secondary"
        >
          {action}
        </Button>
      </div>
      {expanded ? (
        <div className="pb-4" id={detailsId}>
          <AccountStatus
            isChecking={isChecking}
            provider={provider}
            row={row}
          />
        </div>
      ) : null}
    </div>
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
