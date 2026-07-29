const CLIMB_LIMIT = 8;
const OVERLAY_ATTR = "data-remocn-inspect";

const SVG_NS = "http://www.w3.org/2000/svg";

const REPLACED = new Set([
  "audio",
  "button",
  "canvas",
  "iframe",
  "img",
  "input",
  "select",
  "textarea",
  "video",
]);

const INLINE = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "ruby",
]);

const TRANSPARENT = new Set(["transparent", "rgba(0, 0, 0, 0)"]);
const ZERO_ALPHA = /^rgba\([^)]*,\s*0(\.0+)?\)$/;

export function isTransparent(color: string): boolean {
  const value = color.trim();
  return value.length === 0 || TRANSPARENT.has(value) || ZERO_ALPHA.test(value);
}

function pixels(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function edge(width: string | undefined, color: string | undefined): boolean {
  return pixels(width) > 0 && !isTransparent(color ?? "");
}

export function hasBorder(style: CSSStyleDeclaration): boolean {
  return (
    edge(style.borderTopWidth, style.borderTopColor) ||
    edge(style.borderRightWidth, style.borderRightColor) ||
    edge(style.borderBottomWidth, style.borderBottomColor) ||
    edge(style.borderLeftWidth, style.borderLeftColor)
  );
}

export function coversText(element: Element, x: number, y: number): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) {
      continue;
    }
    if ((node.textContent ?? "").trim().length === 0) {
      continue;
    }

    const range = element.ownerDocument.createRange();
    range.selectNodeContents(node);

    for (const rect of range.getClientRects()) {
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return true;
      }
    }
  }

  return false;
}

export function paintsSurface(style: CSSStyleDeclaration): boolean {
  const image = style.backgroundImage ?? "none";

  if (image !== "none" && image.length > 0) {
    return true;
  }
  if (!isTransparent(style.backgroundColor ?? "")) {
    return true;
  }

  const shadow = style.boxShadow ?? "none";

  if (shadow !== "none" && shadow.length > 0) {
    return true;
  }

  return hasBorder(style);
}

export function isDrawing(element: Element): boolean {
  return element.namespaceURI === SVG_NS;
}

export function svgRootOf(element: Element): Element | null {
  if (!isDrawing(element)) {
    return null;
  }

  let current: Element | null = element;
  let root = element;

  while (current !== null && isDrawing(current)) {
    if (current.localName === "svg") {
      root = current;
    }
    current = current.parentElement;
  }

  return root;
}

export function paints(element: Element, x: number, y: number): boolean {
  if (isDrawing(element) || REPLACED.has(element.localName)) {
    return true;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);

  if (style === undefined) {
    return true;
  }

  return paintsSurface(style) || coversText(element, x, y);
}

export function isInlineWrapper(element: Element): boolean {
  if (isDrawing(element) || REPLACED.has(element.localName)) {
    return false;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);

  if (style === undefined || !INLINE.has(style.display)) {
    return false;
  }

  return !paintsSurface(style);
}

export function climb(element: Element, container: Element): Element {
  const drawing = svgRootOf(element);
  let current =
    drawing !== null && container.contains(drawing) ? drawing : element;

  for (let depth = 0; depth < CLIMB_LIMIT; depth += 1) {
    const parent = current.parentElement;

    if (
      parent === null ||
      parent === container ||
      !container.contains(parent)
    ) {
      return current;
    }
    if (!isInlineWrapper(current)) {
      return current;
    }

    current = parent;
  }

  return current;
}

export function pickAt(
  x: number,
  y: number,
  container: Element,
  exact: boolean
): Element | null {
  const under = container.ownerDocument
    .elementsFromPoint(x, y)
    .filter(
      (element) =>
        container.contains(element) && !element.hasAttribute(OVERLAY_ATTR)
    );

  const [topmost] = under;

  if (topmost === undefined) {
    return null;
  }
  if (exact) {
    return topmost;
  }

  const drawn = under.find((element) => paints(element, x, y)) ?? topmost;

  return climb(drawn, container);
}

export { OVERLAY_ATTR };
