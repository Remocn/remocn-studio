## Where the copy is taken

Inside the watch callback. webpack calls it after `emitAssets` has finished writing and
before it starts the next compilation, so this is the one moment `bundle.js` is known to
be whole. The read is synchronous for the same reason: nothing can start writing while it
runs. The copy is taken before the generation is bumped and before `native-rebuilt` is
sent, so the manifest never names a generation whose bytes the host does not hold.

## Why not from the compilation

webpack 5 replaces an emitted asset's source with a `SizeOnlySource` once it is written,
to free memory; the bytes are no longer there to take. Hooking `assetEmitted` would reach
into the project's own webpack for something the file on disk already gives.

## Why not an atomic write

Writing to a temporary file and renaming it would need a custom output file system for
the project's webpack, and the server would still have to `fstat` the file it opened
rather than `stat` the path — today it stats the path and opens it later, which a rename
between the two breaks the same way. One copy in memory closes both.

## Which build is answered

The latest that compiled, whatever generation the URL names. If a newer build lands
between the manifest and the fetch, the pane gets that newer build, whole, under the older
generation's label; the `native-rebuilt` already on its way restages it. Answering a 404
instead would show the stale notice for nothing.

## Ranges

The bundle is answered through the same code as a file — `sendBody` — so it still
declares ranges, a real length and no storing, as *The project's files are served with
ranges and revalidation* asks of the compiled bundle.

## The source map line

webpack appends exactly one `//# sourceMappingURL=bundle.js.map` as the bundle's last
line. Anchoring the rewrite to the end of the text leaves every other occurrence — in
style-loader's runtime, or in a library that builds the comment from parts — as written.
