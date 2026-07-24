import { uuidv7 as generate } from "uuidv7";

/** Application-generated UUIDv7 primary keys. Never use DB-side generation. */
export function uuidv7(): string {
  return generate();
}
