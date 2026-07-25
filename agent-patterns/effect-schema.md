# Effect `Schema` — patterns for writing code in this project

Reference for agents writing `Schema` code here. Derived from the vendored checkout at
`repos/effect` (`effect@4.0.0-beta.101`), reading `packages/effect/src/Schema*.ts`,
`packages/effect/test/schema/`, `packages/effect/SCHEMA.md`, `migration/schema.md`, and
`ai-docs/src/01_effect/02_schema/`.

**How this was verified.** Every `Schema.*` / `SchemaGetter.*` / `SchemaTransformation.*` /
`SchemaIssue.*` / `SchemaParser.*` / `SchemaError.*` identifier below was checked against the
exported symbols of the vendored source, parsed with the TypeScript compiler API. It was **not**
type-checked end to end: `repos/effect/node_modules` is not installed, and `CLAUDE.md` forbids
editing under `repos/`. So identifiers are confirmed to exist; full type inference on composed
examples is not. Examples marked *copied* are verbatim from the checkout; *adapted* means reshaped
for brevity.

---

## 0. Read this first

### This is Effect v4, not v3

Schema was rewritten. Most Schema knowledge in training data is v3 and will be **wrong** here —
not merely outdated, but wrong in ways that compile-fail or silently change meaning. §8 is the
list. The single nastiest one:

> In v3, `Schema.decode` was a *decoder*. In v4, `Schema.decode` **applies a transformation**.
> The v4 decoder is `Schema.decodeEffect`. Writing v3 `Schema.decode(schema)(input)` out of habit
> produces something that means something else entirely.

v4 is in **beta** (`4.0.0-beta.101`); `MIGRATION.md` warns APIs may shift between beta releases.
Re-check against `repos/effect` rather than trusting this file forever.

### Imports — everything is flat, from `"effect"`

```ts
import {
  Schema,
  SchemaAST,
  SchemaError,
  SchemaGetter,
  SchemaIssue,
  SchemaParser,
  SchemaTransformation,
} from "effect"
```

That is what the real test suite does (`packages/effect/test/schema/Schema.test.ts`).

**Do not copy the import lines out of `SCHEMA.md`.** The guide contains stale forms that do not
resolve against this source:

| In `SCHEMA.md` | Actually |
| --- | --- |
| `import { Getter, Parser, Schema } from "effect/schema"` | `import { Schema, SchemaGetter, SchemaParser } from "effect"` — there is no `effect/schema` subpath; the export map is `./*` → `./src/*.ts` and the file is `Schema.ts` (this only appears to work on case-insensitive macOS, and breaks on Linux CI) |
| `Getter.X`, `Parser.X`, `Transformation.X`, `Issue.X` | `SchemaGetter.X`, `SchemaParser.X`, `SchemaTransformation.X`, `SchemaIssue.X` |
| `Schema.makeOption(...)` | `schema.makeOption(...)` (method) or `SchemaParser.makeOption(schema)` |

`effect/unstable/schema` is a **different** thing (`Model`, `VariantSchema` for SQL models), not
the module documented here.

### Do not use `Schema` types as annotations

From `SCHEMA.md` §Best Practices — `Top` / `Schema<T>` / `Codec<T, E, RD, RE>` are **constraints
only**. Annotating with them resets internal type parameters and erases information.

```ts
// ✅ constraint
declare function foo<S extends Schema.Top>(schema: S): void

// ❌ erases detail baked into the concrete schema
const schema: Schema.Codec<number, string> = Schema.FiniteFromString
declare function bar(): Schema.Codec<number, string>
```

---

## 1. Constructors and combinators

### Primitives and refined built-ins

```ts
Schema.String
Schema.Number
Schema.BigInt
Schema.Boolean
Schema.Symbol
Schema.Undefined
Schema.Null
Schema.Void
Schema.Never

Schema.Finite          // excludes NaN / ±Infinity
Schema.Int
Schema.NonEmptyString
Schema.Date            // any Date, including Invalid Date
Schema.DateValid       // valid dates only
```

### Literals — array form, not variadic

```ts
Schema.Literal("tuna")
Schema.Literals(["red", "green", "blue"])   // NOT Literal("red", "green", ...)
Schema.UniqueSymbol(Symbol("terrific"))

const Color = Schema.Literals(["red", "green", "blue"])
Color.literals   // readonly ["red", "green", "blue"]
Color.members    // readonly [Literal<"red">, Literal<"green">, Literal<"blue">]
```

### Composites — note which take arrays and which take positional args

```ts
Schema.Struct({ a: Schema.String })
Schema.Array(Schema.String)
Schema.NonEmptyArray(Schema.String)
Schema.Tuple([Schema.String, Schema.Number])     // array
Schema.Record(Schema.String, Schema.Number)      // positional, NOT { key, value }
Schema.Union([Schema.String, Schema.Number])     // array
Schema.NullOr(Schema.String)
Schema.UndefinedOr(Schema.String)
Schema.suspend(() => Node)                       // recursive schemas
Schema.instanceOf(URL)
```

The variadic → array change is the most common source of v3 muscle-memory errors.

### Optionality

Three orthogonal pieces compose into every variant. `optionalKey` = key may be **absent**;
`optional` = key may be absent **or `undefined`**; `NullOr` adds `null`; `mutableKey` drops
`readonly`.

*Copied — `SCHEMA.md` §Optional Fields:*

```ts
export const schema = Schema.Struct({
  // Exact Optional Property
  a: Schema.optionalKey(Schema.FiniteFromString),
  // Optional Property
  b: Schema.optional(Schema.FiniteFromString),
  // Exact Optional Property with Nullability
  c: Schema.optionalKey(Schema.NullOr(Schema.FiniteFromString)),
  // Optional Property with Nullability
  d: Schema.optional(Schema.NullOr(Schema.FiniteFromString))
})
```

`Schema.requiredKey` reverses `optional*`. There is no `partial` — see §8.

### Tagged structs and unions

```ts
Schema.TaggedStruct("A", { a: Schema.String })

// equivalent to Union([TaggedStruct("A", …), TaggedStruct("B", …)])
const Event = Schema.TaggedUnion({
  A: { a: Schema.String },
  B: { b: Schema.Finite }
})
```

`Schema.toTaggedUnion` augments a tagged union with per-tag helper methods.

### Decoding defaults

Four variants, differing on which side the default is expressed in and whether `undefined`
triggers it (`SCHEMA.md` §Decoding Defaults):

| API | Fires when | Default is a |
| --- | --- | --- |
| `withDecodingDefaultKey` | key absent | `Encoded` value |
| `withDecodingDefault` | key absent or `undefined` | `Encoded` value |
| `withDecodingDefaultTypeKey` | key absent | `Type` value |
| `withDecodingDefaultType` | key absent or `undefined` | `Type` value |

```ts
// "1" is a string — the Encoded side — and is then decoded to 1
Schema.Struct({
  a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(Effect.succeed("1")))
})

// 1 is a number — the Type side — and skips the decoding transformation
Schema.Struct({
  a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultType(Effect.succeed(1)))
})
```

Defaults nest: put `withDecodingDefault(Effect.succeed({}))` on an inner struct and `{}` decodes
to a fully-defaulted object.

---

## 2. Decoding and encoding

### Pick the right function from the matrix

Two axes. `decodeUnknown*` accepts `unknown`; `decode*` accepts the schema's `Encoded` type
(already statically known). The suffix picks the result container:

| Suffix | Returns | Use when |
| --- | --- | --- |
| `Sync` | the value, **throws** `SchemaError` | scripts, tests, trusted input |
| `Effect` | `Effect<Type, SchemaError>` | inside Effect code — the default here |
| `Exit` | `Exit<Type, SchemaError>` | synchronous, want failures as values |
| `Result` | `Result<Type, SchemaError>` | synchronous, no Effect runtime |
| `Option` | `Option<Type>` | failure detail not needed |
| `Promise` | `Promise<Type>` | boundary with non-Effect async code |

All twelve exist and mirror for encoding: `encodeUnknownSync`, `encodeEffect`, `encodeExit`, …

```ts
Schema.decodeUnknownSync(schema)(input)
Schema.decodeUnknownEffect(schema)(input)
Schema.decodeUnknownExit(schema)(input, { errors: "all" })
Schema.encodeEffect(schema)(value)
```

Pass `{ errors: "all" }` to collect every issue instead of stopping at the first.

### Build the parser once, at the edge

*Copied — `ai-docs/src/01_effect/02_schema/10_schema-basics.ts`. This is the house style:*

```ts
import { Effect, Schema } from "effect"

export class User extends Schema.Class<User>("path/to/module/User")({
  id: Schema.Int,
  name: Schema.NonEmptyString,
  email: Schema.String,
  role: Schema.Literals(["admin", "member"])
}) {}

export type UserType = typeof User["Type"]
export type UserEncoded = typeof User["Encoded"]

// Reuse parsers at the edges of your application instead of rebuilding them for
// every request.
export const decodeUser = Schema.decodeUnknownEffect(User)
export const encodeUser = Schema.encodeEffect(User)

export class InvalidUserPayload extends Schema.TaggedErrorClass<InvalidUserPayload>()(
  "InvalidUserPayload",
  { message: Schema.String }
) {}

export const parseUserPayload = Effect.fn("parseUserPayload")((input: unknown) =>
  decodeUser(input).pipe(
    Effect.mapError((error) => new InvalidUserPayload({ message: error.message }))
  )
)
```

Two things to copy from this: hoist `decodeUnknownEffect(Schema)` to module scope, and map
`SchemaError` into a domain-tagged error at the boundary rather than leaking it inward.

### Type vs Encoded

`typeof S["Type"]` is the decoded side, `typeof S["Encoded"]` the wire side. `Schema.toType(s)`
and `Schema.toEncoded(s)` project a schema onto one side — `toType` is what you need when
supplying a default for a transformed field (§5).

### JSON

```ts
Schema.UnknownFromJsonString                       // string -> unknown
Schema.fromJsonString(Schema.Struct({ a: Schema.Number }))  // string -> validated
```

`fromJsonString` parses **and** validates in one pass; extra keys are dropped.

---

## 3. Validation — filters

Filters are **first-class reusable values** applied with `.check(...)`, which takes any number of
them. `.check` preserves the schema's type, so `.fields`, `.make` etc. still work afterwards.

```ts
Schema.String.check(Schema.isMinLength(3), Schema.isTrimmed())
Schema.Number.check(Schema.isBetween({ minimum: 5, maximum: 10 }))
Schema.Number.check(Schema.isInt(), Schema.isMultipleOf(5))
Schema.String.check(Schema.isUUID())
Schema.String.check(Schema.isPattern(/^ab/))
Schema.Array(Schema.String).check(Schema.isMinLength(3))
```

Filters are structural, not type-bound: `isMinLength` works on anything with a numeric `length`,
including `Schema.Struct({ length: Schema.Number })`.

BigInt has no prebuilt range filters — build them from `Schema.makeIsBetween`,
`Schema.makeIsGreaterThan`, … with `{ order: Order.BigInt }`.

### Custom filters

`Schema.makeFilter(predicate, annotations?, abort?)`. The predicate's return value selects the
failure shape (`Schema.FilterOutput`):

- `undefined` / `true` — pass
- `false` — fail, generic message
- `string` — fail with that message
- `{ path, issue }` — fail at a nested path
- `ReadonlyArray<Schema.FilterIssue>` — several failures at once
- `SchemaIssue.Issue` — fully-formed issue (escape hatch)

*Copied — `SCHEMA.md` §Filter return shapes:*

```ts
const schema = Schema.Struct({
  password: Schema.String,
  confirmPassword: Schema.String
}).check(
  Schema.makeFilter((o) =>
    o.password === o.confirmPassword
      ? undefined
      : { path: ["password"], issue: "password and confirmPassword must match" }
  )
)
```

*Copied — reporting several failures together:*

```ts
const schema = Schema.Struct({ a: Schema.Finite, b: Schema.Finite, c: Schema.Finite }).check(
  Schema.makeFilter((o) => {
    const issues: Array<Schema.FilterIssue> = []
    if (o.a > 0) {
      if (o.b <= 0) issues.push({ path: ["b"], issue: "b must be greater than 0" })
      if (o.c <= 0) issues.push({ path: ["c"], issue: "c must be greater than 0" })
    }
    return issues
  })
)
```

### `check` vs `refine`

`.check` validates without changing the type. `Schema.refine` narrows it — use it when the
predicate is a TypeScript type guard, and `Schema.brand` for nominal typing.

```ts
Schema.Option(Schema.String).pipe(Schema.refine(Option.isSome))   // Type: Option.Some<string>
Schema.String.pipe(Schema.brand<"UserId">())
```

---

## 4. Runtime construction — `make`

Every schema carries constructors that run the full validation:

```ts
const S = Schema.Struct({ a: Schema.Number.check(Schema.isGreaterThan(0)) })

S.make({ a: 1 })            // throws SchemaError on invalid input
S.makeOption({ a: -1 })     // Option.none()
S.makeEffect({ a: 1 })      // Effect<Type, SchemaError>
SchemaParser.makeOption(S)  // standalone equivalent of .makeOption
```

`make` exists on composed schemas too, including unions. For branded or refined schemas the
standalone constructor accepts the *unbranded* input, but **inside a struct you must pass the
already-branded value**.

There is no `makeUnsafe` on schemas — that name belongs to other Effect modules
(`DateTime.makeUnsafe`, `Scope.makeUnsafe`). The throwing schema constructor is plain `.make`.

---

## 5. Transformations

Transformations are standalone reusable values, not inline callbacks baked into a schema. A
`Transformation<T, E, RD, RE>` is a pair of `Getter`s — `decode: Getter<T, E, RD>` and
`encode: Getter<E, T, RE>`.

### Applying them

- `Schema.decode(t)` — source and target schema are the same; apply `t`.
- `Schema.decodeTo(target, t?)` — transform into a *different* schema. Omit `t` for plain schema
  composition.
- `Schema.encodeTo` / `Schema.encode` — the mirrored directions.

```ts
Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))

Schema.String.pipe(
  Schema.decodeTo(Schema.Number, SchemaTransformation.numberFromString)
)

// compose transformations
SchemaTransformation.trim().compose(SchemaTransformation.toLowerCase())
```

### Inline, total

```ts
const Kilometers = Schema.Finite.pipe(
  Schema.decode(
    SchemaTransformation.transform({
      decode: (meters) => meters / 1000,
      encode: (kilometers) => kilometers * 1000
    })
  )
)
```

### Inline, fallible

*Adapted — `SCHEMA.md` §Defining an Inline Transformation. The guide writes
`new Issue.InvalidValue(...)` while importing `SchemaIssue`; the correct name is
`SchemaIssue.InvalidValue`:*

```ts
const URLFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.instanceOf(URL),
    SchemaTransformation.transformOrFail({
      decode: (s) =>
        Effect.try({
          try: () => new URL(s),
          catch: () =>
            new SchemaIssue.InvalidValue(Option.some(s), { message: `Invalid URL string: ${s}` })
        }),
      encode: (url) => Effect.succeed(url.href)
    })
  )
)
```

Fallible transformations fail with a `SchemaIssue.Issue`, not an arbitrary error — that is what
keeps the failure inside the issue tree with a correct path.

### Getters for optional-field plumbing

`decodeTo` also changes a field's optionality, which is how v4 replaces v3's `optionalWith`.

*Copied — `packages/effect/test/schema/v3-v4.test.ts`, the replacement for
`optionalWith(schema, { default })`:*

```ts
function f<S extends Schema.Constraint>(schema: S, defaultValue: S["Type"]) {
  return Schema.Struct({
    a: Schema.optional(schema).pipe(
      Schema.decodeTo(Schema.toType(schema), {
        decode: SchemaGetter.withDefault(Effect.succeed(defaultValue)),
        encode: SchemaGetter.required()
      })
    )
  })
}
```

Useful getters: `SchemaGetter.withDefault`, `required`, `passthrough`, `transformOptional`
(operates on the `Option` wrapper, so `Option.filter(Predicate.isNotNull)` drops nulls),
`transformOrFail`, and coercions like `SchemaGetter.String()`.

Omitting a decoded field entirely when it arrives `undefined`:

```ts
Schema.Struct({
  a: Schema.optional(Schema.FiniteFromString).pipe(
    Schema.decodeTo(Schema.optionalKey(Schema.Number), {
      decode: SchemaGetter.transformOptional(Option.filter(Predicate.isNotUndefined)),
      encode: SchemaGetter.passthrough()
    })
  )
})
```

---

## 6. Domain models — `Class`, `TaggedClass`, `Opaque`

`Schema.Class` gives a runtime validator and a real TypeScript class in one declaration; the
class type *is* the decoded type. Prefer it for domain models that must only exist in a valid
state. The string argument is the identifier used in error messages.

```ts
class A extends Schema.Class<A>("A")({ a: Schema.String }) {
  readonly _a = 1          // ordinary class members are fine
}

new A({ a: "a" })                    // validates, throws on failure
A.make({ a: "a" })
Schema.decodeUnknownSync(A)({ a: "a" })
```

Whole-object invariants: pass a `Struct` with `.check(...)` instead of a field record.

```ts
class Pair extends Schema.Class<Pair>("Pair")(
  Schema.Struct({ a: Schema.String, b: Schema.String })
    .check(Schema.makeFilter(({ a, b }) => a === b, { title: "a === b" }))
) {}
```

`Schema.TaggedClass` adds `_tag` automatically, which is what makes discriminated unions work:

```ts
class Cat extends Schema.TaggedClass<Cat>()("Cat", { lives: Schema.Number }) {}
class Dog extends Schema.TaggedClass<Dog>()("Dog", { wagsTail: Schema.Boolean }) {}

const Animal = Schema.Union([Cat, Dog])
Schema.decodeUnknownSync(Animal)({ _tag: "Cat", lives: 9 })   // Cat { _tag: 'Cat', lives: 9 }
```

Brand a class to stop structurally-identical models being mixed:

```ts
class UserId extends Schema.Class<UserId, Brand.Brand<"UserId">>("UserId")({
  value: Schema.String
}) {}
```

`Schema.Opaque` is the lighter alternative when you want a distinct type without a class.

---

## 7. Error handling

### The error value

Failures surface as `SchemaError` (`packages/effect/src/SchemaError.ts`), a
`Data.TaggedError("SchemaError")` carrying a structured issue tree:

- `error.issue` — the `SchemaIssue.Issue` tree: path, expected, actual, per-node.
- `error.message` — that tree rendered human-readably.
- `Schema.isSchemaError(u)` — narrow an `unknown` (re-exported from `Schema`).

```ts
try {
  Schema.decodeUnknownSync(Schema.Number)("not a number")
} catch (err) {
  if (Schema.isSchemaError(err)) console.log(err.message)
}
```

### In Effect code

Keep failures in the error channel and translate at the boundary — do not let `SchemaError`
propagate through domain logic. Define domain errors with `Schema.TaggedErrorClass` and catch by
tag:

```ts
class HttpError extends Schema.TaggedErrorClass<HttpError>()("HttpError", {
  status: Schema.Number,
  message: Schema.String
}) {}

program.pipe(
  Effect.catchTag("HttpError", (err) => Effect.succeed(`Caught: ${err.status} ${err.message}`))
)
```

With several error types use `Effect.catchTags({ NotFound: …, Unauthorized: … })`.

### Formatting for humans

`SchemaIssue.makeFormatterStandardSchemaV1()` turns an issue tree into
`{ issues: [{ path, message }] }`.

*Copied — `SCHEMA.md` §Formatters:*

```ts
const schema = Schema.Struct({ a: Schema.NonEmptyString, b: Schema.NonEmptyString })

Schema.decodeUnknownEffect(schema)({ b: "" }, { errors: "all" }).pipe(
  Effect.mapError((error) => SchemaIssue.makeFormatterStandardSchemaV1()(error.issue)),
  Effect.runPromise
)
/*
{ issues: [
  { path: ['a'], message: 'Missing key' },
  { path: ['b'], message: 'Expected a value with a length of at least 1, got ""' }
] }
*/
```

The built-in hooks are **demo-quality on purpose** — kept trivial so unused message logic can be
tree-shaken. For user-facing output supply your own `leafHook` / `checkHook`
(`SchemaIssue.LeafHook`, `SchemaIssue.CheckHook`), which is also the i18n seam.

### Which annotation controls which message

A frequent confusion, per `SCHEMA.md` §Filter error messages and schema identifiers:

- Input fails the **base type** → the schema's `identifier` annotation is the expected label.
- Base type passes but a **filter** fails → the filter's `message`, else its `expected`, else
  `<filter>`.

`identifier` does **not** name a failed filter. A `message` annotation on a schema beats any
formatter hook.

```ts
const Username = Schema.NonEmptyString.annotate({ identifier: "Username" })

Schema.decodeUnknownExit(Username)(null)  // Expected Username, got null
Schema.decodeUnknownExit(Username)("")    // Expected a value with a length of at least 1, got ""
```

---

## 8. What to avoid

### v3 APIs that changed shape (from `migration/schema.md`)

| Don't write (v3) | Write instead (v4) |
| --- | --- |
| `Schema.decode` *as a decoder* | `Schema.decodeEffect` — **`decode` now applies a transformation** |
| `Schema.decodeUnknown` | `Schema.decodeUnknownEffect` |
| `Schema.decodeEither` / `decodeUnknownEither` | `Schema.decodeExit` / `decodeUnknownExit` |
| `Schema.encode` / `encodeUnknown` | `Schema.encodeEffect` / `encodeUnknownEffect` |
| `Schema.validate*` | removed — use `decode*` with `Schema.toType` |
| `Schema.Union(A, B)` | `Schema.Union([A, B])` |
| `Schema.Tuple(A, B)` | `Schema.Tuple([A, B])` |
| `Schema.Literal("a", "b")` | `Schema.Literals(["a", "b"])` |
| `Schema.Literal(null)` | `Schema.Null` |
| `Schema.Record({ key, value })` | `Schema.Record(key, value)` |
| `Schema.filter(predicate)` | `.check(Schema.makeFilter(predicate))` |
| `Schema.filter(refinement)` | `Schema.refine(refinement)` |
| `Schema.transform(from, to, …)` | `from.pipe(Schema.decodeTo(to, SchemaTransformation.transform({…})))` |
| `Schema.transformOrFail(…)` | `decodeTo` + `SchemaGetter.transformOrFail` |
| `Schema.compose(b)` | `Schema.decodeTo(b)` — the name still exists but is now only a **type-level interface** (what `decodeTo` returns when given no transformation); it is not callable |
| `Schema.annotations(a)` | `Schema.annotate(a)` |
| `Schema.typeSchema` / `encodedSchema` | `Schema.toType` / `Schema.toEncoded` |
| `Schema.asSchema` | `Schema.revealCodec` |
| `Schema.TaggedError` | `Schema.TaggedErrorClass` |
| `Schema.parseJson()` / `parseJson(s)` | `Schema.UnknownFromJsonString` / `Schema.fromJsonString(s)` |
| `Schema.UUID` / `ULID` | `Schema.String.check(Schema.isUUID())` / `isULID()` |
| `Schema.pattern(re)` | `.check(Schema.isPattern(re))` |
| `Schema.nonEmptyString` | `Schema.isNonEmpty` |
| `Schema.pick("a")` / `omit("a")` | `.mapFields(Struct.pick(["a"]))` / `Struct.omit(["a"])` |
| `Schema.partial` | `.mapFields(Struct.map(Schema.optional))` |
| `Schema.extend(b)` | `.mapFields(Struct.assign(fieldsB))` or `Schema.fieldsAssign(fieldsB)` |
| `Schema.asserts(s)(x)` | `Schema.asserts(s, x)` — arity changed |
| `Schema.DateFromNumber` | `Schema.DateFromMillis` |
| `Schema.BigIntFromSelf` / `SymbolFromSelf` / `URLFromSelf` / `RedactedFromSelf` | `Schema.BigInt` / `Symbol` / `URL` / `Redacted` |
| `Schema.EitherFromSelf` | `Schema.Result` |
| `Schema.optionalWith(s, opts)` | no single replacement — see the decision tree in `migration/schema.md` §optionalWith |

Removed with no direct replacement: `Schema.keyof`, `Schema.Data`, `Schema.withDefaults`,
`Schema.NonEmptyArrayEnsure`.

`Schema.Redacted` also **changed meaning** — v3's `Redacted` is now `RedactedFromValue`, and
`Redacted` is the former `RedactedFromSelf`. Same for `Schema.Date`, whose encoded contract moved;
v3's `Date` is `Schema.DateFromString.check(Schema.isDateValid())`.

### Other things not to do

- **Don't validate by hand.** Per `ai-docs/.../02_schema/index.md`: *"AVOID using predicates or
  manual parsing"* — parse untrusted data through a schema instead. No hand-rolled type guards, no
  `typeof` chains at boundaries.
- **Don't annotate with `Codec` / `Schema` / `Top`.** Constraints only (§0).
- **Don't build the parser inside the request path.** Hoist `decodeUnknownEffect(S)` to module
  scope.
- **Don't reach for `*Sync` inside Effect code.** It throws, escaping the error channel; use
  `*Effect` and keep failures typed.
- **Don't leak `SchemaError` into domain logic.** Map it to a `TaggedErrorClass` at the boundary.
- **Don't ship the default formatter hooks to users.** They emit issue tags, by design.
- **Don't trust `SCHEMA.md` import lines or `Schema.makeOption`** (§0) — verify against
  `repos/effect/packages/effect/src/`.
- **Don't import from `repos/`.** Per `CLAUDE.md` it is read-only reference material;
  application code imports from real package dependencies.

---

## Source map

| Topic | Read in the checkout |
| --- | --- |
| Full guide (7.4k lines — read in chunks) | `packages/effect/SCHEMA.md` |
| House style, minimal | `ai-docs/src/01_effect/02_schema/` |
| v3 → v4 mapping table | `migration/schema.md` |
| Behaviour, verified | `packages/effect/test/schema/Schema.test.ts` |
| `optionalWith` replacements | `packages/effect/test/schema/v3-v4.test.ts` |
| Type-level expectations | `packages/effect/typetest/schema/` |
| Public API surface | `packages/effect/src/Schema.ts` and `Schema*.ts` siblings |
