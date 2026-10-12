import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import ts from "typescript";
import type { ShaderSlotReport } from "@/shared/shader-target";
import { isRemoved, type StudioDocument } from "@/shared/studio-document";
import { ShaderError, shaderIO } from "../library/shaders";
import { contained, hashBytes } from "./config";
import type { ShaderSourceEdit } from "./shader-targets";

type Element = ts.JsxElement | ts.JsxSelfClosingElement;
type Constant = number | Readonly<Record<string, number>>;
interface Module {
  readonly ast: ts.SourceFile;
  readonly imports: Map<string, { name: string; path: string }>;
  readonly path: string;
  readonly text: string;
}
interface Patch {
  readonly end: number;
  readonly start: number;
  readonly text: string;
}
export type PlannedShaderScene = Omit<
  ShaderSlotReport,
  "sourceRevision" | "occurrences"
> & { readonly source: string };
const RUNTIME = /^src\/lib\/studio-objects-v([56])(?:\/index(?:\.tsx)?)?$/;
const JS_EXTENSION = /\.jsx?$/;
const INDEX_SUFFIX = /\/index$/;
const CODE = /\.[cm]?[jt]sx?$/;
const SEQUENCES = new Set([
  "remotion:Sequence",
  "remotion:Series.Sequence",
  "@remotion/transitions:TransitionSeries.Sequence",
]);

function refuse(message: string): never {
  throw new ShaderError({
    message: `This video's authored structure has no verified shader slot. ${message} Studio has not changed the video.`,
  });
}
function opening(node: Element) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}
function children(node: ts.JsxElement) {
  return node.children.filter(
    (child) =>
      !(
        (ts.isJsxText(child) && child.text.trim() === "") ||
        (ts.isJsxExpression(child) && !child.expression)
      )
  );
}
function visit(node: ts.Node, predicate: (node: ts.Node) => void) {
  predicate(node);
  node.forEachChild((child) => visit(child, predicate));
}
function unwrap(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node;
}
function attribute(node: Element, name: string) {
  return opening(node).attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText() === name
  );
}
function expression(node: Element, name: string): ts.Expression | undefined {
  const value = attribute(node, name)?.initializer;
  if (value && ts.isJsxExpression(value)) {
    return value.expression;
  }
  return value && ts.isStringLiteral(value) ? value : undefined;
}
function canonical(module: Module, name: string) {
  const [head, ...tail] = name.split(".");
  const imported = module.imports.get(head);
  return imported
    ? `${imported.path}:${[imported.name, ...tail].join(".")}`
    : name;
}
function constant(
  modules: Map<string, Module>,
  module: Module,
  input: ts.Expression,
  seen = new Set<string>()
): Constant {
  const node = unwrap(input);
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  ) {
    return -number(modules, module, node.operand, seen);
  }
  if (ts.isPropertyAccessExpression(node)) {
    const value = constant(modules, module, node.expression, seen);
    if (typeof value === "object" && Object.hasOwn(value, node.name.text)) {
      return value[node.name.text];
    }
  }
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) {
          return refuse(
            "The scene timing object needs explicit numeric properties."
          );
        }
        return [
          property.name.getText().replaceAll('"', "").replaceAll("'", ""),
          number(modules, module, property.initializer, seen),
        ];
      })
    );
  }
  if (ts.isBinaryExpression(node)) {
    const left = number(modules, module, node.left, seen);
    const right = number(modules, module, node.right, seen);
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken:
        return left + right;
      case ts.SyntaxKind.MinusToken:
        return left - right;
      case ts.SyntaxKind.AsteriskToken:
        return left * right;
      case ts.SyntaxKind.SlashToken:
        return left / right;
      default:
        break;
    }
  }
  if (ts.isIdentifier(node)) {
    return identifierConstant(modules, module, node, seen);
  }
  return refuse(
    "Scene timing is computed dynamically and needs explicit preparation."
  );
}
function identifierConstant(
  modules: Map<string, Module>,
  module: Module,
  node: ts.Identifier,
  seen: Set<string>
): Constant {
  const key = `${module.path}:${node.text}`;
  if (seen.has(key)) {
    return refuse("Scene timing has a circular dependency.");
  }
  const next = new Set([...seen, key]);
  const imported = module.imports.get(node.text);
  if (imported) {
    const owner = modules.get(imported.path);
    if (owner) {
      return constant(
        modules,
        owner,
        ts.factory.createIdentifier(imported.name),
        next
      );
    }
  }
  for (const statement of module.ast.statements) {
    if (
      !(
        ts.isVariableStatement(statement) &&
        statement.declarationList.flags === ts.NodeFlags.Const
      )
    ) {
      continue;
    }
    const declaration = statement.declarationList.declarations.find(
      (item) => ts.isIdentifier(item.name) && item.name.text === node.text
    );
    if (declaration?.initializer) {
      return constant(modules, module, declaration.initializer, next);
    }
  }
  return refuse(
    "Scene timing is computed dynamically and needs explicit preparation."
  );
}
function number(
  modules: Map<string, Module>,
  module: Module,
  node: ts.Expression,
  seen?: Set<string>
): number {
  const value = constant(modules, module, node, seen);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return refuse("Scene timing must resolve to a finite number.");
  }
  return value;
}
function frames(value: number, zero = false) {
  if (!Number.isInteger(value) || value < (zero ? 0 : 1)) {
    return refuse("Scene timing must use valid whole frames.");
  }
  return value;
}
function relativeImport(path: string, target: string) {
  const relative = posix
    .relative(posix.dirname(path), target)
    .replace(CODE, "");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

async function exists(root: string, path: string) {
  return readFile(await contained(root, path), "utf8").then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        return false;
      }
      throw error;
    }
  );
}
async function resolveSource(root: string, base: string) {
  const stem = base.replace(JS_EXTENSION, "");
  const candidates = CODE.test(stem)
    ? [stem]
    : [`${stem}.tsx`, `${stem}.ts`, `${stem}/index.tsx`, `${stem}/index.ts`];
  const matches = await Promise.all(
    candidates.map((path) => exists(root, path))
  );
  const found = candidates.find((_, index) => matches[index]);
  if (!found) {
    return refuse(`The local module ${base} could not be checked.`);
  }
  return found;
}
function bindImports(
  module: Module,
  clause: ts.ImportClause | undefined,
  path: string
) {
  if (clause?.name) {
    module.imports.set(clause.name.text, { name: "default", path });
  }
  const bindings = clause?.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) {
    for (const binding of bindings.elements) {
      module.imports.set(binding.name.text, {
        name: binding.propertyName?.text ?? binding.name.text,
        path,
      });
    }
  } else if (bindings) {
    module.imports.set(bindings.name.text, { name: "*", path });
  }
}
async function graph(root: string, folder: string) {
  const modules = new Map<string, Module>();
  async function dependency(module: Module, statement: ts.Statement) {
    if (
      !(
        (ts.isImportDeclaration(statement) ||
          ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      )
    ) {
      return;
    }
    const specifier = statement.moduleSpecifier.text;
    let importedPath = specifier;
    if (specifier.startsWith(".")) {
      const base = posix.normalize(
        posix.join(posix.dirname(module.path), specifier)
      );
      if (RUNTIME.test(base)) {
        if (!module.path.startsWith(`${folder}/`)) {
          refuse("A shared component reads the old managed runtime.");
        }
        importedPath = base;
      } else if (base.endsWith(".json")) {
        importedPath = base;
      } else {
        importedPath = await resolveSource(root, base);
        await load(importedPath);
      }
    } else if (specifier.startsWith("@/") || specifier.startsWith("/")) {
      refuse("Project aliases need explicit preparation.");
    }
    bindImports(
      module,
      ts.isImportDeclaration(statement) ? statement.importClause : undefined,
      importedPath
    );
  }
  async function load(path: string): Promise<Module> {
    const existing = modules.get(path);
    if (existing) {
      return existing;
    }
    if (modules.size >= 128) {
      return refuse("The source graph is too large for automatic preparation.");
    }
    const text = await readFile(await contained(root, path), "utf8");
    const module: Module = {
      ast: ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      ),
      imports: new Map(),
      path,
      text,
    };
    modules.set(path, module);
    for (const statement of module.ast.statements) {
      // biome-ignore lint/performance/noAwaitInLoops: Resolve the recursive graph in source order, including cycles.
      await dependency(module, statement);
    }
    visit(module.ast, (node) => {
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          node.expression.getText() === "require")
      ) {
        refuse("Dynamic local modules need explicit preparation.");
      }
    });
    return module;
  }
  const entry = await load(`${folder}/index.tsx`);
  return { entry, modules };
}

export const shaderSourceBindings = (root: string, folder: string) =>
  shaderIO(async () => {
    const { modules } = await graph(root, folder);
    const sources: Record<string, string> = Object.fromEntries(
      [...modules.values()].map((module) => [
        module.path,
        hashBytes(module.text),
      ])
    );
    const data = new Set(
      [...modules.values()]
        .flatMap((module) =>
          [...module.imports.values()].map((binding) => binding.path)
        )
        .filter(
          (path) =>
            path.startsWith("src/") &&
            path.endsWith(".json") &&
            path !== `${folder}/studio.json` &&
            path !== `${folder}/studio-shaders.json`
        )
    );
    const files = await Promise.all(
      [...data].map(
        async (path) =>
          [
            path,
            hashBytes(await readFile(await contained(root, path))),
          ] as const
      )
    );
    return { ...sources, ...Object.fromEntries(files) };
  });

function sceneRoot(module: Module, name: string, document: StudioDocument) {
  const declaration = module.ast.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) &&
      (node.name?.text === name ||
        (name === "default" &&
          node.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.DefaultKeyword
          ) === true))
  );
  if (!declaration?.body) {
    return refuse(
      "Scene components need an explicit function body for automatic preparation."
    );
  }
  const returns = declaration.body.statements.filter(ts.isReturnStatement);
  if (returns.length !== 1 || !returns[0].expression) {
    return refuse("Conditional scene roots need explicit preparation.");
  }
  const root = unwrap(returns[0].expression);
  if (
    !ts.isJsxElement(root) ||
    canonical(module, root.openingElement.tagName.getText()) !==
      "remotion:AbsoluteFill"
  ) {
    const tag = ts.isJsxElement(root)
      ? root.openingElement.tagName.getText()
      : root.getText().slice(0, 120);
    return refuse(
      `${module.path}: ${name} returns ${tag}. The scene needs a verified frame-sized root: return AbsoluteFill directly, bind it with useStudioObject("<existing scene ID>").bind, and preserve the wrapper's styles and children. Custom wrappers such as SceneRoot must be expanded inside this scene component.`
    );
  }
  const id = boundScene(module, declaration.body, root, document);
  if (!id) {
    return refuse(
      "The scene root needs a unique, active managed scene identity."
    );
  }
  return { id, root };
}

function boundScene(
  module: Module,
  body: ts.Block,
  root: ts.JsxElement,
  document: StudioDocument
) {
  let id: string | undefined;
  for (const statement of body.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const variable of statement.declarationList.declarations) {
      const init = variable.initializer;
      if (
        !(
          ts.isIdentifier(variable.name) &&
          init &&
          ts.isCallExpression(init) &&
          ts.isIdentifier(init.expression)
        )
      ) {
        continue;
      }
      const hook = module.imports.get(init.expression.text);
      if (
        !(hook && RUNTIME.test(hook.path)) ||
        hook.name !== "useStudioObject" ||
        init.arguments.length !== 1 ||
        !ts.isStringLiteral(init.arguments[0])
      ) {
        continue;
      }
      const sceneId = init.arguments[0].text;
      const binding = `${variable.name.text}.bind`;
      if (
        root.openingElement.attributes.properties.some(
          (attr) =>
            ts.isJsxSpreadAttribute(attr) &&
            attr.expression.getText() === binding
        ) &&
        document.objects.some(
          (object) => object.id === sceneId && object.definition === "scene"
        ) &&
        !isRemoved(document.objects, sceneId)
      ) {
        id = sceneId;
      }
    }
  }
  return id;
}

function plan(
  modules: Map<string, Module>,
  entry: Module,
  folder: string,
  document: StudioDocument
) {
  const patches = new Map<string, Patch[]>();
  const add = (module: Module, start: number, end: number, text: string) => {
    const list = patches.get(module.path) ?? [];
    list.push({ end, start, text });
    patches.set(module.path, list);
  };
  const scenes: PlannedShaderScene[] = [];
  const meta = entry.ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations])
    .find((d) => d.name.getText() === "meta")?.initializer;
  if (!meta) {
    return refuse("The video has no explicit metadata.");
  }
  const metadata = constant(modules, entry, meta);
  if (typeof metadata !== "object") {
    return refuse("The video metadata is not a supported object.");
  }
  const durationInFrames = frames(metadata.durationInFrames);
  const { fps } = metadata;
  if (!(fps > 0)) {
    return refuse("The video needs a valid frame rate.");
  }
  const sequences: Element[] = [];
  let providers = 0;
  visit(entry.ast, (node) => {
    if (!(ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))) {
      return;
    }
    const name = canonical(entry, opening(node).tagName.getText());
    if (name.endsWith(":StudioObjects") && RUNTIME.test(name.split(":")[0])) {
      providers += 1;
    }
    if (SEQUENCES.has(name)) {
      sequences.push(node);
    }
  });
  if (providers !== 1 || sequences.length === 0) {
    return refuse(
      "A single managed provider and explicit scene sequences are required."
    );
  }
  const cursors = new Map<ts.Node, number>();
  const used = new Set<string>();
  for (const sequence of sequences) {
    const { from, length, duration } = sceneTiming(
      modules,
      entry,
      sequence,
      cursors,
      scenes.at(-1)?.durationInFrames ?? 0
    );
    frames(from, true);
    if (from + length > durationInFrames) {
      return refuse("A scene extends beyond the video duration.");
    }
    patchScene({
      add,
      document,
      duration,
      entry,
      folder,
      fps,
      from,
      length,
      modules,
      scenes,
      sequence,
      used,
    });
  }
  patchImports(modules, entry, folder, scenes, add);
  const edits: ShaderSourceEdit[] = [...modules.values()].map((module) => {
    let after = module.text;
    for (const patch of (patches.get(module.path) ?? []).sort(
      (a, b) => b.start - a.start
    )) {
      after = after.slice(0, patch.start) + patch.text + after.slice(patch.end);
    }
    return { after, before: module.text, path: module.path };
  });
  edits.push({
    after: SCENE_HELPER,
    before: null,
    path: `${folder}/shader-scenes.tsx`,
  });
  return { durationInFrames, edits, fps, scenes };
}

function checkAncestors(entry: Module, sequence: Element) {
  let ancestor = sequence.parent;
  while (ancestor && ancestor !== entry.ast) {
    if (
      ts.isConditionalExpression(ancestor) ||
      ts.isCallExpression(ancestor) ||
      ts.isBinaryExpression(ancestor) ||
      (ts.isJsxElement(ancestor) &&
        SEQUENCES.has(
          canonical(entry, ancestor.openingElement.tagName.getText())
        ))
    ) {
      refuse(
        "Nested or conditional scene scheduling needs explicit preparation."
      );
    }
    ancestor = ancestor.parent;
  }
}

function sceneTiming(
  modules: Map<string, Module>,
  entry: Module,
  sequence: Element,
  cursors: Map<ts.Node, number>,
  previousLength: number
) {
  const kind = canonical(entry, opening(sequence).tagName.getText());
  checkAncestors(entry, sequence);
  const duration = expression(sequence, "durationInFrames");
  if (!duration) {
    return refuse("Each scene needs an explicit duration.");
  }
  const length = frames(number(modules, entry, duration));
  let from = 0;
  if (kind === "remotion:Sequence") {
    const start = expression(sequence, "from");
    from = start ? frames(number(modules, entry, start), true) : 0;
  } else {
    from = seriesStart(
      modules,
      entry,
      sequence,
      cursors,
      kind,
      length,
      previousLength
    );
  }
  return { duration, from, length };
}

function seriesStart(
  modules: Map<string, Module>,
  entry: Module,
  sequence: Element,
  cursors: Map<ts.Node, number>,
  kind: string,
  length: number,
  previousLength: number
) {
  const { parent } = sequence;
  if (!ts.isJsxElement(parent)) {
    return refuse("Series scenes must be direct children.");
  }
  const expected =
    kind === "remotion:Series.Sequence"
      ? "remotion:Series"
      : "@remotion/transitions:TransitionSeries";
  if (canonical(entry, parent.openingElement.tagName.getText()) !== expected) {
    return refuse("Scene scheduling has an unsupported wrapper.");
  }
  let from = cursors.get(parent) ?? 0;
  const siblings = children(parent);
  const previous = siblings[siblings.indexOf(sequence) - 1];
  if (
    previous &&
    (ts.isJsxElement(previous) || ts.isJsxSelfClosingElement(previous)) &&
    canonical(entry, opening(previous).tagName.getText()) ===
      "@remotion/transitions:TransitionSeries.Transition"
  ) {
    const overlap = transitionOverlap(
      modules,
      entry,
      previous,
      length,
      previousLength
    );
    from -= overlap;
  }
  const offset = expression(sequence, "offset");
  if (offset) {
    from += number(modules, entry, offset);
  }
  cursors.set(parent, from + length);
  for (const sibling of siblings) {
    if (
      !(
        (ts.isJsxElement(sibling) || ts.isJsxSelfClosingElement(sibling)) &&
        [kind, "@remotion/transitions:TransitionSeries.Transition"].includes(
          canonical(entry, opening(sibling).tagName.getText())
        )
      )
    ) {
      refuse("Dynamic Series children need explicit preparation.");
    }
  }
  return from;
}

function transitionOverlap(
  modules: Map<string, Module>,
  entry: Module,
  previous: Element,
  length: number,
  previousLength: number
) {
  const timing = expression(previous, "timing");
  if (
    !(
      timing &&
      ts.isCallExpression(timing) &&
      ts.isIdentifier(timing.expression) &&
      [
        "@remotion/transitions:linearTiming",
        "@remotion/transitions:springTiming",
      ].includes(canonical(entry, timing.expression.text))
    )
  ) {
    return refuse("Transition timing needs an explicit frame duration.");
  }
  const [options] = timing.arguments;
  if (!(options && ts.isObjectLiteralExpression(options))) {
    return refuse("Transition timing needs explicit options.");
  }
  const durationOption = options.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && p.name.getText() === "durationInFrames"
  );
  if (!durationOption) {
    return refuse("Transition timing needs an explicit frame duration.");
  }
  const overlap = frames(number(modules, entry, durationOption.initializer));
  if (overlap >= length || overlap >= (previousLength ?? 0)) {
    return refuse("Transition overlap exceeds a scene duration.");
  }
  return overlap;
}

function pureBackground(
  modules: Map<string, Module>,
  module: Module,
  node: Element
): boolean {
  const tag = opening(node).tagName.getText();
  if (canonical(module, tag) === "remotion:AbsoluteFill") {
    if (!ts.isJsxSelfClosingElement(node)) {
      return false;
    }
    const style = expression(node, "style");
    if (!(style && ts.isObjectLiteralExpression(style))) {
      return false;
    }
    return (
      style.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) &&
          ["background", "backgroundColor", "backgroundImage"].includes(
            p.name.getText()
          )
      ) &&
      !style.properties.some(
        (p) =>
          !ts.isPropertyAssignment(p) ||
          ["zIndex", "mixBlendMode"].includes(p.name.getText())
      )
    );
  }
  const imported = module.imports.get(tag);
  const owner = imported ? modules.get(imported.path) : module;
  if (!owner) {
    return false;
  }
  const name = imported?.name ?? tag;
  const declaration = owner.ast.statements.find(
    (item): item is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(item) && item.name?.text === name
  );
  const result = declaration?.body?.statements.find(
    ts.isReturnStatement
  )?.expression;
  if (!result) {
    return false;
  }
  const fill = unwrap(result);
  return (
    ts.isJsxSelfClosingElement(fill) &&
    canonical(owner, fill.tagName.getText()) === "remotion:AbsoluteFill" &&
    pureBackground(modules, owner, fill)
  );
}
function slotPosition(
  modules: Map<string, Module>,
  module: Module,
  root: ts.JsxElement
) {
  let position = root.openingElement.end;
  let foreground = false;
  for (const child of children(root)) {
    if (
      (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) &&
      pureBackground(modules, module, child)
    ) {
      if (foreground) {
        return refuse(
          "A scene background follows foreground content and needs explicit preparation."
        );
      }
      position = child.end;
    } else {
      foreground = true;
    }
  }
  return position;
}

function patchScene({
  modules,
  entry,
  folder,
  document,
  scenes,
  used,
  sequence,
  length,
  fps,
  from,
  duration,
  add,
}: {
  modules: Map<string, Module>;
  entry: Module;
  folder: string;
  document: StudioDocument;
  scenes: PlannedShaderScene[];
  used: Set<string>;
  sequence: Element;
  length: number;
  fps: number;
  from: number;
  duration: ts.Expression;
  add: AddPatch;
}) {
  if (!ts.isJsxElement(sequence)) {
    return refuse("The sequence has no scene content.");
  }
  const content = children(sequence);
  if (
    content.length !== 1 ||
    !(ts.isJsxElement(content[0]) || ts.isJsxSelfClosingElement(content[0]))
  ) {
    return refuse("Each sequence needs one explicit scene component.");
  }
  const [component] = content;
  const componentName = opening(component).tagName.getText();
  const imported = entry.imports.get(componentName);
  const owner = imported ? modules.get(imported.path) : entry;
  if (!owner?.path.startsWith(`${folder}/`)) {
    return refuse("Shared scene components need explicit preparation.");
  }
  const componentKey = `${owner.path}:${imported?.name ?? componentName}`;
  if (used.has(componentKey)) {
    return refuse("A scene component is mounted more than once.");
  }
  used.add(componentKey);
  const { id, root } = sceneRoot(
    owner,
    imported?.name ?? componentName,
    document
  );
  if (scenes.some((scene) => scene.sceneId === id)) {
    return refuse("A managed scene identity is reused.");
  }
  const label =
    document.objects.find((object) => object.id === id)?.label ?? id;
  const slotId = `${id}-shaders`;
  scenes.push({
    contract: 1,
    durationInFrames: length,
    fps,
    from,
    label,
    sceneId: id,
    slotId,
    source: owner.path,
  });
  add(
    owner,
    slotPosition(modules, owner, root),
    slotPosition(modules, owner, root),
    "\n      <StudioSceneShader />"
  );
  const props = `id=${JSON.stringify(slotId)} sceneId=${JSON.stringify(id)} label={${JSON.stringify(label)}} durationInFrames={${duration.getText(entry.ast)}}`;
  add(
    entry,
    component.getStart(entry.ast),
    component.end,
    `<StudioShaderScene ${props}>${component.getText(entry.ast)}</StudioShaderScene>`
  );
}

type AddPatch = (
  module: Module,
  start: number,
  end: number,
  text: string
) => void;
function checkHelperNames(module: Module, helpers: string[]) {
  for (const name of helpers) {
    if (new RegExp(`\\b${name}\\b`).test(module.text)) {
      refuse(`The generated name ${name} already exists.`);
    }
  }
}

function patchImports(
  modules: Map<string, Module>,
  entry: Module,
  folder: string,
  scenes: PlannedShaderScene[],
  add: AddPatch
) {
  for (const module of modules.values()) {
    if (!module.path.startsWith(`${folder}/`)) {
      continue;
    }
    const helpers = module.path === entry.path ? ["StudioShaderScene"] : [];
    if (scenes.some((scene) => scene.source === module.path)) {
      helpers.push("StudioSceneShader");
    }
    checkHelperNames(module, helpers);
    if (helpers.length) {
      add(
        module,
        0,
        0,
        `import { ${helpers.join(", ")} } from ${JSON.stringify(relativeImport(module.path, `${folder}/shader-scenes.tsx`))};\n`
      );
    }
    for (const statement of module.ast.statements) {
      if (
        !(
          (ts.isImportDeclaration(statement) ||
            ts.isExportDeclaration(statement)) &&
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier)
        )
      ) {
        continue;
      }
      const path = posix.normalize(
        posix.join(posix.dirname(module.path), statement.moduleSpecifier.text)
      );
      if (RUNTIME.test(path)) {
        add(
          module,
          statement.moduleSpecifier.getStart(module.ast),
          statement.moduleSpecifier.end,
          JSON.stringify(
            relativeImport(
              module.path,
              "src/lib/studio-objects-v7/index.tsx"
            ).replace(INDEX_SUFFIX, "")
          )
        );
      }
    }
  }
}

const SCENE_HELPER = `import { createContext, useContext, type ReactNode } from "react";
import { StudioShaderSlot } from "../../lib/studio-objects-v7/shaders";
import manifest from "./studio-shaders.json";
import { shaderRegistry } from "./shader-registry";
type Scope = { id: string; sceneId: string; label: string; durationInFrames: number };
const ShaderScene = createContext<Scope | null>(null);
export function StudioShaderScene({ children, ...scope }: Scope & { children: ReactNode }) {
  return <ShaderScene.Provider value={scope}>{children}</ShaderScene.Provider>;
}
export function StudioSceneShader() {
  const scope = useContext(ShaderScene);
  if (!scope) throw new Error("The shader scene scope is missing.");
  return <StudioShaderSlot {...scope} sourceRevision={manifest.sourceRevision} registry={shaderRegistry} />;
}
`;

export function planStructuredShaderConnection(
  root: string,
  folder: string,
  document: StudioDocument
) {
  return shaderIO(async () => {
    const { modules, entry } = await graph(root, folder);
    await Promise.all(
      ["shader-scenes.tsx", "shader-registry.ts"].map(async (path) => {
        if (await exists(root, `${folder}/${path}`)) {
          refuse(`The authored file ${path} already exists.`);
        }
      })
    );
    return plan(modules, entry, folder, document);
  });
}
