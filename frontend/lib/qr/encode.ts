/**
 * A QR encoder, written here rather than installed.
 *
 * Only what a table ordering link needs: byte mode, error correction level M,
 * versions 1 to 10. That covers any URL up to 213 bytes, which is far more than a
 * host plus a 32-character token, and leaves out the modes (numeric, alphanumeric,
 * kanji) and the versions this product will never produce. Encoding less means
 * fewer tables to get wrong.
 *
 * Level M recovers from roughly 15% damage. A card on a restaurant table gets wet,
 * greasy and scratched, so the lowest level would be the wrong saving.
 *
 * The layout rules below come from the QR standard and are not adjustable: a symbol
 * that departs from them is not a QR code, whatever it looks like. Where a constant
 * could have been hardcoded from a published table it is computed instead, so the
 * arithmetic is visible and a typo in a long table cannot hide.
 *
 * Everything internal is a typed array and the grid is one flat buffer, which is both
 * faster and easier to reason about than a grid of arrays: there is one index
 * calculation rather than two, and every read goes through the same guarded helper.
 */

/** A finished symbol: a square grid of dark and light modules. */
export interface QrSymbol {
  /** Modules along one edge. The quiet zone is not included; the renderer adds it. */
  size: number;
  /** Row-major grid. True is dark. */
  modules: boolean[][];
  /** Which version was needed for this content. */
  version: number;
}

/**
 * Reads one byte.
 *
 * Every index in this file is in range by construction, but the project checks indexed
 * access, and an assertion at each read would be a claim rather than a proof. Zero for
 * an out-of-range read is also the right answer in the one place it could happen: the
 * modules past the end of the codewords are light before masking.
 */
function byteAt(buffer: Uint8Array, index: number): number {
  return buffer[index] ?? 0;
}

/** Raised when the content is too long for the versions this encoder supports. */
export class QrTooLongError extends Error {
  constructor(byteLength: number) {
    super(`${byteLength} bytes is too long for a version 10 QR code.`);
    this.name = "QrTooLongError";
  }
}

/** How the codewords of one version divide into blocks at level M. */
interface BlockPlan {
  /** Error correction codewords in every block. */
  ecPerBlock: number;
  /** Data codewords per block, in the order they are laid out. */
  blocks: readonly number[];
}

/**
 * Error correction structure per version, at level M.
 *
 * Most versions cannot divide their codewords evenly, so the later blocks carry one
 * more than the earlier ones. Written out per block rather than as groups, because that
 * is the shape both the interleaving and the reader need.
 */
const BLOCK_PLANS: readonly BlockPlan[] = [
  { ecPerBlock: 10, blocks: [16] },
  { ecPerBlock: 16, blocks: [28] },
  { ecPerBlock: 26, blocks: [44] },
  { ecPerBlock: 18, blocks: [32, 32] },
  { ecPerBlock: 24, blocks: [43, 43] },
  { ecPerBlock: 16, blocks: [27, 27, 27, 27] },
  { ecPerBlock: 18, blocks: [31, 31, 31, 31] },
  { ecPerBlock: 22, blocks: [38, 38, 39, 39] },
  { ecPerBlock: 22, blocks: [36, 36, 36, 37, 37] },
  { ecPerBlock: 26, blocks: [43, 43, 43, 43, 44] },
];

/**
 * Where the alignment patterns sit, by version.
 *
 * Row and column centres are the same list, and a pattern is skipped where it would
 * land on a finder pattern.
 */
const ALIGNMENT_CENTRES: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/** The highest version this encoder produces. */
const MAX_VERSION = BLOCK_PLANS.length;

/** Level M, as the two bits that go into the format information. */
const EC_LEVEL_BITS = 0b00;

/** Generator for the format information code, a BCH(15, 5). */
const FORMAT_GENERATOR = 0b101_0011_0111;

/** Applied to the format information so an all-light symbol is not a valid one. */
const FORMAT_XOR = 0b101_0100_0001_0010;

/** Generator for the version information code, a BCH(18, 6). */
const VERSION_GENERATOR = 0b1_1111_0010_0101;

/** Byte mode, as the four bits that open the data segment. */
const BYTE_MODE = 0b0100;

/** The two bytes the standard pads with, alternating, after the terminator. */
const PAD_BYTES = [0b1110_1100, 0b0001_0001] as const;

/**
 * Encodes text as a QR symbol.
 *
 * @throws {QrTooLongError} When the content needs a version above 10.
 */
export function encodeQr(text: string): QrSymbol {
  const data = new TextEncoder().encode(text);
  const version = versionFor(data.length);
  const size = 17 + version * 4;

  const codewords = withErrorCorrection(dataCodewordsFor(data, version), version);

  // Every mask is tried and scored, because the penalties depend on the content: there
  // is no mask that is best in general, only one that is best for this symbol.
  let best = draw(size, version, codewords, 0);
  let bestPenalty = penaltyOf(best, size);

  for (let mask = 1; mask < 8; mask++) {
    const candidate = draw(size, version, codewords, mask);
    const penalty = penaltyOf(candidate, size);

    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
    }
  }

  return { size, modules: toRows(best, size), version };
}

/** The block plan for a version, which is also the check that the version exists. */
function planFor(version: number): BlockPlan {
  const plan = BLOCK_PLANS[version - 1];

  if (plan === undefined) {
    throw new RangeError(`Version ${version} is outside 1 to ${MAX_VERSION}.`);
  }

  return plan;
}

function dataCapacityOf(version: number): number {
  return planFor(version).blocks.reduce((total, block) => total + block, 0);
}

/** The smallest supported version that holds this many bytes at level M. */
function versionFor(byteLength: number): number {
  for (let version = 1; version <= MAX_VERSION; version++) {
    // The character count field widens at version 10, which is why capacity is worked
    // out per version rather than compared against one table of maximums.
    const countBits = version < 10 ? 8 : 16;
    const needed = 4 + countBits + byteLength * 8;

    if (needed <= dataCapacityOf(version) * 8) {
      return version;
    }
  }

  throw new QrTooLongError(byteLength);
}

/**
 * Turns the content into the data codewords for a version: mode, length, bytes,
 * terminator, and padding out to the exact capacity.
 */
function dataCodewordsFor(data: Uint8Array, version: number): Uint8Array {
  const capacity = dataCapacityOf(version);
  const codewords = new Uint8Array(capacity);

  let bit = 0;

  const push = (value: number, width: number) => {
    for (let index = width - 1; index >= 0; index--) {
      if ((value >> index) & 1) {
        // Written straight into the codeword it belongs to. There is no intermediate
        // list of bits, so there is nothing to fall out of step with.
        const at = bit >> 3;

        codewords[at] = byteAt(codewords, at) | (0b1000_0000 >> (bit & 7));
      }

      bit++;
    }
  };

  push(BYTE_MODE, 4);
  push(data.length, version < 10 ? 8 : 16);

  for (const byte of data) {
    push(byte, 8);
  }

  // The terminator and the bits up to the codeword boundary are already zero, so they
  // need no writing: the buffer started empty. Padding begins at the next whole
  // codeword after the content.
  const used = Math.ceil(bit / 8);

  for (let index = used; index < capacity; index++) {
    codewords[index] = (index - used) % 2 === 0 ? PAD_BYTES[0] : PAD_BYTES[1];
  }

  return codewords;
}

/* -------------------------------------------------------------- Reed-Solomon */

/**
 * Logarithm and antilogarithm tables for the field the standard uses: 256 elements,
 * primitive polynomial 0x11D.
 *
 * Built once at module load. Multiplication in this field is addition of logarithms,
 * which is what makes the division below cheap enough to do per block.
 */
const EXP = new Uint8Array(255);
const LOG = new Uint8Array(256);

{
  let value = 1;

  for (let index = 0; index < 255; index++) {
    EXP[index] = value;
    LOG[value] = index;

    value <<= 1;

    if (value & 0x100) {
      value ^= 0x11d;
    }
  }
}

function multiply(left: number, right: number): number {
  return left === 0 || right === 0
    ? 0
    : byteAt(EXP, (byteAt(LOG, left) + byteAt(LOG, right)) % 255);
}

/**
 * The generator polynomial for a given number of error correction codewords, as the
 * product of (x - a^0)(x - a^1)…
 *
 * Index zero is the leading coefficient, which is always one.
 */
function generatorPolynomial(degree: number): Uint8Array {
  let polynomial = new Uint8Array(1);
  polynomial[0] = 1;

  for (let index = 0; index < degree; index++) {
    const next = new Uint8Array(polynomial.length + 1);

    for (let position = 0; position < polynomial.length; position++) {
      const coefficient = byteAt(polynomial, position);

      next[position] = byteAt(next, position) ^ coefficient;
      next[position + 1] =
        byteAt(next, position + 1) ^ multiply(coefficient, byteAt(EXP, index));
    }

    polynomial = next;
  }

  return polynomial;
}

/** The error correction codewords for one block. */
function remainderOf(block: Uint8Array, ecCount: number): Uint8Array {
  const generator = generatorPolynomial(ecCount);
  const remainder = new Uint8Array(ecCount);

  for (const codeword of block) {
    const factor = codeword ^ byteAt(remainder, 0);

    remainder.copyWithin(0, 1);
    remainder[ecCount - 1] = 0;

    for (let index = 0; index < ecCount; index++) {
      remainder[index] =
        byteAt(remainder, index) ^ multiply(byteAt(generator, index + 1), factor);
    }
  }

  return remainder;
}

/**
 * Splits the data into blocks, computes error correction for each, and interleaves the
 * result.
 *
 * Interleaving is the point of the exercise. Damage to a printed code is physical and
 * local, so spreading each block across the whole symbol means a coffee ring takes a few
 * codewords from every block rather than destroying one outright.
 */
function withErrorCorrection(dataCodewords: Uint8Array, version: number): Uint8Array {
  const { ecPerBlock, blocks } = planFor(version);

  const dataBlocks: Uint8Array[] = [];
  let offset = 0;

  for (const length of blocks) {
    dataBlocks.push(dataCodewords.subarray(offset, offset + length));
    offset += length;
  }

  const ecBlocks = dataBlocks.map((block) => remainderOf(block, ecPerBlock));
  const longest = Math.max(...blocks);

  const interleaved = new Uint8Array(
    dataCodewords.length + ecPerBlock * dataBlocks.length,
  );

  let position = 0;

  for (let index = 0; index < longest; index++) {
    for (const block of dataBlocks) {
      if (index < block.length) {
        interleaved[position] = byteAt(block, index);
        position++;
      }
    }
  }

  for (let index = 0; index < ecPerBlock; index++) {
    for (const block of ecBlocks) {
      interleaved[position] = byteAt(block, index);
      position++;
    }
  }

  return interleaved;
}

/* ------------------------------------------------------------------- Drawing */

/** Dark, in the flat grid. */
const DARK = 1;

/** Claimed by a fixed pattern, so the data placement steps over it. */
const RESERVED = 2;

/**
 * Lays out one candidate symbol: the fixed patterns, the format and version
 * information, then the data woven through what is left with the given mask applied.
 *
 * One flat buffer, two bits per module: whether it is dark, and whether it belongs to a
 * fixed pattern. Keeping both together means the data placement cannot disagree with the
 * pattern drawing about which modules are free.
 */
function draw(
  size: number,
  version: number,
  codewords: Uint8Array,
  mask: number,
): Uint8Array {
  const grid = new Uint8Array(size * size);

  const put = (row: number, column: number, dark: boolean) => {
    grid[row * size + column] = (dark ? DARK : 0) | RESERVED;
  };

  const isFree = (row: number, column: number) =>
    (byteAt(grid, row * size + column) & RESERVED) === 0;

  // Finder patterns and their separators, at three corners. The fourth corner is left
  // free, which is how a scanner works out the rotation.
  for (const [row, column] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let offset = -1; offset <= 7; offset++) {
      for (let inner = -1; inner <= 7; inner++) {
        const r = row + offset;
        const c = column + inner;

        if (r < 0 || r >= size || c < 0 || c >= size) {
          continue;
        }

        const ring = Math.max(Math.abs(offset - 3), Math.abs(inner - 3));

        put(r, c, ring !== 2 && ring <= 3);
      }
    }
  }

  // Timing patterns: an alternating line along row and column six, which gives a
  // scanner the module pitch.
  for (let index = 8; index < size - 8; index++) {
    put(6, index, index % 2 === 0);
    put(index, 6, index % 2 === 0);
  }

  // Alignment patterns, skipped where they would sit on a finder pattern.
  const centres = ALIGNMENT_CENTRES[version - 1] ?? [];

  for (const row of centres) {
    for (const column of centres) {
      const onFinder =
        (row === 6 && column === 6) ||
        (row === 6 && column === size - 7) ||
        (row === size - 7 && column === 6);

      if (onFinder) {
        continue;
      }

      for (let offset = -2; offset <= 2; offset++) {
        for (let inner = -2; inner <= 2; inner++) {
          const ring = Math.max(Math.abs(offset), Math.abs(inner));

          put(row + offset, column + inner, ring !== 1);
        }
      }
    }
  }

  // The dark module, which is always set. Claimed before the format areas below, so
  // they cannot take it.
  put(size - 8, 8, true);

  // The format information areas: reserved now, written once the mask is known.
  for (let index = 0; index <= 8; index++) {
    if (isFree(8, index)) put(8, index, false);
    if (isFree(index, 8)) put(index, 8, false);
  }

  for (let index = 0; index < 8; index++) {
    if (isFree(8, size - 1 - index)) put(8, size - 1 - index, false);
    if (isFree(size - 1 - index, 8)) put(size - 1 - index, 8, false);
  }

  // Version information, from version seven onwards, in two blocks of eighteen.
  if (version >= 7) {
    const info = versionInformation(version);

    for (let index = 0; index < 18; index++) {
      const dark = ((info >> index) & 1) === 1;
      const row = Math.floor(index / 3);
      const column = index % 3;

      put(row, size - 11 + column, dark);
      put(size - 11 + column, row, dark);
    }
  }

  placeData(grid, size, codewords, mask);
  placeFormat(grid, size, mask);

  return grid;
}

/**
 * Weaves the codewords through the free modules.
 *
 * Two modules wide, bottom to top and then top to bottom, right to left, with column
 * six skipped because the timing pattern owns it. The mask is applied as each module is
 * written rather than in a second pass, since the two always happen together.
 */
function placeData(
  grid: Uint8Array,
  size: number,
  codewords: Uint8Array,
  mask: number,
): void {
  let bit = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    const column = right <= 6 ? right - 1 : right;

    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;

      for (const offset of [0, 1]) {
        const target = column - offset;
        const cell = row * size + target;

        if ((byteAt(grid, cell) & RESERVED) !== 0) {
          continue;
        }

        // Past the end of the codewords the remaining modules stay light before
        // masking, which is what the standard says happens to the leftovers.
        const byte = byteAt(codewords, bit >> 3);
        const dark = ((byte >> (7 - (bit & 7))) & 1) === 1;

        grid[cell] = dark !== maskAt(mask, row, target) ? DARK : 0;
        bit++;
      }
    }

    upward = !upward;
  }
}

/** Whether the given mask inverts this module. */
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

/** Writes the format information, twice, so it survives damage to one corner. */
function placeFormat(grid: Uint8Array, size: number, mask: number): void {
  const info = formatInformation(mask);

  const write = (row: number, column: number, index: number) => {
    grid[row * size + column] = ((info >> index) & 1) === 1 ? DARK : 0;
  };

  // First copy: along the top of the top-left finder, then down its left.
  for (let index = 0; index <= 5; index++) {
    write(8, index, index);
  }

  write(8, 7, 6);
  write(8, 8, 7);
  write(7, 8, 8);

  for (let index = 9; index <= 14; index++) {
    write(14 - index, 8, index);
  }

  // Second copy: seven bits up from the bottom-left finder, then eight in from the
  // top-right. Seven and eight rather than eight and seven, because the module just
  // above the bottom-left block is the dark module and belongs to nobody else.
  for (let index = 0; index <= 6; index++) {
    write(size - 1 - index, 8, index);
  }

  for (let index = 7; index <= 14; index++) {
    write(8, size - 15 + index, index);
  }
}

/** The fifteen bits describing the error correction level and mask. */
function formatInformation(mask: number): number {
  const data = (EC_LEVEL_BITS << 3) | mask;

  return ((data << 10) | bch(data << 10, FORMAT_GENERATOR, 10)) ^ FORMAT_XOR;
}

/** The eighteen bits describing the version, present from version seven. */
function versionInformation(version: number): number {
  return (version << 12) | bch(version << 12, VERSION_GENERATOR, 12);
}

/**
 * The remainder of a polynomial division in GF(2), which is what both BCH codes here
 * reduce to.
 */
function bch(value: number, generator: number, degree: number): number {
  let remainder = value;

  while (bitLength(remainder) > degree) {
    remainder ^= generator << (bitLength(remainder) - bitLength(generator));
  }

  return remainder;
}

function bitLength(value: number): number {
  return value === 0 ? 0 : 32 - Math.clz32(value);
}

/** Turns the working grid into the row-major booleans the renderer wants. */
function toRows(grid: Uint8Array, size: number): boolean[][] {
  const rows: boolean[][] = [];

  for (let row = 0; row < size; row++) {
    const line = new Array<boolean>(size);

    for (let column = 0; column < size; column++) {
      line[column] = (byteAt(grid, row * size + column) & DARK) !== 0;
    }

    rows.push(line);
  }

  return rows;
}

/* ------------------------------------------------------------------ Penalties */

/**
 * Scores a masked symbol. Lower is better.
 *
 * The four rules exist to keep a symbol from resembling its own finder patterns or
 * drifting into large flat areas, both of which confuse a scanner. The weights come from
 * the standard.
 */
function penaltyOf(grid: Uint8Array, size: number): number {
  let penalty = 0;
  let dark = 0;

  const at = (row: number, column: number) =>
    (byteAt(grid, row * size + column) & DARK) !== 0;

  const line = new Uint8Array(size);

  for (let index = 0; index < size; index++) {
    // Rule one, both directions: runs of five or more in a line.
    for (let position = 0; position < size; position++) {
      line[position] = at(index, position) ? 1 : 0;
    }

    penalty += runPenalty(line) + finderLikePenalty(line);

    for (let position = 0; position < size; position++) {
      line[position] = at(position, index) ? 1 : 0;
    }

    penalty += runPenalty(line) + finderLikePenalty(line);
  }

  // Rule two: every two by two block of one colour.
  for (let row = 0; row < size - 1; row++) {
    for (let column = 0; column < size - 1; column++) {
      const first = at(row, column);

      if (
        first === at(row, column + 1) &&
        first === at(row + 1, column) &&
        first === at(row + 1, column + 1)
      ) {
        penalty += 3;
      }
    }
  }

  // Rule four: how far the symbol is from half dark.
  for (let index = 0; index < grid.length; index++) {
    if ((byteAt(grid, index) & DARK) !== 0) {
      dark++;
    }
  }

  const percent = (dark * 100) / (size * size);

  return penalty + Math.floor(Math.abs(percent - 50) / 5) * 10;
}

function runPenalty(line: Uint8Array): number {
  let penalty = 0;
  let run = 1;

  for (let index = 1; index < line.length; index++) {
    if (byteAt(line, index) === byteAt(line, index - 1)) {
      run++;
      continue;
    }

    if (run >= 5) {
      penalty += 3 + (run - 5);
    }

    run = 1;
  }

  return run >= 5 ? penalty + 3 + (run - 5) : penalty;
}

/**
 * The dark-light-dark-dark-dark-light-dark run that a finder pattern makes, with four
 * light modules on either side. Either arrangement costs the same.
 */
const FINDER_LIKE: readonly Uint8Array[] = [
  Uint8Array.from([1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]),
  Uint8Array.from([0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]),
];

function finderLikePenalty(line: Uint8Array): number {
  let penalty = 0;

  for (let start = 0; start + 11 <= line.length; start++) {
    for (const pattern of FINDER_LIKE) {
      let matches = true;

      for (let offset = 0; offset < 11; offset++) {
        if (byteAt(line, start + offset) !== byteAt(pattern, offset)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        penalty += 40;
      }
    }
  }

  return penalty;
}
