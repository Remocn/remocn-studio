"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeftIcon,
  ComponentIcon,
  FolderIcon,
  LibraryBigIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { stockKindOf } from "@/hooks/use-assets-scope";

import { usePickAsset } from "@/hooks/use-pick-asset";
import { isPaneView, type PaneView } from "@/lib/studio/pane-view";
import { isMediaAsset } from "@/shared/library";
import { AssetsPane } from "./assets-pane";
import { AssetsScopeSwitch } from "./assets-scope";
import { ComponentsPane } from "./components-pane";
import { LogoWordmark } from "./logo-mark";
import { ProjectBrowser } from "./project-browser";
import { SidebarSlide } from "./sidebar-slide";
import { StockPane } from "./stock-pane";
import { useStudio } from "./studio-provider";
import { WorkspaceLists } from "./workspace-lists";

const VIEW_ITEMS: readonly {
  icon: typeof ComponentIcon;
  label: string;
  view: PaneView;
}[] = [
  { icon: FolderIcon, label: "Projects", view: "projects" },
  { icon: LibraryBigIcon, label: "Assets", view: "assets" },
  {
    icon: ComponentIcon,
    label: "Components",
    view: "components",
  },
];

export function ProjectsPane() {
  const { isLibraryOpen, paneView, libraryAnimate } = useStudio();
  const replaced = isLibraryOpen && paneView !== "videos";
  return (
    <div className="relative h-full overflow-hidden">
      <SidebarSlide
        animate={libraryAnimate}
        inactive={replaced}
        offset={replaced ? -1 : 0}
      >
        <WorkspaceSidebar />
      </SidebarSlide>
      <div className="pointer-events-none absolute inset-0">
        <SidebarSlide
          animate={libraryAnimate}
          inactive={!replaced}
          offset={replaced ? 0 : 1}
        >
          <LibrarySidebar active={replaced} />
        </SidebarSlide>
      </div>
    </div>
  );
}

function LibrarySidebar({ active }: { active: boolean }) {
  const {
    assetsScope,
    closeLibrary,
    componentScope,
    setComponentScope,
    newProject,
    paneView,
    activeProject,
  } = useStudio();
  const title =
    VIEW_ITEMS.find((item) => item.view === paneView)?.label ?? "Library";
  const pickScope = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const scope = event.currentTarget.value;
      if (scope === "all" || scope === "saved" || scope === "bundled") {
        setComponentScope(scope);
      }
    },
    [setComponentScope]
  );
  const back = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (active) {
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
  }, [active]);
  return (
    <aside
      aria-label={`${title} navigation`}
      className="pointer-events-auto flex h-full min-h-0 flex-col bg-sidebar pt-2 pb-4"
    >
      <Button
        aria-label="Back to chat"
        className="mx-3 mb-3 shrink-0 justify-start gap-2 px-2 text-muted-foreground"
        onClick={closeLibrary}
        ref={back}
        size="sm"
        variant="ghost"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back
      </Button>
      <div className="mb-1 flex h-6 shrink-0 items-center justify-between pr-3 pl-5">
        <h1 className="text-muted-foreground text-xs">{title}</h1>
        {paneView === "projects" ? (
          <Button
            aria-label="Create project"
            onClick={newProject.open}
            size="icon-xs"
            title="Create project"
            variant="ghost"
          >
            <PlusIcon />
          </Button>
        ) : null}
      </div>
      {paneView === "components" ? (
        <nav
          aria-label="Component sources"
          className="mx-3 grid shrink-0 grid-cols-3 gap-1"
        >
          {(["all", "saved", "bundled"] as const).map((scope) => (
            <Button
              aria-pressed={componentScope === scope}
              className="h-7 px-1 font-normal text-xs"
              key={scope}
              onClick={pickScope}
              size="sm"
              value={scope}
              variant={componentScope === scope ? "secondary" : "ghost"}
            >
              {{ all: "All", bundled: "Built-in", saved: "Saved" }[scope]}
            </Button>
          ))}
        </nav>
      ) : null}
      {paneView === "assets" ? (
        <div className="shrink-0 px-3">
          <AssetsScopeSwitch scope={assetsScope} />
        </div>
      ) : null}
      {paneView === "projects" ? (
        <ProjectBrowser />
      ) : (
        <WorkspaceLibrary active={active} />
      )}
      <p className="shrink-0 truncate px-5 pt-3 text-muted-foreground text-xs">
        {activeProject?.name ?? "Library"}
      </p>
    </aside>
  );
}

function WorkspaceSidebar() {
  const {
    drops,
    feedback,
    isLibraryOpen,
    openLibrary,
    paneView,
    settingsView,
  } = useStudio();
  return (
    <SidebarProvider className="h-full min-h-0">
      <Sidebar
        className="w-full bg-transparent"
        collapsible="none"
        ref={isLibraryOpen ? undefined : drops.library.ref}
      >
        <SidebarHeader className="gap-0 p-0">
          <SidebarBrand />
          <PaneViewMenu
            onShow={openLibrary}
            view={isLibraryOpen ? paneView : null}
          />
        </SidebarHeader>
        <WorkspaceLists />
        <SidebarFooter className="gap-0 px-3 pb-4">
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-7 text-muted-foreground"
                onClick={settingsView.open}
              >
                <SettingsIcon />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-7 text-muted-foreground"
                onClick={feedback.send}
              >
                <MessageSquareIcon />
                Feedback
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}

function WorkspaceLibrary({ active }: { active: boolean }) {
  const {
    actionError,
    folderError,
    assetsScope,
    componentScope,
    composerActions,
    drops,
    library,
    paneView,
  } = useStudio();
  const paneError = actionError ?? folderError;
  const pickable = useMemo(
    () => [...library.assets, ...library.bundled],
    [library.assets, library.bundled]
  );
  const pickAsset = usePickAsset(pickable, composerActions.pick);
  const stockKind = stockKindOf(assetsScope.scope);

  const media = useMemo(
    () => library.assets.filter((asset) => isMediaAsset(asset.type)),
    [library.assets]
  );
  const components = useMemo(
    () => library.assets.filter((asset) => !isMediaAsset(asset.type)),
    [library.assets]
  );

  let content: ReactNode = null;
  if (paneView === "assets") {
    content =
      stockKind === null ? (
        <AssetsPane
          assets={media}
          error={library.error}
          isLoading={library.isLoading}
          isOver={drops.library.isOver}
          onPick={pickAsset}
          onRemove={library.onRemove}
          onRetry={library.reload}
        />
      ) : (
        <StockPane kind={stockKind} onSaved={library.refresh} />
      );
  }

  if (paneView === "components") {
    content = (
      <ComponentsPane
        assets={componentScope === "bundled" ? [] : components}
        bundled={componentScope === "saved" ? [] : library.bundled}
        error={library.error}
        isLoading={library.isLoading}
        onPick={pickAsset}
        onRemove={library.onRemove}
        onRetry={library.reload}
      />
    );
  }

  return (
    <LibraryFrame active={active} error={paneError}>
      {content}
    </LibraryFrame>
  );
}

function LibraryFrame({
  active,
  children,
  error,
}: {
  active: boolean;
  children: ReactNode;
  error: string | null;
}) {
  const { drops, paneView } = useStudio();
  return (
    <SidebarProvider
      aria-label="Library"
      className="min-h-0 flex-1"
      role="region"
    >
      <Sidebar
        className="w-full bg-sidebar"
        collapsible="none"
        ref={active ? drops.library.ref : undefined}
      >
        <div
          className="@container flex min-h-0 flex-1 flex-col px-1"
          key={paneView}
        >
          {children}
        </div>
        {error === null ? null : (
          <p className="shrink-0 break-words px-6 py-2 text-destructive text-xs">
            {error}
          </p>
        )}
      </Sidebar>
    </SidebarProvider>
  );
}

// The pane's views, as a vertical menu of their own: which of them is on
// screen is app state, not a row among the projects. No indicators ride on
// these items — the titlebar's mood is what says something is waiting.
function PaneViewMenu({
  onShow,
  view,
}: {
  onShow: (view: PaneView) => void;
  view: PaneView | null;
}) {
  const onSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isPaneView(picked)) {
        onShow(picked);
      }
    },
    [onShow]
  );

  return (
    <nav aria-label="Library views" className="px-3 pt-2 pb-4">
      <SidebarMenu className="gap-0">
        {VIEW_ITEMS.map((item) => (
          <SidebarMenuItem key={item.view}>
            <SidebarMenuButton
              className="h-7 px-2 text-sidebar-foreground hover:bg-accent hover:text-foreground data-active:bg-sidebar-accent data-active:font-normal data-active:text-foreground"
              isActive={view === item.view}
              onClick={onSelect}
              value={item.view}
            >
              <item.icon />
              {item.label}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}

// The traffic lights are cleared by the header's top inset, above this row, so
// the wordmark can sit on the same left edge as the group label and the project
// names below it rather than being pushed out of the column.
function SidebarBrand() {
  const { openSearch } = useStudio();
  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1 pr-3 pl-5"
      data-tauri-drag-region="deep"
    >
      <LogoWordmark className="pointer-events-none mr-auto shrink-0 text-[14px] leading-[18px]" />
      <Button
        aria-label="Search"
        className="text-muted-foreground"
        onClick={openSearch}
        size="icon-sm"
        variant="ghost"
      >
        <SearchIcon />
      </Button>
    </div>
  );
}
