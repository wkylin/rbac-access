const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(secret: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const letter of secret.toUpperCase().replace(/=|\s/g, "")) {
    const digit = BASE32.indexOf(letter);
    if (digit < 0) throw new Error("验证器密钥格式错误。");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

async function codeAt(secret: string, counter: number): Promise<string> {
  const raw = decodeBase32(secret);
  const key = await crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const message = new ArrayBuffer(8);
  new DataView(message).setBigUint64(0, BigInt(counter));
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = digest[digest.length - 1]! & 15;
  const number = (((digest[offset]! & 127) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!) >>> 0;
  return String(number % 1_000_000).padStart(6, "0");
}

export async function verifyCode(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code.trim())) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (const drift of [-1, 0, 1]) {
    if ((await codeAt(secret, counter + drift)) === code.trim()) return true;
  }
  return false;
}

export function otpauthUri(username: string, secret: string): string {
  const issuer = "权限实验室";
  const label = encodeURIComponent(`${issuer}:${username}`);
  const query = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${query}`;
}

export const secondsRemaining = (): number => 30 - (Math.floor(Date.now() / 1000) % 30);
