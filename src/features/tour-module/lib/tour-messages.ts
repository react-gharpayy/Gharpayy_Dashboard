// Now a no-op shim that just logs locally — no backend.
import type { Tour } from "./types";

export async function sendTourMessage(_opts: { tour: Tour; kind: string; channels: string[] }) {
  return { error: null as null | Error };
}
export async function logTourEvent(_tourId: string, _kind: string, _notes?: string) {
  return { error: null as null | Error };
}
