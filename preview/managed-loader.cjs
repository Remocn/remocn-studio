"use strict";
module.exports = function managedLoader(source) {
  const guard = /if\s*\(window\.parent\s*===\s*window\)\s*\{\s*return;?\s*\}/g;
  const send = /window\.parent\.postMessage\(/g;
  const add = /window\.addEventListener\((['"])message\1,\s*receive\)/g;
  const remove = /window\.removeEventListener\((['"])message\1,\s*receive\)/g;
  if (
    ![guard, send, add, remove].every(
      (pattern) => source.match(pattern)?.length === 1
    )
  ) {
    throw new Error(
      "This managed object runtime has a different transport. Restore the supported runtime before opening the canvas."
    );
  }
  return (
    `import { managedTransport as __remocnTransport } from ${JSON.stringify(this.getOptions().transport)};\n` +
    source
      .replace(guard, "")
      .replace(send, "__remocnTransport.postMessage(")
      .replace(add, '__remocnTransport.addEventListener("message", receive)')
      .replace(
        remove,
        '__remocnTransport.removeEventListener("message", receive)'
      )
  );
};
