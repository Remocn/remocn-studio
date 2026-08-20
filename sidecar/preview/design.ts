import { Schema } from "effect";

export const DesignFindingCode = Schema.Literals([
  "contrast_aa_failure",
  "text_clipped",
  "text_occluded",
  "text_out_of_frame",
  "timeline_static",
]);

export type DesignFindingCode = (typeof DesignFindingCode)["Type"];

export const DesignSeverity = Schema.Literals(["error", "warning", "info"]);

export type DesignSeverity = (typeof DesignSeverity)["Type"];

export const DesignBox = Schema.Struct({
  height: Schema.Number,
  width: Schema.Number,
  x: Schema.Number,
  y: Schema.Number,
});

export type DesignBox = (typeof DesignBox)["Type"];

export const DesignFinding = Schema.Struct({
  bbox: Schema.NullOr(DesignBox),
  code: DesignFindingCode,
  expected: Schema.String,
  fix: Schema.String,
  frames: Schema.Array(Schema.Int),
  message: Schema.String,
  observed: Schema.String,
  selector: Schema.NullOr(Schema.String),
  severity: DesignSeverity,
  text: Schema.NullOr(Schema.String),
});

export type DesignFinding = (typeof DesignFinding)["Type"];

export const DesignSnapshot = Schema.Struct({
  frame: Schema.Int,
  path: Schema.NonEmptyString,
});

export type DesignSnapshot = (typeof DesignSnapshot)["Type"];

export const DesignSummary = Schema.Struct({
  errors: Schema.Int,
  info: Schema.Int,
  warnings: Schema.Int,
});

export const DesignResult = Schema.Struct({
  composition: Schema.NonEmptyString,
  findings: Schema.Array(DesignFinding),
  frames: Schema.Array(Schema.Int),
  height: Schema.Int,
  snapshots: Schema.Array(DesignSnapshot),
  summary: DesignSummary,
  width: Schema.Int,
});

export type DesignResult = (typeof DesignResult)["Type"];

export interface BrowserDesignFinding {
  readonly bbox: DesignBox;
  readonly code: Exclude<DesignFindingCode, "timeline_static">;
  readonly expected: string;
  readonly fix: string;
  readonly frame: number;
  readonly message: string;
  readonly observed: string;
  readonly selector: string;
  readonly text: string;
  readonly type: "contrast" | "layer";
}

export interface FrameDesignAudit {
  readonly findings: readonly BrowserDesignFinding[];
  readonly fingerprint: string;
}

export interface PreparedDesignAudit {
  readonly candidates: readonly ContrastCandidate[];
  readonly findings: readonly BrowserDesignFinding[];
  readonly fingerprint: string;
}

interface ContrastCandidate {
  readonly bbox: DesignBox;
  readonly fg: readonly [number, number, number, number];
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly selector: string;
  readonly stroke: readonly [number, number, number, number] | null;
  readonly text: string;
}

interface Rgba {
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly r: number;
}

interface CollapsedFinding {
  readonly bbox: DesignBox;
  readonly code: Exclude<DesignFindingCode, "timeline_static">;
  readonly expected: string;
  readonly fix: string;
  readonly frames: readonly number[];
  readonly message: string;
  readonly observed: string;
  readonly selector: string;
  readonly text: string;
  readonly type: "contrast" | "layer";
}

export function parseCssColor(value: string): Rgba | null {
  const values = value.match(/[\d.]+/g)?.map(Number) ?? [];
  if (values.length < 3 || values.some((entry) => !Number.isFinite(entry))) {
    return null;
  }

  return {
    a: clamp(values[3] ?? 1, 0, 1),
    b: clamp(values[2] ?? 0, 0, 255),
    g: clamp(values[1] ?? 0, 0, 255),
    r: clamp(values[0] ?? 0, 0, 255),
  };
}

export function composite(foreground: Rgba, background: Rgba): Rgba {
  return {
    a: 1,
    b: Math.round(
      foreground.b * foreground.a + background.b * (1 - foreground.a)
    ),
    g: Math.round(
      foreground.g * foreground.a + background.g * (1 - foreground.a)
    ),
    r: Math.round(
      foreground.r * foreground.a + background.r * (1 - foreground.a)
    ),
  };
}

export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + 0.05) / (low + 0.05);
}

export function requiredContrastRatio(
  fontSize: number,
  fontWeight: number
): 3 | 4.5 {
  return fontSize >= 24 || (fontSize >= 19 && fontWeight >= 700) ? 3 : 4.5;
}

export function finishDesignResult(input: {
  readonly audits: readonly { frame: number; audit: FrameDesignAudit }[];
  readonly composition: string;
  readonly height: number;
  readonly snapshots: readonly DesignSnapshot[];
  readonly width: number;
}): DesignResult {
  const frames = [...new Set(input.audits.map(({ frame }) => frame))].sort(
    (left, right) => left - right
  );
  const collected = collapseFindings(
    input.audits.flatMap(({ audit }) => audit.findings)
  ).map(toFinding);
  const fingerprints = input.audits.map(({ audit }) => audit.fingerprint);

  if (
    frames.length >= 2 &&
    fingerprints.length === frames.length &&
    fingerprints.every((fingerprint) => fingerprint === fingerprints[0])
  ) {
    collected.push({
      bbox: null,
      code: "timeline_static",
      expected:
        "At least one visible DOM or media change across the sampled frames.",
      fix: "Inspect the snapshots and confirm that the composition seeks its animation from the Remotion frame. Explain the hold if it is intentional.",
      frames,
      message: "The sampled timeline did not visibly advance.",
      observed: "Every sampled frame had the same visual fingerprint.",
      selector: null,
      severity: "warning",
      text: null,
    });
  }

  return {
    composition: input.composition,
    findings: collected,
    frames,
    height: input.height,
    snapshots: [...input.snapshots],
    summary: {
      errors: collected.filter(({ severity }) => severity === "error").length,
      info: collected.filter(({ severity }) => severity === "info").length,
      warnings: collected.filter(({ severity }) => severity === "warning")
        .length,
    },
    width: input.width,
  };
}

function collapseFindings(
  findings: readonly BrowserDesignFinding[]
): CollapsedFinding[] {
  const grouped = new Map<string, BrowserDesignFinding[]>();

  for (const finding of findings) {
    const key = [
      finding.type,
      finding.code,
      finding.selector,
      finding.text,
    ].join("|");
    const rows = grouped.get(key) ?? [];
    rows.push(finding);
    grouped.set(key, rows);
  }

  return [...grouped.values()].map((rows) => {
    const [first] = rows;
    if (first === undefined) {
      throw new Error("a design finding group cannot be empty");
    }

    return {
      ...first,
      frames: [...new Set(rows.map(({ frame }) => frame))].sort(
        (left, right) => left - right
      ),
    };
  });
}

function toFinding(finding: CollapsedFinding): DesignFinding {
  const held = finding.frames.length >= 2;
  return {
    bbox: finding.bbox,
    code: finding.code,
    expected: finding.expected,
    fix: finding.fix,
    frames: [...finding.frames],
    message: finding.message,
    observed: finding.observed,
    selector: finding.selector,
    severity: severityFor(finding.type, held),
    text: finding.text,
  };
}

function severityFor(
  type: CollapsedFinding["type"],
  held: boolean
): DesignSeverity {
  if (held) {
    return "error";
  }
  return type === "contrast" ? "warning" : "info";
}

function relativeLuminance(color: Rgba): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.039_28
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// This function is serialized into the Remotion render page. Keep its runtime
// dependencies inside the function: imports and module closures do not cross
// the browser boundary.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the serialized browser function must carry every helper across the page boundary
export function prepareDesignAudit(frame: number): PreparedDesignAudit {
  interface Restore {
    color: string;
    colorPriority: string;
    element: HTMLElement | SVGElement;
    fill: string | null;
    fillPriority: string | null;
    stroke: string | null;
    strokePriority: string | null;
    transition: string;
    transitionPriority: string;
  }

  type AuditWindow = Window & {
    __remocnDesignRestores?: Restore[];
  };

  const auditWindow = window as AuditWindow;
  const tolerance = 2;

  const round = (value: number) => Math.round(value * 100) / 100;
  const box = (rect: DOMRect): DesignBox => ({
    height: round(rect.height),
    width: round(rect.width),
    x: round(rect.x),
    y: round(rect.y),
  });
  const color = (
    value: string
  ): readonly [number, number, number, number] | null => {
    const values = value.match(/[\d.]+/g)?.map(Number) ?? [];
    if (values.length < 3 || values.some((entry) => !Number.isFinite(entry))) {
      return null;
    }
    return [
      Math.min(255, Math.max(0, values[0] ?? 0)),
      Math.min(255, Math.max(0, values[1] ?? 0)),
      Math.min(255, Math.max(0, values[2] ?? 0)),
      Math.min(1, Math.max(0, values[3] ?? 1)),
    ];
  };
  const ownText = (element: Element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .trim();
  const opacity = (element: Element) => {
    let value = 1;
    let current: Element | null = element;
    while (current !== null && current !== document.documentElement) {
      const styles = getComputedStyle(current);
      if (styles.display === "none" || styles.visibility === "hidden") {
        return 0;
      }
      value *= Number.parseFloat(styles.opacity || "1");
      current = current.parentElement;
    }
    return value;
  };
  const selector = (element: Element) => {
    const designId = element.getAttribute("data-design-id");
    if (designId) {
      return `[data-design-id="${designId.replaceAll('"', '\\"')}"]`;
    }
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    const parts: string[] = [];
    let current: Element | null = element;
    while (current !== null && current !== document.body && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter(
            (entry) => entry.tagName === current?.tagName
          )
        : [];
      const suffix =
        siblings.length > 1
          ? `:nth-of-type(${siblings.indexOf(current) + 1})`
          : "";
      parts.unshift(`${tag}${suffix}`);
      current = current.parentElement;
    }
    return parts.join(" > ") || element.tagName.toLowerCase();
  };
  const textRect = (element: Element): DOMRect | null => {
    const range = document.createRange();
    const nodes = [...element.childNodes].filter(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        (node.textContent ?? "").trim().length > 0
    );
    if (nodes.length === 0) {
      return null;
    }

    range.setStart(nodes[0] as Node, 0);
    const last = nodes.at(-1) as Node;
    range.setEnd(last, last.textContent?.length ?? 0);
    const rects = [...range.getClientRects()].filter(
      (rect) => rect.width > 0 && rect.height > 0
    );
    if (rects.length === 0) {
      return null;
    }

    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return new DOMRect(left, top, right - left, bottom - top);
  };
  const visible = (element: Element, rect: DOMRect) =>
    opacity(element) > 0.01 &&
    rect.width >= 8 &&
    rect.height >= 8 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight;
  const clips = (styles: CSSStyleDeclaration) =>
    [styles.overflow, styles.overflowX, styles.overflowY].some(
      (value) => value !== "visible" && value !== "clip visible"
    );
  const painted = (element: Element) => {
    const styles = getComputedStyle(element);
    const background = color(styles.backgroundColor);
    const tag = element.tagName.toLowerCase();
    return (
      opacity(element) > 0.01 &&
      ((background?.[3] ?? 0) > 0.01 ||
        styles.boxShadow !== "none" ||
        styles.borderTopWidth !== "0px" ||
        ownText(element).length > 0 ||
        ["canvas", "img", "svg", "video"].includes(tag))
    );
  };
  const related = (left: Element, right: Element) =>
    left === right || left.contains(right) || right.contains(left);
  const occludedFraction = (element: Element, rect: DOMRect) => {
    const insetX = Math.min(4, rect.width / 4);
    const insetY = Math.min(4, rect.height / 4);
    const points = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + insetX, rect.top + insetY],
      [rect.right - insetX, rect.top + insetY],
      [rect.left + insetX, rect.bottom - insetY],
      [rect.right - insetX, rect.bottom - insetY],
    ];
    let covered = 0;
    for (const [x, y] of points) {
      if (
        x === undefined ||
        y === undefined ||
        x < 0 ||
        y < 0 ||
        x >= window.innerWidth ||
        y >= window.innerHeight
      ) {
        continue;
      }
      const hits = document.elementsFromPoint(x, y);
      const ownIndex = hits.findIndex((hit) => related(hit, element));
      if (ownIndex > 0 && hits.slice(0, ownIndex).some((hit) => painted(hit))) {
        covered += 1;
      }
    }
    return covered / points.length;
  };
  const hash = (value: string) => {
    let result = 0;
    for (let index = 0; index < value.length; index += 1) {
      result = (result * 31 + value.charCodeAt(index)) % 4_294_967_296;
    }
    return String(result);
  };
  const mediaHash = (element: HTMLCanvasElement | HTMLVideoElement) => {
    try {
      const rect = element.getBoundingClientRect();
      const sourceWidth =
        element instanceof HTMLVideoElement
          ? element.videoWidth
          : element.width || rect.width;
      const sourceHeight =
        element instanceof HTMLVideoElement
          ? element.videoHeight
          : element.height || rect.height;
      if (!(sourceWidth && sourceHeight)) {
        return "empty";
      }
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      const context = canvas.getContext("2d");
      if (context === null) {
        return "unreadable";
      }
      context.drawImage(element, 0, 0, 8, 8);
      const pixels = context.getImageData(0, 0, 8, 8).data;
      let result = 0;
      for (const pixel of pixels) {
        result = (result * 31 + pixel) % 4_294_967_296;
      }
      return String(result);
    } catch {
      return "unreadable";
    }
  };

  const findings: BrowserDesignFinding[] = [];
  const candidates: ContrastCandidate[] = [];
  const restores: Restore[] = [];
  auditWindow.__remocnDesignRestores = restores;

  const elements = [...document.body.querySelectorAll("*")];
  const fingerprint = elements
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return visible(element, rect);
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return [
        round(rect.left),
        round(rect.top),
        round(rect.width),
        round(rect.height),
        round(opacity(element)),
        styles.transform,
        styles.backgroundColor,
        styles.color,
        styles.fill,
        styles.stroke,
        hash(element.textContent ?? ""),
      ].join(",");
    });
  for (const media of document.body.querySelectorAll("canvas, video")) {
    const rect = media.getBoundingClientRect();
    if (
      visible(media, rect) &&
      (media instanceof HTMLCanvasElement || media instanceof HTMLVideoElement)
    ) {
      fingerprint.push(`pixels:${mediaHash(media)}`);
    }
  }

  for (const element of elements) {
    if (element.closest('[data-design-check="ignore"]')) {
      continue;
    }
    const text = ownText(element);
    if (text.length === 0) {
      continue;
    }
    const rect = textRect(element);
    if (rect === null || !visible(element, rect)) {
      continue;
    }

    const selected = selector(element);
    const finding = (
      code: BrowserDesignFinding["code"],
      message: string,
      observed: string,
      expected: string,
      fix: string
    ) =>
      findings.push({
        bbox: box(rect),
        code,
        expected,
        fix,
        frame,
        message,
        observed,
        selector: selected,
        text: text.slice(0, 80),
        type: "layer",
      });

    if (
      rect.left < -tolerance ||
      rect.top < -tolerance ||
      rect.right > window.innerWidth + tolerance ||
      rect.bottom > window.innerHeight + tolerance
    ) {
      finding(
        "text_out_of_frame",
        "Readable text extends outside the composition.",
        `Text box is ${round(rect.left)},${round(rect.top)} to ${round(rect.right)},${round(rect.bottom)}.`,
        `Text inside 0,0 to ${window.innerWidth},${window.innerHeight}.`,
        "Move or resize the text so its readable box stays inside the frame."
      );
    }

    let ancestor: Element | null = element;
    while (ancestor !== null && ancestor !== document.body) {
      const styles = getComputedStyle(ancestor);
      if (clips(styles)) {
        const container = ancestor.getBoundingClientRect();
        if (
          rect.left < container.left - tolerance ||
          rect.top < container.top - tolerance ||
          rect.right > container.right + tolerance ||
          rect.bottom > container.bottom + tolerance
        ) {
          finding(
            "text_clipped",
            "Readable text is clipped by its box or an ancestor.",
            `Text exceeds ${selector(ancestor)}.`,
            "The complete text range inside every clipping box.",
            "Increase the box, allow wrapping, reduce the type size, or remove accidental clipping."
          );
          break;
        }
      }
      ancestor = ancestor.parentElement;
    }

    const covered = occludedFraction(element, rect);
    if (covered >= 0.6) {
      finding(
        "text_occluded",
        "Another painted layer covers most of this text.",
        `${Math.round(covered * 100)}% of probes were covered.`,
        "Less than 60% of text probes covered by unrelated layers.",
        'Correct the layer order or mark the narrow intentional exception with data-design-check="ignore".'
      );
    }

    const styles = getComputedStyle(element);
    const isSvgText = element instanceof SVGTextElement;
    const foreground = color(isSvgText ? styles.fill : styles.color);
    if (foreground === null || foreground[3] <= 0.01) {
      continue;
    }
    const strokeWidth = Number.parseFloat(styles.webkitTextStrokeWidth || "0");
    const stroke =
      strokeWidth > 0 ? color(styles.webkitTextStrokeColor || "") : null;
    candidates.push({
      bbox: box(rect),
      fg: foreground,
      fontSize: Number.parseFloat(styles.fontSize || "0"),
      fontWeight: Number(styles.fontWeight) || 400,
      selector: selected,
      stroke,
      text: text.slice(0, 80),
    });

    const writable = element as HTMLElement | SVGElement;
    const transition = writable.style.getPropertyValue("transition");
    const transitionPriority = writable.style.getPropertyPriority("transition");
    const originalColor = writable.style.getPropertyValue("color");
    const colorPriority = writable.style.getPropertyPriority("color");
    const fill = isSvgText ? writable.style.getPropertyValue("fill") : null;
    const fillPriority = isSvgText
      ? writable.style.getPropertyPriority("fill")
      : null;
    const hasStroke = stroke !== null && stroke[3] > 0.01;
    const originalStroke = hasStroke
      ? writable.style.getPropertyValue("-webkit-text-stroke-color")
      : null;
    const strokePriority = hasStroke
      ? writable.style.getPropertyPriority("-webkit-text-stroke-color")
      : null;
    writable.style.setProperty("transition", "none", "important");
    writable.style.setProperty("color", "transparent", "important");
    if (isSvgText) {
      writable.style.setProperty("fill", "transparent", "important");
    }
    if (hasStroke) {
      writable.style.setProperty(
        "-webkit-text-stroke-color",
        "transparent",
        "important"
      );
    }
    restores.push({
      color: originalColor,
      colorPriority,
      element: writable,
      fill,
      fillPriority,
      stroke: originalStroke,
      strokePriority,
      transition,
      transitionPriority,
    });
  }

  return { candidates, findings, fingerprint: fingerprint.join("|") };
}

// This function is serialized into the render page. It restores text before
// image decoding so a malformed screenshot cannot poison the warm session.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the serialized browser function must decode and sample without module closures
export async function finishDesignContrast(
  pngBase64: string,
  frame: number,
  candidates: readonly ContrastCandidate[]
): Promise<readonly BrowserDesignFinding[]> {
  interface Restore {
    color: string;
    colorPriority: string;
    element: HTMLElement | SVGElement;
    fill: string | null;
    fillPriority: string | null;
    stroke: string | null;
    strokePriority: string | null;
    transition: string;
    transitionPriority: string;
  }
  type AuditWindow = Window & {
    __remocnDesignRestores?: Restore[];
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: exact restoration handles each independently optional inline paint property
  const restore = () => {
    const auditWindow = window as AuditWindow;
    const restores = auditWindow.__remocnDesignRestores ?? [];
    for (const row of restores) {
      if (row.color.length > 0) {
        row.element.style.setProperty("color", row.color, row.colorPriority);
      } else {
        row.element.style.removeProperty("color");
      }
      if (row.fill !== null) {
        if (row.fill.length > 0) {
          row.element.style.setProperty(
            "fill",
            row.fill,
            row.fillPriority ?? ""
          );
        } else {
          row.element.style.removeProperty("fill");
        }
      }
      if (row.stroke !== null) {
        if (row.stroke.length > 0) {
          row.element.style.setProperty(
            "-webkit-text-stroke-color",
            row.stroke,
            row.strokePriority ?? ""
          );
        } else {
          row.element.style.removeProperty("-webkit-text-stroke-color");
        }
      }
      if (row.transition.length > 0) {
        row.element.style.setProperty(
          "transition",
          row.transition,
          row.transitionPriority
        );
      } else {
        row.element.style.removeProperty("transition");
      }
    }
    auditWindow.__remocnDesignRestores = [];
  };
  const luminance = (red: number, green: number, blue: number) => {
    const channel = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.039_28
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    );
  };
  const ratio = (
    first: readonly [number, number, number],
    second: readonly [number, number, number]
  ) => {
    const left = luminance(...first);
    const right = luminance(...second);
    return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
  };
  const median = (values: readonly number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };

  restore();

  const image = new Image();
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = `data:image/png;base64,${pngBase64}`;
  });
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("the contrast measurement PNG could not be decoded");
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error(
      "the render browser has no 2D canvas for contrast sampling"
    );
  }
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const findings: BrowserDesignFinding[] = [];

  for (const candidate of candidates) {
    const x0 = Math.max(0, Math.round(candidate.bbox.x) + 1);
    const x1 = Math.min(
      canvas.width - 1,
      Math.round(candidate.bbox.x + candidate.bbox.width) - 1
    );
    const y0 = Math.max(0, Math.round(candidate.bbox.y) + 1);
    const y1 = Math.min(
      canvas.height - 1,
      Math.round(candidate.bbox.y + candidate.bbox.height) - 1
    );
    if (x1 <= x0 || y1 <= y0) {
      continue;
    }
    const stepX = Math.max(1, Math.floor((x1 - x0) / 12));
    const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
    const red: number[] = [];
    const green: number[] = [];
    const blue: number[] = [];
    const alpha: number[] = [];
    for (let y = y0; y <= y1; y += stepY) {
      for (let x = x0; x <= x1; x += stepX) {
        const index = (y * canvas.width + x) * 4;
        red.push(pixels[index] ?? 0);
        green.push(pixels[index + 1] ?? 0);
        blue.push(pixels[index + 2] ?? 0);
        alpha.push(pixels[index + 3] ?? 0);
      }
    }
    if (red.length === 0 || median(alpha) < 255) {
      continue;
    }

    const background: readonly [number, number, number] = [
      median(red),
      median(green),
      median(blue),
    ];
    const paint = (
      value: readonly [number, number, number, number]
    ): readonly [number, number, number] => [
      Math.round(value[0] * value[3] + background[0] * (1 - value[3])),
      Math.round(value[1] * value[3] + background[1] * (1 - value[3])),
      Math.round(value[2] * value[3] + background[2] * (1 - value[3])),
    ];
    let foreground = paint(candidate.fg);
    let measured = ratio(foreground, background);
    if (candidate.stroke !== null) {
      const stroked = paint(candidate.stroke);
      const strokeRatio = ratio(stroked, background);
      if (strokeRatio > measured) {
        foreground = stroked;
        measured = strokeRatio;
      }
    }
    const required =
      candidate.fontSize >= 24 ||
      (candidate.fontSize >= 19 && candidate.fontWeight >= 700)
        ? 3
        : 4.5;
    if (measured >= required) {
      continue;
    }
    const rounded = Math.round(measured * 100) / 100;
    findings.push({
      bbox: candidate.bbox,
      code: "contrast_aa_failure",
      expected: `WCAG AA contrast of at least ${required}:1.`,
      fix: "Brighten the foreground on a dark background or darken it on a light background, staying inside the chosen palette.",
      frame,
      message: `Text contrast is ${rounded}:1; WCAG AA requires ${required}:1.`,
      observed: `Foreground rgb(${foreground.join(",")}) on background rgb(${background.join(",")}).`,
      selector: candidate.selector,
      text: candidate.text,
      type: "contrast",
    });
  }

  return findings;
}

export function restoreDesignAudit(): void {
  interface Restore {
    color: string;
    colorPriority: string;
    element: HTMLElement | SVGElement;
    fill: string | null;
    fillPriority: string | null;
    stroke: string | null;
    strokePriority: string | null;
    transition: string;
    transitionPriority: string;
  }
  type AuditWindow = Window & {
    __remocnDesignRestores?: Restore[];
  };

  const auditWindow = window as AuditWindow;
  const restores = auditWindow.__remocnDesignRestores ?? [];
  for (const row of restores) {
    if (row.color.length > 0) {
      row.element.style.setProperty("color", row.color, row.colorPriority);
    } else {
      row.element.style.removeProperty("color");
    }
    if (row.fill !== null) {
      if (row.fill.length > 0) {
        row.element.style.setProperty("fill", row.fill, row.fillPriority ?? "");
      } else {
        row.element.style.removeProperty("fill");
      }
    }
    if (row.stroke !== null) {
      if (row.stroke.length > 0) {
        row.element.style.setProperty(
          "-webkit-text-stroke-color",
          row.stroke,
          row.strokePriority ?? ""
        );
      } else {
        row.element.style.removeProperty("-webkit-text-stroke-color");
      }
    }
    if (row.transition.length > 0) {
      row.element.style.setProperty(
        "transition",
        row.transition,
        row.transitionPriority
      );
    } else {
      row.element.style.removeProperty("transition");
    }
  }
  auditWindow.__remocnDesignRestores = [];
}
