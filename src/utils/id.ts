/** Unique ID generator: time component + random component. Not security sensitive. */
let counter = 0;

export function newId(prefix = ""): string {
  counter = (counter + 1) % 1679616;
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, "0");
  let rand = "";
  for (let i = 0; i < 10; i++) rand += Math.floor(Math.random() * 36).toString(36);
  return `${prefix}${time}${seq}${rand}`;
}

/** ISO-8601 UTC timestamp for created_at / updated_at. */
export function nowIso(): string {
  return new Date().toISOString();
}
