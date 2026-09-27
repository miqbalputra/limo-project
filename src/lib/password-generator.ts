const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALPHABET = `${UPPERCASE}${LOWERCASE}${DIGITS}`;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

function randomIndex(max: number) {
  const limit = Math.floor(256 / max) * max;
  const buffer = new Uint8Array(1);
  let value = 0;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % max;
}

function pick(source: string) {
  return source[randomIndex(source.length)];
}

export function generateStrongPassword(length = 14) {
  const target = Math.max(PASSWORD_MIN_LENGTH, Math.min(PASSWORD_MAX_LENGTH, Math.floor(length)));
  const characters = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS)];

  while (characters.length < target) {
    characters.push(pick(ALPHABET));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapWith = randomIndex(index + 1);
    [characters[index], characters[swapWith]] = [characters[swapWith], characters[index]];
  }

  return characters.join("");
}
