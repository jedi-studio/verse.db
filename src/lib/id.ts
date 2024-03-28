/**
 * Generates a random ID.
 * @returns A random ID string.
 */
export function randomID() {
  const uuid = randomUUID();
  const idWithoutHyphens = uuid.replace(/-/g, "");
  return idWithoutHyphens;
}

/**
 * Generates a random UUID.
 * @returns A random UUID string.
 */
export function randomUUID(): string {
  let timestamp = Date.now();

  const replacer = (char: string) => {
    let random = Math.random() * 16;
    let result: number;

    result = (timestamp + random) % 16 | 0;
    timestamp = Math.floor(timestamp / 16);

    return (char === "x" ? result : (result & 0x3) | 0x8).toString(16);
  };

  return "xxxxxV-xxxxxE-xxxxxR-xxxxxS-xxxxxE".replace(/[xy]/g, replacer);
}
