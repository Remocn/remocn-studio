import { randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";
import { Context, Effect, Schema } from "effect";
import { ShaderSourcePath } from "@/shared/shader-manifest";
import { ShaderInsertRequest, ShaderReceipt } from "@/shared/shaders";
import {
  ShaderError,
  type ShaderResource,
  shaderFailure,
  shaderIO,
} from "../library/shaders";
import { atomicJson, contained, hashBytes } from "./config";
import { readShaderFile, type ShaderSourceEdit } from "./shader-targets";

const JournalEdit = Schema.Struct({
  after: Schema.NullOr(Schema.String),
  before: Schema.NullOr(Schema.String),
  path: ShaderSourcePath,
});
const Hash = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));
export const ShaderJournalRecord = Schema.Struct({
  edits: Schema.Array(JournalEdit),
  error: Schema.optionalKey(Schema.String),
  phase: Schema.Literals([
    "planned",
    "resources",
    "connected",
    "committed",
    "cancelled",
    "failed",
  ]),
  receipt: Schema.optionalKey(ShaderReceipt),
  request: ShaderInsertRequest,
  resources: Schema.Array(
    Schema.Struct({ hash: Hash, path: ShaderSourcePath })
  ),
  root: Schema.NonEmptyString,
  version: Schema.Literal(1),
}).check(
  Schema.makeFilter(
    (record) =>
      (record.edits.every(
        (edit) => edit.after !== null || edit.before === null
      ) &&
        new Set(record.edits.map((edit) => edit.path)).size ===
          record.edits.length &&
        new Set(record.resources.map((file) => file.path)).size ===
          record.resources.length) ||
      "Shader preparation paths must be unique."
  )
);
export type ShaderJournalRecord = typeof ShaderJournalRecord.Type;
const decodeRecord = Schema.decodeUnknownEffect(ShaderJournalRecord);

export interface ShaderJournal {
  readonly activate: (
    record: ShaderJournalRecord
  ) => Effect.Effect<void, ShaderError>;
  readonly prepare: (
    record: ShaderJournalRecord,
    files: readonly ShaderResource[]
  ) => Effect.Effect<void, ShaderError>;
  readonly read: (
    root: string,
    video: string,
    operationId: string
  ) => Effect.Effect<ShaderJournalRecord | null, ShaderError>;
  readonly rollback: (
    record: ShaderJournalRecord
  ) => Effect.Effect<void, ShaderError>;
  readonly save: (
    record: ShaderJournalRecord
  ) => Effect.Effect<void, ShaderError>;
}
export const ShaderJournal = Context.Service<ShaderJournal>(
  "sidecar/ShaderJournal"
);

function journalKey(root: string, video: string, operationId: string) {
  return `shader-insertions/${hashBytes(JSON.stringify([root, video, operationId]))}.json`;
}

function checkedRecord(record: unknown) {
  return decodeRecord(record, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      (cause) =>
        new ShaderError({
          message: `Unsupported shader preparation journal: ${cause.message}`,
        })
    )
  );
}

function atomicSource(root: string, path: string, text: string) {
  return shaderIO(async () => {
    const target = await contained(root, path);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx");
      try {
        await file.writeFile(text);
        await file.sync();
      } finally {
        await file.close();
      }
      await contained(root, path);
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }).pipe(Effect.uninterruptible);
}

export function makeShaderJournal(dataDirectory: string): ShaderJournal {
  const persist = Effect.fn("shaderJournal.save")(function* (
    record: ShaderJournalRecord
  ) {
    const checked = yield* checkedRecord(record);
    yield* shaderIO(() => mkdir(dataDirectory, { recursive: true }));
    const root = yield* shaderIO(() => realpath(checked.root));
    yield* shaderIO(() =>
      atomicJson(
        dataDirectory,
        journalKey(
          root,
          checked.request.target.video,
          checked.request.operationId
        ),
        { ...checked, root }
      )
    );
  });
  const save = (record: ShaderJournalRecord) =>
    persist(record).pipe(Effect.uninterruptible);
  return {
    activate: Effect.fn("shaderJournal.activate")(function* (record) {
      yield* Effect.forEach(record.resources, (file) =>
        Effect.gen(function* () {
          const content = yield* readShaderFile(record.root, file.path);
          if (content === null || hashBytes(content) !== file.hash) {
            return yield* shaderFailure(
              `${file.path} is missing or changed. Shader imports were not activated.`
            );
          }
        })
      );
      yield* Effect.forEach(record.edits, (edit) =>
        checkEdit(record.root, edit)
      );
      yield* Effect.forEach(record.edits, (edit) =>
        Effect.gen(function* () {
          const current = yield* checkEdit(record.root, edit);
          if (current !== edit.after && edit.after !== null) {
            yield* atomicSource(record.root, edit.path, edit.after);
          }
        })
      );
      yield* save({ ...record, phase: "connected" });
    }),
    prepare: Effect.fn("shaderJournal.prepare")(function* (record, files) {
      if (
        record.resources.length !== files.length ||
        record.resources.some(
          (entry) =>
            !files.some(
              (file) =>
                file.path === entry.path &&
                file.hash === entry.hash &&
                hashBytes(file.content) === file.hash
            )
        )
      ) {
        return yield* shaderFailure(
          "The shader resources changed since preparation started."
        );
      }
      yield* save(record);
      yield* Effect.forEach(files, (file) =>
        installResource(record.root, file)
      );
      yield* save({ ...record, phase: "resources" });
    }),
    read: Effect.fn("shaderJournal.read")(
      function* (folder, video, operationId) {
        const root = yield* shaderIO(() => realpath(folder));
        yield* shaderIO(() => mkdir(dataDirectory, { recursive: true }));
        const text = yield* readShaderFile(
          dataDirectory,
          journalKey(root, video, operationId)
        );
        if (text === null) {
          return null;
        }
        const raw = yield* Effect.try({
          catch: () =>
            new ShaderError({
              message: "The shader preparation journal is not valid JSON.",
            }),
          try: () => JSON.parse(text) as unknown,
        });
        const record = yield* checkedRecord(raw);
        if (
          record.root !== root ||
          record.request.target.video !== video ||
          record.request.operationId !== operationId
        ) {
          return yield* shaderFailure(
            "The shader preparation journal belongs to another request."
          );
        }
        return record;
      }
    ),
    rollback: (record) =>
      Effect.gen(function* () {
        const conflicts: string[] = [];
        yield* Effect.forEach([...record.edits].reverse(), (edit) =>
          Effect.gen(function* () {
            const current = yield* readShaderFile(record.root, edit.path);
            if (current === edit.before) {
              return;
            }
            if (current !== edit.after) {
              conflicts.push(edit.path);
              return;
            }
            if (edit.before === null) {
              yield* shaderIO(async () =>
                unlink(await contained(record.root, edit.path))
              );
            } else {
              yield* atomicSource(record.root, edit.path, edit.before);
            }
          })
        );
        const error =
          conflicts.length > 0
            ? `These source files changed independently and were preserved: ${conflicts.join(", ")}. Reconnect the shader slot before retrying.`
            : undefined;
        yield* save({
          ...record,
          phase: error ? "failed" : "cancelled",
          ...(error ? { error } : {}),
        });
        if (error) {
          return yield* shaderFailure(error);
        }
      }).pipe(Effect.uninterruptible),
    save,
  };
}

function checkEdit(root: string, edit: ShaderSourceEdit) {
  return Effect.gen(function* () {
    const current = yield* readShaderFile(root, edit.path);
    if (current !== edit.before && current !== edit.after) {
      return yield* shaderFailure(
        `${edit.path} changed independently during shader preparation. Studio preserved that edit.`
      );
    }
    return current;
  });
}

function installResource(root: string, file: ShaderResource) {
  return shaderIO(async () => {
    const path = await contained(root, file.path);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx");
      try {
        await handle.writeFile(file.content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await contained(root, file.path);
      const created = await link(temporary, path).then(
        () => true,
        (cause: NodeJS.ErrnoException) => {
          if (cause.code !== "EEXIST") {
            throw cause;
          }
          return false;
        }
      );
      if (!created && hashBytes(await readFile(path)) !== file.hash) {
        throw new ShaderError({
          message: `${file.path} changed during shader preparation. The authored file was preserved.`,
        });
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }).pipe(Effect.uninterruptible);
}
