"use client";

import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Image from "next/image";
import {
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { ChevronDownIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TabsPanel } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/hooks/use-async-action";
import { errorMessage } from "@/lib/error-message";
import { addBrandFile, importGoogleFont } from "@/lib/studio/projects";
import { type BrandFile, emptyBrand, type ProjectBrand } from "@/shared/brand";
import { DialKitSurface } from "./dialkit-surface";
import { ProjectBrandColor } from "./project-brand-color";
import { ProjectDesignImport } from "./project-design-import";
import {
  ProjectSettingsGroup,
  ProjectSettingsRow,
} from "./project-settings-group";

const FONT_ROLES = ["display", "body", "mono"] as const;
const LOGO_ROLES = ["onLight", "onDark", "mark"] as const;
type FontRole = (typeof FONT_ROLES)[number];
type LogoRole = (typeof LOGO_ROLES)[number];
const isFontRole = (value: string): value is FontRole =>
  FONT_ROLES.some((role) => role === value);
const isLogoRole = (value: string): value is LogoRole =>
  LOGO_ROLES.some((role) => role === value);

export function ProjectBrandEditor({
  value,
  onChange,
  onBusyChange,
  projectId,
  root,
  brandActions,
}: {
  value: ProjectBrand | null;
  onChange: (brand: ProjectBrand | null) => void;
  onBusyChange: (busy: boolean) => void;
  projectId: string;
  root: string;
  brandActions?: ReactNode;
}) {
  const brand = value ?? emptyBrand();
  const { run, error } = useAsyncAction();
  const [fileError, setFileError] = useState<string | null>(null);
  const [colorName, setColorName] = useState("");
  const [addingColor, setAddingColor] = useState(false);
  const [importAtTop] = useState(value === null);
  const [reviewingImport, setReviewingImport] = useState(false);
  const [weights, setWeights] = useState("400;700");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    onBusyChange(loading || importing);
    return () => onBusyChange(false);
  }, [loading, importing, onBusyChange]);
  const update = useCallback(
    (patch: Partial<ProjectBrand>) => onChange({ ...brand, ...patch }),
    [brand, onChange]
  );
  const changeColorName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setColorName(event.currentTarget.value),
    []
  );
  const addColor = useCallback(() => {
    const name = colorName.trim();
    if (!name || Object.hasOwn(brand.colors, name)) {
      return;
    }
    update({ colors: { ...brand.colors, [name]: "#808080" } });
    setColorName("");
    setAddingColor(false);
  }, [brand.colors, colorName, update]);
  const changeColor = useCallback(
    (role: string, color: string) => {
      update({ colors: { ...brand.colors, [role]: color } });
    },
    [brand.colors, update]
  );
  const clear = useCallback(() => onChange(null), [onChange]);
  const changeWeights = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setWeights(event.target.value),
    []
  );
  const imageError = useCallback(
    () =>
      setFileError(
        "A logo could not be previewed. Check its file before saving."
      ),
    []
  );
  const changeText = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const [kind, role, index, field] = event.currentTarget.name.split(":");
      const text = event.currentTarget.value;
      if (kind === "name" || kind === "motion" || kind === "logoRules") {
        update({ [kind]: text });
        return;
      }
      if (kind === "tone") {
        update({ tone: { ...brand.tone, [role]: text } });
        return;
      }
      if (kind === "color") {
        const colors = { ...brand.colors };
        if (text) {
          colors[role] = text;
        } else {
          delete colors[role];
        }
        update({ colors });
        return;
      }
      if (!isFontRole(role)) {
        return;
      }
      const font = brand.typography[role] ?? {
        fallback: "sans-serif",
        family: "Custom font",
        files: [],
        licenses: [],
      };
      if (kind === "font") {
        update({
          typography: {
            ...brand.typography,
            [role]: { ...font, [index]: text },
          },
        });
        return;
      }
      if (kind === "face") {
        update({
          typography: {
            ...brand.typography,
            [role]: {
              ...font,
              files: font.files.map((file, i) =>
                i === Number(index) ? { ...file, [field]: text } : file
              ),
            },
          },
        });
      }
    },
    [brand, update]
  );
  const chooseFile = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const [kind, role] = event.currentTarget.value.split(":");
      setLoading(true);
      try {
        const extensions =
          kind === "font" ? ["woff2", "woff", "ttf", "otf"] : ["txt"];
        const path = await open({
          filters: [
            {
              extensions:
                kind === "logo" ? ["svg", "png", "jpg", "webp"] : extensions,
              name: "Brand file",
            },
          ],
          multiple: false,
          title: "Choose a brand file",
        });
        if (!path) {
          return;
        }
        const file = await run(addBrandFile(projectId, path));
        if (!file) {
          return;
        }
        if (kind === "logo" && isLogoRole(role)) {
          update({ logos: { ...brand.logos, [role]: file } });
          return;
        }
        if (!isFontRole(role)) {
          return;
        }
        const font = brand.typography[role] ?? {
          fallback: "sans-serif",
          family: file.font?.family ?? "Custom font",
          files: [],
          licenses: [],
        };
        const next =
          kind === "license"
            ? { ...font, licenses: [...font.licenses, file] }
            : {
                ...font,
                files: [...font.files, fontFace(file)],
              };
        update({ typography: { ...brand.typography, [role]: next } });
        setFileError(null);
      } catch (cause) {
        setFileError(errorMessage(cause));
      } finally {
        setLoading(false);
      }
    },
    [brand, projectId, run, update]
  );
  const downloadFont = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const [role, style] = event.currentTarget.value.split(":");
      if (!isFontRole(role)) {
        return;
      }
      const font = brand.typography[role];
      if (!font) {
        return;
      }
      setLoading(true);
      try {
        const result = await run(
          importGoogleFont(projectId, font.family, weights, style === "italic")
        );
        if (result) {
          update({
            typography: {
              ...brand.typography,
              [role]: {
                ...result,
                files: [
                  ...font.files.filter(
                    (file) =>
                      !result.files.some((next) => next.hash === file.hash)
                  ),
                  ...result.files,
                ],
                licenses: font.licenses,
              },
            },
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [brand, projectId, run, update, weights]
  );
  const removeFile = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const [kind, role, index] = event.currentTarget.value.split(":");
      if (kind === "logo" && isLogoRole(role)) {
        const logos = { ...brand.logos };
        delete logos[role];
        update({ logos });
        return;
      }
      if (!isFontRole(role)) {
        return;
      }
      const typography = { ...brand.typography };
      const font = typography[role];
      if (!font) {
        return;
      }
      if (kind === "font") {
        delete typography[role];
      } else {
        typography[role] = {
          ...font,
          files: font.files.filter((_file, i) => i !== Number(index)),
        };
      }
      update({ typography });
    },
    [brand, update]
  );
  return (
    <fieldset className="contents" disabled={loading}>
      <legend className="sr-only">Brand settings</legend>
      <TabsPanel className="grid gap-4" keepMounted value="brand">
        <div
          className={importAtTop || reviewingImport ? "order-first" : "order-1"}
        >
          <ProjectDesignImport
            compact={!importAtTop}
            onBusyChange={setImporting}
            onChange={onChange}
            onReviewChange={setReviewingImport}
            projectId={projectId}
            value={value}
          />
        </div>
        <div className={reviewingImport ? "hidden" : "grid gap-4"}>
          <ProjectSettingsRow
            description="Used for new videos in this project."
            htmlFor="brand-name"
            title="Brand name"
          >
            <Input
              className="w-full"
              id="brand-name"
              name="name"
              onChange={changeText}
              size="sm"
              value={brand.name ?? ""}
            />
          </ProjectSettingsRow>
          <ProjectSettingsGroup
            action={
              <Popover onOpenChange={setAddingColor} open={addingColor}>
                <PopoverTrigger
                  render={
                    <Button size="sm" type="button" variant="secondary" />
                  }
                >
                  <PlusIcon />
                  Add color
                </PopoverTrigger>
                <PopoverContent className="grid w-64 gap-3 p-3">
                  <Label
                    className="grid gap-2 text-sm"
                    htmlFor="brand-color-name"
                  >
                    Additional color name
                  </Label>
                  <Input
                    id="brand-color-name"
                    onChange={changeColorName}
                    value={colorName}
                  />
                  <Button
                    disabled={
                      !colorName.trim() ||
                      Object.hasOwn(brand.colors, colorName.trim())
                    }
                    onClick={addColor}
                    size="sm"
                    type="button"
                  >
                    Add color
                  </Button>
                </PopoverContent>
              </Popover>
            }
            description="The core palette for your videos."
            title="Colors"
          >
            <DialKitSurface targetId={`project-brand-colors-${projectId}`}>
              <div className="grid @min-[480px]:grid-cols-3 grid-cols-1 gap-3">
                {[
                  ...new Set([
                    "background",
                    "foreground",
                    "accent",
                    ...Object.keys(brand.colors),
                  ]),
                ].map((role) => (
                  <ProjectBrandColor
                    key={role}
                    onChange={changeColor}
                    role={role}
                    value={brand.colors[role]}
                  />
                ))}
              </div>
            </DialKitSurface>
          </ProjectSettingsGroup>
          <ProjectSettingsGroup title="Logos">
            <div className="grid @min-[480px]:grid-cols-3 grid-cols-1 gap-3">
              {LOGO_ROLES.map((role) => (
                <div className="grid gap-2" key={role}>
                  <span className="text-muted-foreground text-sm">
                    {
                      {
                        mark: "Brand mark",
                        onDark: "On dark",
                        onLight: "On light",
                      }[role]
                    }
                  </span>
                  <div
                    className="flex h-16 items-center justify-center rounded-md p-3"
                    style={{
                      background: role === "onDark" ? "#181818" : "#ffffff",
                    }}
                  >
                    {brand.logos[role] ? (
                      <Image
                        alt={`${role} logo preview`}
                        className="max-h-full max-w-full object-contain"
                        height={80}
                        onError={imageError}
                        src={convertFileSrc(
                          `${root}/${brand.logos[role].path}`
                        )}
                        unoptimized
                        width={160}
                      />
                    ) : (
                      <span className="text-neutral-500 text-xs">No logo</span>
                    )}
                  </div>
                  <Button
                    onClick={chooseFile}
                    size="sm"
                    type="button"
                    value={`logo:${role}`}
                    variant="secondary"
                  >
                    Choose file
                  </Button>
                  {brand.logos[role] ? (
                    <Button
                      onClick={removeFile}
                      size="sm"
                      type="button"
                      value={`logo:${role}`}
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </ProjectSettingsGroup>
        </div>
        <div className={reviewingImport ? "hidden" : "order-2"}>
          {brandActions}
        </div>
      </TabsPanel>
      <TabsPanel className="grid gap-4" keepMounted value="typography">
        <ProjectSettingsGroup
          description="Choose a family for each role. Open a row to manage styles and licenses."
          title="Fonts"
        >
          {FONT_ROLES.map((role) => {
            const font = brand.typography[role];
            return (
              <details className="group min-w-0" key={role}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[14px] leading-5 outline-offset-4 [&::-webkit-details-marker]:hidden">
                  <span>
                    {
                      {
                        body: "Body text",
                        display: "Headings",
                        mono: "Code & numbers",
                      }[role]
                    }
                  </span>
                  <span className="flex w-[min(280px,50%)] min-w-0 items-center justify-between gap-3 text-muted-foreground text-sm">
                    <span className="truncate">
                      {font?.family || "Not set"}
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 group-open:rotate-180"
                    />
                  </span>
                </summary>
                <div className="grid gap-4 pb-5">
                  <Label className="grid gap-2 text-sm capitalize">
                    {role} font
                    <Input
                      name={`font:${role}:family`}
                      onChange={changeText}
                      placeholder="Not set"
                      value={font?.family ?? ""}
                    />
                  </Label>
                  {font ? (
                    <Label className="grid gap-1 text-sm">
                      Fallback
                      <Input
                        name={`font:${role}:fallback`}
                        onChange={changeText}
                        value={font.fallback}
                      />
                    </Label>
                  ) : null}
                  <Label className="grid gap-2 text-sm">
                    Download weights
                    <Input
                      onChange={changeWeights}
                      placeholder="400;700 or 100..900"
                      value={weights}
                    />
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={chooseFile}
                      type="button"
                      value={`font:${role}`}
                      variant="outline"
                    >
                      Add font file…
                    </Button>
                    <Button
                      disabled={!font?.family}
                      onClick={downloadFont}
                      type="button"
                      value={role}
                      variant="outline"
                    >
                      Download from Google Fonts
                    </Button>
                    <Button
                      disabled={!font?.family}
                      onClick={downloadFont}
                      type="button"
                      value={`${role}:italic`}
                      variant="outline"
                    >
                      Download italic
                    </Button>
                  </div>
                  {font?.files.map((file, index) => (
                    <div
                      className="grid gap-3 rounded-lg bg-background/60 p-3 text-sm"
                      key={file.path}
                    >
                      <span className="break-all">
                        {file.path.split("/").at(-1)}
                      </span>
                      <span className="break-all text-muted-foreground text-xs">
                        Source: {file.source ?? "Local file"}
                      </span>
                      <Label>
                        Weight or variable range
                        <Input
                          name={`face:${role}:${index}:weight`}
                          onChange={changeText}
                          value={file.weight}
                        />
                      </Label>
                      <Label>
                        Style
                        <NativeSelect
                          className="ml-2"
                          name={`face:${role}:${index}:style`}
                          onChange={changeText}
                          value={file.style}
                        >
                          <option>normal</option>
                          <option>italic</option>
                          <option>oblique</option>
                        </NativeSelect>
                      </Label>
                      <Button
                        onClick={removeFile}
                        type="button"
                        value={`face:${role}:${index}`}
                        variant="ghost"
                      >
                        Remove file
                      </Button>
                    </div>
                  ))}
                  {font ? (
                    <>
                      <div className="flex gap-2">
                        <Button
                          onClick={chooseFile}
                          type="button"
                          value={`license:${role}`}
                          variant="ghost"
                        >
                          Add license file…
                        </Button>
                        <Button
                          onClick={removeFile}
                          type="button"
                          value={`font:${role}`}
                          variant="ghost"
                        >
                          Clear font
                        </Button>
                      </div>
                      {font.licenses.map((file) => (
                        <p
                          className="break-all text-muted-foreground text-xs"
                          key={file.path}
                        >
                          License: {file.path.split("/").at(-1)}
                        </p>
                      ))}
                    </>
                  ) : null}
                  {font && font.files.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No local files. Add the required styles for portable
                      rendering.
                    </p>
                  ) : null}
                </div>
              </details>
            );
          })}
        </ProjectSettingsGroup>
        <div className="grid gap-[9px] rounded-md p-4">
          <BrandFontPreview
            className="font-medium text-2xl leading-8 tracking-[-.025em]"
            font={brand.typography.display}
            root={root}
            text="Make something worth watching."
          />
          <BrandFontPreview
            className="text-[14px] text-muted-foreground leading-5"
            font={brand.typography.body}
            root={root}
            text="A preview of your heading and body type. Font files and licenses stay with this project."
          />
        </div>
      </TabsPanel>
      <TabsPanel className="grid gap-4" keepMounted value="guidelines">
        <ProjectSettingsGroup
          description="Guide the wording, logo placement and movement in your videos."
          title="Voice & guidelines"
        >
          {(["description", "preferred", "avoided"] as const).map((key) => (
            <ProjectSettingsRow
              htmlFor={`brand-tone-${key}`}
              key={key}
              layout="multiline"
              title={
                {
                  avoided: "Wording to avoid",
                  description: "Tone of voice",
                  preferred: "Preferred wording",
                }[key]
              }
            >
              <Textarea
                className="min-h-15 w-full rounded-md px-[9px] py-2.5 leading-[18px]"
                id={`brand-tone-${key}`}
                name={`tone:${key}`}
                onChange={changeText}
                value={brand.tone[key]}
              />
            </ProjectSettingsRow>
          ))}
          <ProjectSettingsRow
            htmlFor="brand-logo-rules"
            layout="multiline"
            title="Logo usage rules"
          >
            <Textarea
              className="min-h-15 w-full rounded-md px-[9px] py-2.5 leading-[18px]"
              id="brand-logo-rules"
              name="logoRules"
              onChange={changeText}
              value={brand.logoRules ?? ""}
            />
          </ProjectSettingsRow>
          <ProjectSettingsRow
            htmlFor="brand-motion"
            layout="multiline"
            title="Motion character"
          >
            <Textarea
              className="min-h-15 w-full rounded-md px-[9px] py-2.5 leading-[18px]"
              id="brand-motion"
              name="motion"
              onChange={changeText}
              value={brand.motion ?? ""}
            />
          </ProjectSettingsRow>
        </ProjectSettingsGroup>
        <ProjectSettingsGroup title="Brand management">
          <ProjectSettingsRow
            description="Remove the brand settings from this project."
            title="Clear brand"
          >
            <Button
              disabled={!value}
              onClick={clear}
              type="button"
              variant="ghost"
            >
              Clear brand
            </Button>
          </ProjectSettingsRow>
          {brand.provenance.length ? (
            <details className="group">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 py-1 text-muted-foreground text-sm outline-offset-4 [&::-webkit-details-marker]:hidden">
                <span>Imported sources</span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 group-open:rotate-180"
                />
              </summary>
              <div className="grid gap-2 pb-4">
                {brand.provenance.map((entry) => (
                  <p
                    className="break-all text-muted-foreground text-xs"
                    key={`${entry.field}:${entry.source}`}
                  >
                    {entry.field}: {entry.source}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </ProjectSettingsGroup>
      </TabsPanel>
      {loading ? (
        <p className="text-sm" role="status">
          Importing brand files…
        </p>
      ) : null}
      {error || fileError ? (
        <p className="text-destructive text-sm" role="alert">
          {error ?? fileError}
        </p>
      ) : null}
    </fieldset>
  );
}

function BrandFontPreview({
  font,
  root,
  text,
  className,
}: {
  font: ProjectBrand["typography"][FontRole];
  root: string;
  text: string;
  className: string;
}) {
  const [family, setFamily] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const loaded: FontFace[] = [];
    setFamily(undefined);
    setError(null);
    if (!font) {
      return;
    }
    const name = `brand-${font.files.map((file) => file.hash).join("-")}`;
    Promise.all(
      font.files.map(async (file) => {
        const face = new FontFace(
          name,
          `url(${JSON.stringify(convertFileSrc(`${root}/${file.path}`))})`,
          {
            style: file.style,
            weight: file.weight,
            ...(file.unicodeRange ? { unicodeRange: file.unicodeRange } : {}),
          }
        );
        await face.load();
        if (alive) {
          document.fonts.add(face);
          loaded.push(face);
        }
      })
    )
      .then(() => {
        if (alive && font.files.length > 0) {
          setFamily(name);
        }
      })
      .catch(() => {
        if (alive) {
          setError("A font could not load. Preview is using the fallback.");
        }
      });
    return () => {
      alive = false;
      for (const face of loaded) {
        document.fonts.delete(face);
      }
    };
  }, [font, root]);
  const files = font?.files ?? [];
  const missing =
    files.length && files.every((file) => file.font)
      ? [
          ...new Set(
            [...text].filter(
              (char) =>
                char.trim() &&
                !files.some((file) =>
                  file.font?.coverage.some(([start, end]) => {
                    const code = char.codePointAt(0) ?? 0;
                    return code >= start && code <= end;
                  })
                )
            )
          ),
        ].join(" ")
      : "";
  return (
    <div className="min-w-0">
      <p
        className={className}
        style={{
          fontFamily:
            family ??
            (font
              ? `${JSON.stringify(font.family)}, ${font.fallback}`
              : undefined),
        }}
      >
        {text}
      </p>
      {missing ? (
        <p className="mt-3 break-words text-xs leading-relaxed" role="status">
          Missing glyphs: {missing}. These characters use the fallback.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 break-words text-xs leading-relaxed" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fontFace(file: BrandFile) {
  return {
    ...file,
    axes: file.font?.axes,
    style: file.font?.style ?? ("normal" as const),
    weight: file.font?.weight ?? "400",
  };
}
