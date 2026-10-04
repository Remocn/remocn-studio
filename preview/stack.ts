import { absolutise } from "./source";
import type { TargetWhere } from "./tuning";

// What `@remotion/bundler`'s `setup-sequence-stack-traces` writes into every
// `_remotionInternalStack` when `jsxDEV` hands it a source location:
//
//   Error\n    at remotionOriginalSource (studio-original://<file>:<line>:<col>)
//
// The file is percent-encoded, and relative to the Remotion root when the page
// set `window.remotion_cwd` — which this one does not, so it arrives absolute.
// Either way `absolutise` settles it against the root the page carries.
const ORIGINAL = /studio-original:\/\/(.+?):(\d+):(\d+)\)/;

/**
 * The JSX call site an `Interactive`'s controls were created at.
 *
 * This is the coordinate the codemod needs and the one the component stack
 * cannot give: that stack resolves the *component* a DOM node was rendered by,
 * which for a `withSchema` wrapper is the function inside it. Remotion records
 * the call site itself, against the controls object, and hands it back through
 * `Internals.getStackForControls`.
 */
export function originOf(
  root: string,
  stack: string | null | undefined
): TargetWhere | null {
  if (typeof stack !== "string") {
    return null;
  }

  const found = ORIGINAL.exec(stack);
  if (found === null) {
    return null;
  }

  const file = absolutise(root, decoded(found[1] ?? ""));
  if (file === null) {
    return null;
  }

  return {
    column: Number(found[3]),
    file,
    line: Number(found[2]),
  };
}

function decoded(file: string): string {
  try {
    return decodeURIComponent(file);
  } catch {
    return file;
  }
}
