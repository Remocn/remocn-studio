"use client";

import { SelectControl } from "dialkit";
import { useCallback, useState } from "react";
import { RotateCcwIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { DeletionTarget } from "@/hooks/use-deletion";
import type { ManagedObjects } from "@/hooks/use-managed-objects";
import type { PropGroups } from "@/hooks/use-prop-groups";
import { readableLabel } from "@/lib/studio/property-presentation";
import { DeleteAction } from "./delete-action";
import { DialKitSurface } from "./dialkit-surface";
import { ManagedFields } from "./managed-fields";
import { ManagedInstruction } from "./managed-instruction";
import { Pane, PaneActions, PaneBody, PaneHeader } from "./pane";

export function ManagedPropsPane({
  deletion = null,
  objects,
  groups,
  fps,
  onAddInstruction,
  onDelete,
}: {
  deletion?: DeletionTarget | null;
  objects: ManagedObjects;
  groups?: PropGroups;
  fps?: number;
  onAddInstruction?: (instruction: string) => void;
  onDelete?: () => void;
}) {
  const [tab, setTab] = useState("appearance");
  const changeTab = useCallback(
    (value: unknown) => {
      if (objects.pending > 0) {
        objects.commit();
      }
      setTab(String(value));
    },
    [objects.commit, objects.pending]
  );
  let status = objects.canUndo ? "Saved" : "";
  if (objects.awaitingPreview) {
    status = "Updating preview…";
  }
  if (objects.pending > 0) {
    status = "Unsaved changes";
  }
  if (objects.busy) {
    status = "Saving…";
  }
  if (objects.loading) {
    status = "Loading properties…";
  }
  return (
    <Pane className="managed-inspector property-inspector">
      <Tabs
        className="h-full min-h-0 gap-0"
        onValueChange={changeTab}
        value={tab}
      >
        <PaneHeader className="h-auto flex-col items-stretch gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <DialKitSurface targetId="object-picker">
              <SelectControl
                label="Element"
                onChange={objects.select}
                options={objects.objects.map((object) => ({
                  label: readableLabel(object.label),
                  value: object.id,
                }))}
                value={objects.selected?.id ?? "Choose an element"}
              />
            </DialKitSurface>
            <PaneActions>
              {objects.selected?.shader ? (
                <Button
                  disabled={objects.busy || objects.pending > 0}
                  onClick={objects.resetShader}
                  size="xs"
                  variant="ghost"
                >
                  Reset shader
                </Button>
              ) : null}
              {onDelete === undefined ? null : (
                <DeleteAction onDelete={onDelete} target={deletion} />
              )}
              <Button
                aria-label="Undo last object change"
                disabled={!objects.canUndo}
                onClick={objects.undo}
                size="icon-sm"
                title="Undo last change"
                variant="ghost"
              >
                <RotateCcwIcon />
              </Button>
              <Button
                aria-label="Clear selection"
                onClick={objects.close}
                size="icon-sm"
                title="Clear selection"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </PaneActions>
          </div>
          <div className="flex flex-col gap-2 text-xs [overflow-wrap:anywhere] empty:hidden">
            {status ? (
              <p className="text-muted-foreground text-xs" role="status">
                {status}
              </p>
            ) : null}
            {objects.error ? (
              <div className="grid gap-2">
                <p className="text-destructive text-xs" role="alert">
                  {objects.error}
                </p>
                <Button
                  disabled={objects.busy}
                  onClick={objects.retry}
                  size="sm"
                  variant="outline"
                >
                  Retry saving
                </Button>
                <Button onClick={objects.reload} size="sm" variant="outline">
                  Reload properties
                </Button>
              </div>
            ) : null}
            {objects.pending > 0 ? (
              <Button
                disabled={objects.busy}
                onClick={objects.discard}
                size="sm"
                variant="outline"
              >
                Discard unsaved changes
              </Button>
            ) : null}
          </div>
          <TabsList
            aria-label="Property category"
            className="w-full"
            size="sm"
            variant="default"
          >
            <TabsTab
              className="focus-visible:ring-foreground/40"
              value="appearance"
            >
              Appearance
            </TabsTab>
            <TabsTab
              className="focus-visible:ring-foreground/40"
              value="animation"
            >
              Animation
            </TabsTab>
          </TabsList>
        </PaneHeader>
        <PaneBody className="overflow-y-auto p-0">
          <TabsPanel hidden={tab !== "appearance"} value="appearance">
            <DialKitSurface targetId={objects.selected?.id ?? "objects"}>
              <ManagedFields
                fps={fps}
                groups={groups}
                key={objects.selected?.id ?? "objects"}
                objects={objects}
                tab="appearance"
              />
            </DialKitSurface>
          </TabsPanel>
          <TabsPanel hidden={tab !== "animation"} value="animation">
            <DialKitSurface targetId={objects.selected?.id ?? "objects"}>
              <ManagedFields
                fps={fps}
                groups={groups}
                key={objects.selected?.id ?? "objects"}
                objects={objects}
                tab="animation"
              />
            </DialKitSurface>
          </TabsPanel>
        </PaneBody>
        {onAddInstruction && objects.selected ? (
          <ManagedInstruction
            objectId={objects.selected.id}
            onAdd={onAddInstruction}
          />
        ) : null}
      </Tabs>
    </Pane>
  );
}
