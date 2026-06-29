type PageData =
  | {
      type: "image";
      label: string;
      url_label: string;
      image_source?: string;
      image_avif?: string;
      image_fallback?: string;
    }
  | {
      type: "spread";
      label: string;
      url_label: string;
      left_source?: string;
      right_source?: string;
      left_avif?: string;
      right_avif?: string;
      left_fallback?: string;
      right_fallback?: string;
    };

// Pure JS base64 decoder — no atob, no Buffer, no fetch, no recursion
function base64ToUint8Array(base64: string): Uint8Array {
  console.log("[2] Using pure JS base64 decoder");

  // Build lookup table once
  const lookup = new Uint8Array(256);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Account for padding
  const len = base64.length;
  let outputLen = Math.floor((len * 3) / 4);
  if (base64[len - 1] === "=") outputLen--;
  if (base64[len - 2] === "=") outputLen--;

  console.log(`[2] Expected output length: ${outputLen} bytes`);

  const bytes = new Uint8Array(outputLen);
  let p = 0;

  // Process 4 base64 chars -> 3 bytes at a time, fully iterative
  for (let i = 0; i < len; i += 4) {
    const a = lookup[base64.charCodeAt(i)];
    const b = lookup[base64.charCodeAt(i + 1)];
    const c = lookup[base64.charCodeAt(i + 2)];
    const d = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < outputLen) bytes[p++] = ((b & 0xf) << 4) | (c >> 2);
    if (p < outputLen) bytes[p++] = ((c & 0x3) << 6) | (d & 0x3f);
  }

  console.log(`[2] Decoded ${p} bytes`);
  return bytes;
}

async function decryptReaderData(base64Data: string, hostname: string): Promise<PageData[]> {
  console.log("[1] Starting decryption...");
  console.log(`[1] base64Data length: ${base64Data.length}`);
  console.log(`[1] hostname: ${hostname}`);

  console.log("[2] Decoding base64...");
  const bytes = base64ToUint8Array(base64Data);
  console.log(`[2] Done. bytes length: ${bytes.length}`);
  // Step 2: XOR
  console.log("[3] XOR step...");
  const xorLen = Math.min(hostname.length, 64);
  console.log(`[3] xorLen: ${xorLen}`);
  for (let i = 0; i < xorLen; i++) {
    bytes[i] ^= hostname.charCodeAt(i);
  }
  console.log("[3] XOR done");

  // Step 3: Sieve
  console.log("[4] Sieve of Eratosthenes...");
  const sieve: boolean[] = [];
  const primes: number[] = [];
  for (let n = 2; primes.length < 16; n++) {
    if (!sieve[n]) {
      primes.push(n);
      for (let m = n * 2; m <= 256; m += n) sieve[m] = true;
    }
  }
  console.log(`[4] First 16 primes: ${primes.toString()}`);

  // Step 4: CRC
  console.log("[5] CRC hash...");
  let crc = 0;
  for (let i = 0; i < 64; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xc : crc >>> 1;
    }
  }
  const primeStep = primes[crc & 0x7];
  console.log(`[5] crc: ${crc}, primeStep: ${primeStep}`);

  // Step 5: RC4 KSA
  console.log("[6] RC4 KSA...");
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + bytes[i % 64]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  console.log("[6] RC4 KSA done");
  console.log(`[6] First 8 bytes of S-box: ${Array.from(S.slice(0, 8)).toString()}`);

  // Step 6: PRGA
  console.log("[7] RC4 PRGA...");
  const plaintextLen = bytes.length - 64;
  console.log(`[7] plaintextLen: ${plaintextLen}`);
  const plaintextBytes = new Uint8Array(plaintextLen);
  let idx = 0,
    jj = 0,
    extra = 0,
    K = 0;

  for (let pos = 0; pos < plaintextLen; pos++) {
    if (pos % 10000 === 0) {
      console.log(`[7] PRGA progress: ${pos}/${plaintextLen}`);
    }
    idx = (idx + primeStep) & 0xff;
    const newJj = (extra + S[(jj + S[idx]) & 0xff]) & 0xff;
    extra = (extra + idx + S[idx]) & 0xff;
    [S[idx], S[newJj]] = [S[newJj], S[idx]];
    jj = newJj;
    K = S[(jj + S[(idx + S[(K + extra) & 0xff]) & 0xff]) & 0xff];
    plaintextBytes[pos] = bytes[pos + 64] ^ K;
  }
  console.log("[7] PRGA done");

  // Step 7: Decode
  console.log("[8] Decoding UTF-8...");
  const jsonStr = new TextDecoder().decode(plaintextBytes);
  console.log(`[8] jsonStr length: ${jsonStr.length}`);
  console.log(`[8] jsonStr first 100 chars: ${jsonStr.slice(0, 100)}`);
  console.log(`[8] jsonStr last 100 chars: ${jsonStr.slice(-100)}`);

  // Step 8: JSON parse
  console.log("[9] Parsing JSON...");
  const result = JSON.parse(jsonStr) as PageData[];
  console.log(`[9] Parsed ${result.length} pages`);
  console.log(`[9] First page: ${JSON.stringify(result[0])}`);
  return result;
}

function parseBase64FromHtml(html: string): string {
  console.log(`[HTML] html length: ${html.length}`);
  const marker = 'initReader("';
  const start = html.indexOf(marker);
  console.log(`[HTML] initReader found at index: ${start}`);
  if (start === -1) throw new Error("initReader() not found in HTML");

  const b64Start = start + marker.length;
  const b64End = html.indexOf('"', b64Start);
  console.log(`[HTML] base64 starts at: ${b64Start}, ends at: ${b64End}`);
  if (b64End === -1) throw new Error("Could not find end of base64 argument");

  const result = html.slice(b64Start, b64End);
  console.log(`[HTML] extracted base64 length: ${result.length}`);
  return result;
}

export async function extractImageUrls(base64Data: string, hostname: string): Promise<string[]> {
  console.log("[extractImageUrls] Starting...");
  const pages = await decryptReaderData(base64Data, hostname);
  console.log(`[extractImageUrls] Got ${pages.length} pages, extracting URLs...`);

  const urls: string[] = [];
  for (const page of pages) {
    if (page.type === "image") {
      const url = page.image_source ?? page.image_fallback ?? page.image_avif;
      if (url) urls.push(url);
    } else if (page.type === "spread") {
      const left = page.left_source ?? page.left_fallback ?? page.left_avif;
      const right = page.right_source ?? page.right_fallback ?? page.right_avif;
      if (left) urls.push(left);
      if (right) urls.push(right);
    } else {
      console.warn(`[extractImageUrls] Unknown page type: ${(page as any).type}`);
    }
  }

  console.log(`[extractImageUrls] Done. Found ${urls.length} URLs`);
  return urls;
}

export async function extractFromUrl(pageUrl: string): Promise<string[]> {
  const { hostname } = new URL(pageUrl);
  const html = await fetch(pageUrl).then((r) => r.text());
  return extractImageUrls(parseBase64FromHtml(html), hostname);
}

export async function extractFromHtml(html: string, hostname: string): Promise<string[]> {
  return extractImageUrls(parseBase64FromHtml(html), hostname);
}
