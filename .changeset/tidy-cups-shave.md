---
"remocn-studio": patch
---

The window loses its title bar, and its lines with it. The rule underneath the bar
and the one under every pane header are gone — two of them stacked ten pixels apart
was most of what made the window look ruled rather than laid out. The panes now
run to the top of the window, so the sidebar's own column starts up there: its
first row holds the traffic lights, a sidebar-collapse control and the full
remocn lockup, where the mark is the word's "r" and so sizes and colours as one
piece of text. Under it the search field gained a New session button beside it,
which starts a draft in the open project. `Main`, the sidecar status and Export
moved to the preview pane's header — the far right of the window, where they
were, minus the bar that used to carry them. Dragging the window still works
anywhere along the top: the brand row and both pane headers are drag regions.

The bar no longer shows the open folder at all: the projects pane is where a
folder is opened and which one is open. A folder that fails to open still says so
— that error moved to the foot of the projects pane, where the other pane errors
already live, rather than disappearing with the button that used to show it.

Inside, the pane is now built from the registry's own `Sidebar` parts rather than
hand-rolled rows: `SidebarHeader` holds the brand row and the search field,
`SidebarGroup` + `SidebarGroupLabel` + `SidebarGroupAction` make the Projects
heading and its two controls, project rows are `SidebarMenuButton`, sessions sit
in a `SidebarMenuSub`, loading is `SidebarMenuSkeleton` and Settings is a
`SidebarFooter`. The key to embedding it in a resizable panel is
`collapsible="none"`: it drops the off-canvas gap element and the mobile Sheet
and renders a plain flex column, so the panel keeps owning the width. The
provider is still required — every menu part reads its context — which is also
why `SidebarProvider` now claims ⌘B globally.

The sub-list keeps its list semantics but sheds the rail and indent it ships
with, because a session title is meant to line up with the project name above it
rather than hang off it.

A project row leads with a folder icon in place of the chevron, open when the
group is expanded and closed when it is not, so the icon carries the state the
chevron used to. Session titles sit muted with the open one brought forward, and
"Show N more" is text rather than a button-shaped thing.

Search with ⌘K, the project sort control and a Settings row at the foot of the
sidebar are **present but inert** — the layout the reference has, with none of the
behaviour behind it yet. They are disabled rather than silently doing nothing, so
the sidebar reads as finished without pretending to work.
