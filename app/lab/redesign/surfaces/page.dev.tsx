"use client";

import { useTheme } from "next-themes";
import { type ChangeEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RemainingPrimitives } from "./primitives";

const VIDEOS = ["Product launch", "Brand film", "Social cut"];

export default function SurfaceFixture() {
  const { setTheme } = useTheme();
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 4));
  const [action, setAction] = useState("No action yet");
  const [videoName, setVideoName] = useState("Product launch");
  const light = useCallback(() => setTheme("light"), [setTheme]);
  const dark = useCallback(() => setTheme("dark"), [setTheme]);
  const rename = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setVideoName(event.target.value),
    []
  );
  const save = useCallback(() => setAction(`Saved ${videoName}`), [videoName]);
  const newVideo = useCallback(() => setAction("New video"), []);
  const openProject = useCallback(() => setAction("Open project"), []);
  const notifyError = useCallback(
    () =>
      toastManager.add({
        description: "Try again when the renderer is ready.",
        timeout: 0,
        title: "Export failed",
        type: "error",
      }),
    []
  );
  const notify = () =>
    toastManager.add({
      actionProps: {
        children: "Open",
        onClick: () => setAction("Opened export"),
      },
      description: "Saved to exports/product-launch.mp4",
      timeout: 0,
      title: "Video exported",
      type: "success",
    });

  return (
    <ToastProvider>
      <main className="h-dvh overflow-auto bg-background p-6 text-foreground">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <header className="flex flex-wrap items-center gap-2">
            <h1 className="mr-auto font-semibold text-xl">Shared surfaces</h1>
            <Button onClick={light} variant="outline">
              Light
            </Button>
            <Button onClick={dark} variant="outline">
              Dark
            </Button>
          </header>
          <div className="flex flex-wrap gap-2">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>
                Open sheet
              </SheetTrigger>
              <SheetPopup variant="inset">
                <SheetHeader>
                  <SheetTitle>Video details</SheetTitle>
                  <SheetDescription>1920 × 1080 · 30 fps</SheetDescription>
                </SheetHeader>
                <SheetPanel>
                  <Input
                    aria-label="Video name"
                    onChange={rename}
                    value={videoName}
                  />
                </SheetPanel>
                <SheetFooter>
                  <SheetClose render={<Button onClick={save} />}>
                    Save
                  </SheetClose>
                </SheetFooter>
              </SheetPopup>
            </Sheet>
            <Drawer>
              <DrawerTrigger render={<Button variant="outline" />}>
                Open drawer
              </DrawerTrigger>
              <DrawerPopup>
                <DrawerHeader>
                  <DrawerTitle>Choose an action</DrawerTitle>
                  <DrawerDescription>
                    Continue with an existing project or start a video.
                  </DrawerDescription>
                </DrawerHeader>
                <DrawerPanel>
                  <DrawerClose
                    render={<Button onClick={newVideo} variant="ghost" />}
                  >
                    New video
                  </DrawerClose>
                  <DrawerClose
                    render={<Button onClick={openProject} variant="ghost" />}
                  >
                    Open project
                  </DrawerClose>
                </DrawerPanel>
                <DrawerFooter variant="bare">
                  <DrawerClose render={<Button variant="outline" />}>
                    Cancel
                  </DrawerClose>
                </DrawerFooter>
              </DrawerPopup>
            </Drawer>
            <Button onClick={notify} variant="outline">
              Show success toast
            </Button>
            <Button onClick={notifyError} variant="outline">
              Show error toast
            </Button>
          </div>
          <output
            aria-label="Last action"
            className="text-muted-foreground text-sm"
          >
            {action}
          </output>
          <div className="grid items-start gap-6 md:grid-cols-2">
            <section aria-label="Calendar" className="rounded-xl bg-card p-4">
              <Calendar
                captionLayout="dropdown"
                defaultMonth={new Date(2026, 9, 1)}
                mode="single"
                onSelect={setDate}
                selected={date}
              />
              <output className="text-muted-foreground text-xs">
                Selected: {date?.toLocaleDateString("en-GB") ?? "none"}
              </output>
            </section>
            <section aria-label="Toggle groups" className="flex gap-6">
              <ToggleGroup aria-label="Text alignment" defaultValue={["left"]}>
                <ToggleGroupItem value="left">Left</ToggleGroupItem>
                <ToggleGroupItem value="center">Center</ToggleGroupItem>
                <ToggleGroupItem value="right">Right</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                aria-label="Quality"
                defaultValue={["standard"]}
                orientation="vertical"
                variant="outline"
              >
                <ToggleGroupItem value="standard">Standard</ToggleGroupItem>
                <ToggleGroupItem value="high">High</ToggleGroupItem>
              </ToggleGroup>
            </section>
          </div>
          <RemainingPrimitives />
          {(["default", "card"] as const).map((variant) => (
            <Table
              aria-label={`${variant} video table`}
              key={variant}
              variant={variant}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {VIDEOS.map((name) => (
                  <TableRow
                    data-state={name === "Brand film" ? "selected" : undefined}
                    key={name}
                  >
                    <TableCell>{name}</TableCell>
                    <TableCell>1080p</TableCell>
                    <TableCell>Ready</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
        </div>
      </main>
    </ToastProvider>
  );
}
