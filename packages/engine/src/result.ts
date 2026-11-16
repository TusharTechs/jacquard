// Result type for expected failures. Public functions return values, never throw (design, Overview).
// An exception means an engine bug.

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

// The error type is a parameter, not defaulted to EngineError, because errors.ts is task 2.2.
// Task 2.2 adds `EngineResult<T> = Result<T, EngineError>` there.
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
