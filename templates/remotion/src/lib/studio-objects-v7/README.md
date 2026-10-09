# Managed objects v7

Use `StudioObjects` and `useStudioObject` from this directory together. The v5
and v6 hooks use a different React context; changing just the provider is not a
supported migration. Existing geometry, text and easing readers retain their
contracts. `between.ts` supplies the geometry motion helper.

Declare a colour palette as `type: "palette"`, with `minItems` and `maxItems`
between 1 and 10, and read it with `object.palette("colors")`. Values are ordered
six- or eight-digit hex colours. Repeated colours are meaningful. Draft messages
validate field types and bounds and belong to one document generation.

Place `StudioShaderSlot` from `./shaders` after a scene's base background and
before foreground content. Keep `StudioObjects` at the video root. Pass the
same duration used to schedule the scene, its permanent managed scene ID (or
null for an undivided video), and its permanent slot ID. A slot belongs inside
the scene's sequence/transition so scene-local time and transforms apply.

The project-local insertion manifest supplies `sourceRevision` and a finite
prepared registry. Preserve saved shader IDs, implementation revisions and
operation history. Do not recreate removed records. The slot unmounts removed
and inactive shaders, orders them within its background group and never moves
them above foreground content. Trimming gates visibility without resetting
the shader clock. An explicit end outside a shortened scene is an error.
