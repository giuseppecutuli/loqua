export interface ErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

export function errorResponse(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}
