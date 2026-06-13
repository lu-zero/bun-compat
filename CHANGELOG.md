# Changelog

## [0.5.0]

### Added

- `Database.query()` method matching Bun's API (alias for `prepare()` returning
  a `Statement`).
- Exported `SqliteValue`, `SqliteRow`, `SqliteBinding` types from `sqlite.ts`.
- Exported `BunServer`, `ServeOptions` types from `serve.ts` via `from-bun.ts`.
- Exported `BunFileType` (structural interface) from `file.ts` via
  `from-bun.ts`.
- `BunServer<T>` is now generic.

### Changed

- `Statement.get()`, `.all()`, `.run()` now accept `SqliteValue | undefined`
  params (matching Bun where `undefined` is a valid "no binding" sentinel).
- `serve()` is now generic: `serve<T>(opts): BunServer<T>`.

### Fixed

- `Subprocess` type is now exported as generic from `from-bun.ts` (already was
  generic in implementation, now properly re-exported).
