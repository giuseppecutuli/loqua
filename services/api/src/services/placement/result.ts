export type PlacementFailureStatus = 400 | 402 | 403 | 404 | 409 | 422 | 502 | 503;

export interface PlacementFailure {
  readonly ok: false;
  readonly status: PlacementFailureStatus;
  readonly code: string;
  readonly message: string;
}

export interface PlacementSuccess<T> {
  readonly ok: true;
  readonly status: 200 | 201;
  readonly body: T;
}

export type PlacementOutcome<T> = PlacementSuccess<T> | PlacementFailure;

export function failure(
  status: PlacementFailureStatus,
  code: string,
  message: string,
): PlacementFailure {
  return { ok: false, status, code, message };
}

export function success<T>(body: T, status: 200 | 201 = 200): PlacementSuccess<T> {
  return { ok: true, status, body };
}
