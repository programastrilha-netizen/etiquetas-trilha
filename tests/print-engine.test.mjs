import test from "node:test";
import assert from "node:assert/strict";
import {
  computeImposition,
  getFormatSize,
  buildPrintDocument,
  getPNGDimensions,
  withPngDpi,
} from "../print-engine.js";

const label = (widthMm, heightMm) => ({ kind: "label", widthMm, heightMm });
const settings = {
  marginMm: 8,
  gapMm: 3,
  copies: 25,
  perPage: 0,
  paperOrientation: "portrait",
};

test("6 × 3 cm labels keep their physical size and paginate on A4", () => {
  const result = computeImposition(label(60, 30), settings);
  assert.deepEqual(result.errors, []);
  assert.equal(result.columns, 3);
  assert.equal(result.rows, 8);
  assert.equal(result.capacity, 24);
  assert.equal(result.perPage, 24);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.positions[0], { xMm: 8, yMm: 8 });
  assert.deepEqual(result.positions[23], { xMm: 134, yMm: 239 });
  for (const position of result.positions) {
    assert.ok(position.xMm >= 8 && position.xMm + 60 <= 202);
    assert.ok(position.yMm >= 8 && position.yMm + 30 <= 289);
  }
});

test("4 × 6.5 cm labels do not swap the dimensions automatically", () => {
  const result = computeImposition(label(40, 65), settings);
  assert.equal(result.columns, 4);
  assert.equal(result.rows, 4);
  assert.equal(result.capacity, 16);
  assert.equal(result.pages, 2);
  assert.equal(result.itemWidthMm, 40);
  assert.equal(result.itemHeightMm, 65);
});

test("chosen labels per page limit slots without changing the label size", () => {
  const result = computeImposition(label(60, 30), {
    ...settings,
    copies: 13,
    perPage: 6,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.capacity, 24);
  assert.equal(result.perPage, 6);
  assert.equal(result.positions.length, 6);
  assert.equal(result.pages, 3);
  assert.equal(result.itemWidthMm, 60);
});

test("requested count beyond available space is rejected", () => {
  const result = computeImposition(label(60, 30), { ...settings, perPage: 25 });
  assert.ok(result.errors.some((error) => error.includes("24")));
  assert.equal(result.pages, 0);
  assert.deepEqual(result.positions, []);
});

test("spacing, margins and paper orientation affect available slots", () => {
  const tight = computeImposition(label(40, 40), {
    ...settings,
    marginMm: 0,
    gapMm: 0,
  });
  assert.equal(tight.capacity, 35);
  const landscape = computeImposition(label(100, 150), {
    ...settings,
    paperOrientation: "landscape",
  });
  assert.deepEqual(
    [landscape.paperWidthMm, landscape.paperHeightMm],
    [297, 210],
  );
  assert.equal(landscape.capacity, 2);
  const noSpace = computeImposition(label(210, 297), settings);
  assert.ok(noSpace.errors.length);
});

test("exact boundary fits despite floating point roundoff", () => {
  const result = computeImposition(label(62.666666666666664, 30), {
    ...settings,
    marginMm: 8,
    gapMm: 3,
  });
  assert.equal(result.columns, 3);
});

test("temporarily empty, negative, non-finite and noninteger settings return errors", () => {
  for (const [key, value] of [
    ["marginMm", ""],
    ["gapMm", -1],
    ["copies", 0],
    ["copies", 501],
    ["copies", 1.5],
    ["perPage", NaN],
    ["perPage", -2],
  ]) {
    const result = computeImposition(label(60, 30), {
      ...settings,
      [key]: value,
    });
    assert.ok(result.errors.length, key + ": " + value);
    assert.equal(result.pages, 0);
  }
  assert.ok(computeImposition(label("", 30), settings).errors.length);
  assert.ok(computeImposition(label(Infinity, 30), settings).errors.length);
});

test("posters use the final oriented physical dimensions, not A4 imposition", () => {
  const format = {
    kind: "poster",
    preset: "A3",
    widthMm: 420,
    heightMm: 297,
    orientation: "landscape",
  };
  const result = computeImposition(format, { ...settings, copies: 2 });
  assert.deepEqual([result.paperWidthMm, result.paperHeightMm], [420, 297]);
  assert.equal(result.pages, 2);
  assert.equal(result.capacity, 1);
  assert.deepEqual(result.positions, [{ xMm: 0, yMm: 0 }]);
  assert.deepEqual(getFormatSize({ preset: "A5", orientation: "landscape" }), {
    widthMm: 210,
    heightMm: 148,
  });
});

test("print document has one shared artwork and the correct last-page count", () => {
  const svg =
    '<svg viewBox="0 0 600 300" width="600" height="300"><defs><linearGradient id="paint"/></defs><rect width="600" height="300" fill="url(#paint)"/><image href="data:image/png;base64,UNIQUEPHOTODATA"/></svg>';
  const state = {
    format: label(60, 30),
    print: { ...settings, copies: 7, perPage: 6 },
    data: { product: "<Produto & exemplo>" },
  };
  const before = JSON.stringify(state);
  const html = buildPrintDocument(svg, state);
  assert.match(html, /@page\{size:210mm 297mm;margin:0\}/);
  assert.equal((html.match(/class="print-sheet"/g) || []).length, 2);
  assert.equal((html.match(/class="print-item"/g) || []).length, 7);
  assert.equal((html.match(/UNIQUEPHOTODATA/g) || []).length, 1);
  assert.equal((html.match(/<use /g) || []).length, 7);
  assert.match(html, /width:60mm;height:30mm/);
  assert.match(html, /&lt;Produto &amp; exemplo&gt;/);
  assert.equal(JSON.stringify(state), before, "state must not be mutated");
});

test("invalid physical layouts cannot be sent to print", () => {
  assert.throws(
    () =>
      buildPrintDocument("<svg></svg>", {
        format: label(400, 400),
        print: settings,
      }),
    /não cabe/,
  );
});

test("300 dpi exports have the expected poster and label pixel dimensions", () => {
  assert.deepEqual(getPNGDimensions({ widthMm: 210, heightMm: 297 }), {
    widthPx: 2480,
    heightPx: 3508,
    dpi: 300,
  });
  assert.deepEqual(getPNGDimensions({ widthMm: 60, heightMm: 30 }), {
    widthPx: 709,
    heightPx: 354,
    dpi: 300,
  });
  assert.deepEqual(getPNGDimensions({ widthMm: 420, heightMm: 297 }), {
    widthPx: 4961,
    heightPx: 3508,
    dpi: 300,
  });
  assert.throws(
    () => getPNGDimensions({ widthMm: 2000, heightMm: 2000 }),
    /grande/,
  );
});

test("PNG physical metadata records 300 dpi, not the canvas default", async () => {
  const original = new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE9sAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  );
  const updated = new Uint8Array(
    await (await withPngDpi(original)).arrayBuffer(),
  );
  assert.equal(new TextDecoder().decode(updated.slice(37, 41)), "pHYs");
  const view = new DataView(updated.buffer);
  assert.equal(view.getUint32(41), 11811);
  assert.equal(view.getUint32(45), 11811);
  assert.equal(updated[49], 1);
});
