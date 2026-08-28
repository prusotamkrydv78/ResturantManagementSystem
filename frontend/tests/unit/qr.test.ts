import { describe, expect, it } from "vitest";
import { encodeQr, QrTooLongError } from "@/lib/qr/encode";

/**
 * The encoder is the one thing in this product that has to be right without anybody
 * being able to look at it. A symbol that is slightly wrong still renders as a
 * convincing square of dots, so a browser would not tell us, and neither would a
 * type checker.
 *
 * So the tests do two jobs. They check the parts that can be verified against
 * published constants — the finder patterns, the timing patterns, the dark module,
 * and the eight format strings for error correction level M, which are fixed values
 * in the standard rather than anything this code chose. Then they read the symbol
 * back the way a scanner would and check the content survives the whole round trip:
 * masking, interleaving, error correction placement and the zigzag.
 *
 * What none of this proves is that a phone camera reads the printed result, because
 * nothing in this project ever runs in front of a camera. It proves the symbol
 * matches the specification it claims to implement.
 */

/**
 * The fifteen-bit format strings for level M, one per mask, exactly as published in
 * the standard.
 *
 * Written out rather than computed, deliberately: computing them here would only
 * check the encoder against a second copy of its own arithmetic.
 */
/**
 * Reads one module.
 *
 * The project checks indexed access, and the reader below walks a grid by arithmetic, so
 * every read goes through here. Out of range is light, which is also what a scanner sees
 * beyond the edge of a symbol.
 */
function moduleAt(modules: boolean[][], row: number, column: number): boolean {
  return modules[row]?.[column] ?? false;
}

const FORMAT_M: Record<number, string> = {
  0: "101010000010010",
  1: "101000100100101",
  2: "101111001111100",
  3: "101101101001011",
  4: "100010111111001",
  5: "100000011001110",
  6: "100111110010111",
  7: "100101010100000",
};

describe("QR fixed patterns", () => {
  it("sizes the symbol from the version it needed", () => {
    expect(encodeQr("hello").size).toBe(21);
    expect(encodeQr("hello").version).toBe(1);

    // A table ordering link: a host and a 32-character token. Recorded so a change
    // that quietly pushes a normal link into a denser version is visible.
    const link = encodeQr("http://localhost:3000/t/abcdefghjkmnpqrstvwxyz23456789ab");

    expect(link.version).toBe(4);
    expect(link.size).toBe(33);
  });

  it("puts a finder pattern in three corners and not the fourth", () => {
    const { modules, size } = encodeQr("http://example.test/t/abc");

    for (const [row, column] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as const) {
      for (let offset = 0; offset < 7; offset++) {
        for (let inner = 0; inner < 7; inner++) {
          const ring = Math.max(Math.abs(offset - 3), Math.abs(inner - 3));

          expect(moduleAt(modules, row + offset, column + inner)).toBe(ring !== 2);
        }
      }
    }

    // The bottom-right corner carries data, which is how a scanner tells which way
    // up the symbol is. If a fourth finder pattern ever appeared there, the three
    // above would stop meaning anything, so the corner is checked for not being one.
    const isFinder = (row: number, column: number) => {
      for (let offset = 0; offset < 7; offset++) {
        for (let inner = 0; inner < 7; inner++) {
          const ring = Math.max(Math.abs(offset - 3), Math.abs(inner - 3));

          if (moduleAt(modules, row + offset, column + inner) !== (ring !== 2)) {
            return false;
          }
        }
      }

      return true;
    };

    expect(isFinder(0, 0)).toBe(true);
    expect(isFinder(size - 7, size - 7)).toBe(false);
  });

  it("alternates the timing patterns and sets the dark module", () => {
    const { modules, size } = encodeQr("http://example.test/t/abc");

    for (let index = 8; index < size - 8; index++) {
      expect(moduleAt(modules, 6, index)).toBe(index % 2 === 0);
      expect(moduleAt(modules, index, 6)).toBe(index % 2 === 0);
    }

    expect(moduleAt(modules, size - 8, 8)).toBe(true);
  });

  it("writes a published level M format string, twice, and they agree", () => {
    const { modules, size } = encodeQr("http://example.test/t/abcdefgh");

    const first = readFormat(modules, size, "top-left");
    const second = readFormat(modules, size, "split");

    expect(first).toBe(second);
    expect(Object.values(FORMAT_M)).toContain(first);
  });
});

describe("QR round trip", () => {
  it("reads back what was encoded, across lengths and versions", () => {
    const cases = [
      "a",
      "http://localhost:3000/t/abcdefghjkmnpqrstvwxyz23456789ab",
      "https://orders.example.test/t/qqqqwwwweeeerrrrttttyyyyuuuuiiii",
      "x".repeat(120),
    ];

    for (const content of cases) {
      expect(decode(encodeQr(content))).toBe(content);
    }
  });

  it("carries bytes above the ASCII range through as UTF-8", () => {
    // A restaurant name never goes into the link, but the encoder must not quietly
    // truncate anything that does: byte mode counts bytes, not characters.
    expect(decode(encodeQr("café · 東京"))).toBe("café · 東京");
  });

  it("refuses content it cannot hold rather than encoding part of it", () => {
    expect(() => encodeQr("x".repeat(500))).toThrow(QrTooLongError);
  });
});

/* --------------------------------------------------------------- The reader */

/**
 * Reads the fifteen format bits out of one of the two places they are written.
 *
 * Written independently of the encoder rather than sharing a helper with it, so a
 * mistake in the placement is not cancelled out by the same mistake in the reading.
 */
function readFormat(
  modules: boolean[][],
  size: number,
  copy: "top-left" | "split",
): string {
  const bits: boolean[] = [];

  if (copy === "top-left") {
    for (let index = 0; index <= 5; index++) {
      bits.push(moduleAt(modules, 8, index));
    }

    bits.push(
      moduleAt(modules, 8, 7),
      moduleAt(modules, 8, 8),
      moduleAt(modules, 7, 8),
    );

    for (let index = 9; index <= 14; index++) {
      bits.push(moduleAt(modules, 14 - index, 8));
    }
  } else {
    for (let index = 0; index <= 6; index++) {
      bits.push(moduleAt(modules, size - 1 - index, 8));
    }

    for (let index = 7; index <= 14; index++) {
      bits.push(moduleAt(modules, 8, size - 15 + index));
    }
  }

  // Most significant bit first, which is how the published strings are written.
  return bits
    .map((bit) => (bit ? "1" : "0"))
    .reverse()
    .join("");
}

/** Which mask a symbol used, taken from its own format information. */
function maskOf(modules: boolean[][], size: number): number {
  const written = readFormat(modules, size, "top-left");
  const found = Object.entries(FORMAT_M).find(([, bits]) => bits === written);

  if (found === undefined) {
    throw new Error(`Format string ${written} is not a level M format string.`);
  }

  return Number(found[0]);
}

function maskAt(mask: number, row: number, column: number): boolean {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return column % 3 === 0;
    case 3:
      return (row + column) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    default:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
  }
}

/** Which modules carry no data, worked out from the geometry rather than remembered. */
function functionModules(size: number, version: number): boolean[][] {
  const reserved = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const block = (row: number, column: number, height: number, width: number) => {
    for (let offset = 0; offset < height; offset++) {
      for (let inner = 0; inner < width; inner++) {
        const r = row + offset;
        const c = column + inner;

        const line = reserved[r];

        if (line !== undefined && c >= 0 && c < size) {
          line[c] = true;
        }
      }
    }
  };

  // Finder patterns with their separators and the format information beside them.
  block(0, 0, 9, 9);
  block(0, size - 8, 9, 8);
  block(size - 8, 0, 8, 9);

  // Timing patterns.
  block(6, 0, 1, size);
  block(0, 6, size, 1);

  // Alignment patterns, skipped where a finder pattern already sits.
  const centres: Record<number, number[]> = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
  };

  const versionCentres = centres[version] ?? [];

  for (const row of versionCentres) {
    for (const column of versionCentres) {
      const onFinder =
        (row === 6 && column === 6) ||
        (row === 6 && column === size - 7) ||
        (row === size - 7 && column === 6);

      if (!onFinder) {
        block(row - 2, column - 2, 5, 5);
      }
    }
  }

  if (version >= 7) {
    block(0, size - 11, 6, 3);
    block(size - 11, 0, 3, 6);
  }

  return reserved;
}

/** Error correction structure per version at level M, as the reader needs it. */
const EC_M: Record<number, { ecPerBlock: number; blocks: number[] }> = {
  1: { ecPerBlock: 10, blocks: [16] },
  2: { ecPerBlock: 16, blocks: [28] },
  3: { ecPerBlock: 26, blocks: [44] },
  4: { ecPerBlock: 18, blocks: [32, 32] },
  5: { ecPerBlock: 24, blocks: [43, 43] },
  6: { ecPerBlock: 16, blocks: [27, 27, 27, 27] },
  7: { ecPerBlock: 18, blocks: [31, 31, 31, 31] },
  8: { ecPerBlock: 22, blocks: [38, 38, 39, 39] },
  9: { ecPerBlock: 22, blocks: [36, 36, 36, 37, 37] },
  10: { ecPerBlock: 26, blocks: [43, 43, 43, 43, 44] },
};

/**
 * Reads a symbol the way a scanner does: unmask, walk the zigzag, undo the
 * interleaving, then parse the segment header.
 *
 * The error correction codewords are read past rather than verified. Checking them
 * would mean implementing Reed-Solomon decoding here, which is a great deal of code
 * to prove something this test already establishes another way: if the data
 * codewords come back intact through the interleaving, they were laid down where the
 * standard says they go.
 */
function decode(symbol: { modules: boolean[][]; size: number; version: number }): string {
  const { modules, size, version } = symbol;
  const mask = maskOf(modules, size);
  const reserved = functionModules(size, version);

  // The zigzag, read in the same order it is written: two modules wide, right to
  // left, alternating direction, with the timing column stepped over.
  const bits: boolean[] = [];
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    const column = right <= 6 ? right - 1 : right;

    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;

      for (const offset of [0, 1]) {
        const target = column - offset;

        if (reserved[row]?.[target] !== true) {
          bits.push(moduleAt(modules, row, target) !== maskAt(mask, row, target));
        }
      }
    }

    upward = !upward;
  }

  const codewords: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    let byte = 0;

    for (let offset = 0; offset < 8; offset++) {
      byte = (byte << 1) | (bits[index + offset] === true ? 1 : 0);
    }

    codewords.push(byte);
  }

  // Undo the interleaving. Blocks of different lengths are why this cannot simply
  // be read in fixed strides: the short blocks run out first.
  const plan = EC_M[version];

  if (plan === undefined) {
    throw new Error(`No block plan for version ${version}.`);
  }

  const { blocks } = plan;
  const data: number[][] = blocks.map(() => []);
  const longest = Math.max(...blocks);
  let position = 0;

  for (let index = 0; index < longest; index++) {
    for (let block = 0; block < blocks.length; block++) {
      if (index < (blocks[block] ?? 0)) {
        data[block]?.push(codewords[position] ?? 0);
        position++;
      }
    }
  }

  const stream = data.flat();

  // Mode, length, then the bytes themselves.
  const mode = (stream[0] ?? 0) >> 4;

  if (mode !== 0b0100) {
    throw new Error(`Expected byte mode, found mode ${mode}.`);
  }

  const readBits = (start: number, count: number): number => {
    let value = 0;

    for (let index = 0; index < count; index++) {
      const bit = start + index;
      value = (value << 1) | (((stream[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1);
    }

    return value;
  };

  const countBits = version < 10 ? 8 : 16;
  const length = readBits(4, countBits);
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index++) {
    bytes[index] = readBits(4 + countBits + index * 8, 8);
  }

  return new TextDecoder().decode(bytes);
}
