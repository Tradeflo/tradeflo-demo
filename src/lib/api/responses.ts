import { NextResponse } from "next/server";

export function jsonOk<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { status: 200, ...init });
}

export function jsonError(
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}

export function unauthorized(message = "Unauthorized") {
  return jsonError(message, 401);
}

/** Use until route is fully implemented (e.g. before DB wiring). */
export function notImplemented(message: string) {
  return jsonError(message, 501);
}
