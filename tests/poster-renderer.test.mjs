import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMoney,
  calculateDiscount,
  getCanvasSize,
  renderPosterSVG,
  TEMPLATE_DEFINITIONS,
} from "../poster-renderer.js";

const base = () => ({
  data: {
    product: "Café especial",
    description: "Torrado e moído",
    weight: "500g",
    oldPrice: "10,01",
    price: "6,99",
    unit: "CADA",
    store: "TRILHA",
    headline: "OFERTA",
  },
  design: {
    template: "official",
    showCurrency: true,
    showSavings: true,
    showPercent: true,
    splitCents: true,
    elements: {},
  },
  format: { kind: "poster", widthMm: 210, heightMm: 297 },
  assets: {},
});

test("the original logo remains embedded with its aspect ratio in every template and physical format", () => {
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQfoAAAAASUVORK5CYII=";
  for (const template of TEMPLATE_DEFINITIONS) {
    for (const [widthMm, heightMm] of [
      [210, 297],
      [297, 210],
      [60, 30],
      [40, 65],
      [40, 40],
      [100, 150],
      [90, 30],
      [210, 10],
    ]) {
      const state = base();
      state.design.template = template.id;
      state.format = { kind: "label", widthMm, heightMm };
      state.assets.logo = logo;
      const svg = renderPosterSVG(state);
      const image = svg.match(/<image[^>]*data-store-logo="true"[^>]*>/)?.[0];
      assert.ok(image, `${template.id}, ${widthMm} × ${heightMm}`);
      assert.ok(image.includes(`href="${logo}"`));
      assert.ok(image.includes('preserveAspectRatio="xMidYMid meet"'));
    }
  }
});

test("accepts Brazilian currency, grouping and supported decimal entry", () => {
  for (const [value, expected] of [
    ["R$ 1.234,56", 1234.56],
    ["1.234.567,89", 1234567.89],
    ["1.234", 1234],
    ["6,99", 6.99],
    ["6.99", 6.99],
    ["0006,90", 6.9],
    ["0,00", 0],
  ]) {
    assert.equal(parseMoney(value), expected, value);
  }
});

test("rejects malformed, negative and non-finite prices instead of guessing", () => {
  for (const value of [
    "",
    "1.2.3",
    "1,234",
    "1,2,3",
    "1e3",
    "-1,00",
    "abc",
    Infinity,
    NaN,
  ])
    assert.equal(parseMoney(value), null, String(value));
});

test("discount arithmetic uses whole cents and reports reais and percentage", () => {
  assert.deepEqual(calculateDiscount("30,90", "6,99"), {
    amount: 23.91,
    percent: 77.38,
  });
  assert.deepEqual(calculateDiscount("0,30", "0,10"), {
    amount: 0.2,
    percent: 66.67,
  });
  assert.deepEqual(calculateDiscount("10,01", "10,00"), {
    amount: 0.01,
    percent: 0.1,
  });
  assert.deepEqual(calculateDiscount("10,00", "0,00"), {
    amount: 10,
    percent: 100,
  });
});

test("does not advertise a false discount for equal prices, increases or invalid input", () => {
  assert.equal(calculateDiscount("6,99", "6,99"), null);
  assert.equal(calculateDiscount("6,99", "9,99"), null);
  assert.equal(calculateDiscount(0.1 + 0.2, 0.3), null);
  assert.equal(calculateDiscount("inválido", "6,99"), null);
  assert.equal(calculateDiscount("0", "0"), null);
});

test("uses final physical aspect ratio, including landscape and narrow labels", () => {
  for (const [widthMm, heightMm] of [
    [210, 297],
    [297, 210],
    [60, 30],
    [40, 65],
    [40, 40],
    [100, 150],
    [30, 90],
    [210, 10],
  ]) {
    const state = base();
    state.format = {
      kind: "label",
      widthMm,
      heightMm,
      orientation: "portrait",
    };
    const size = getCanvasSize(state);
    assert.equal(size.width, 600);
    assert.ok(Math.abs(size.height - (600 * heightMm) / widthMm) < 1e-9);
    const svg = renderPosterSVG(state);
    assert.ok(svg.startsWith("<svg"));
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    assert.ok(svg.includes(`viewBox="0 0 600 ${size.height}"`));
  }
});

test("escapes product and store text, keeps official definitions immutable", () => {
  const state = base();
  state.data.product = '<script>alert("produto")</script>';
  state.data.store = "Loja & Cia";
  const svg = renderPosterSVG(state);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;SCRIPT&gt;"));
  assert.ok(svg.includes("Loja &amp; Cia") || svg.includes("LOJA &amp; CIA"));
  assert.ok(Object.isFrozen(TEMPLATE_DEFINITIONS));
  assert.ok(TEMPLATE_DEFINITIONS.every(Object.isFrozen));
  const original = TEMPLATE_DEFINITIONS[0].name;
  assert.throws(() => {
    TEMPLATE_DEFINITIONS[0].name = "Modificado";
  }, TypeError);
  assert.equal(TEMPLATE_DEFINITIONS[0].name, original);
});

test("rendering does not mutate the editable document or official model", () => {
  const state = base();
  state.design.elements.price = {
    x: 12,
    y: -8,
    scale: 1.2,
    fontScale: 1.1,
    fontFamily: "Georgia",
    fontWeight: "400",
    align: "right",
  };
  const before = JSON.stringify(state);
  const svg = renderPosterSVG(state);
  assert.equal(JSON.stringify(state), before);
  assert.match(svg, /data-element="price"/);
  assert.match(svg, /font-family="Georgia"/);
  assert.match(svg, /translate\(12 -8\)/);
});

test("currency and savings switches also apply to the discount template", () => {
  const state = base();
  state.design = {
    ...state.design,
    template: "discount",
    showCurrency: false,
    showSavings: false,
    showPercent: false,
  };
  const svg = renderPosterSVG(state);
  assert.ok(!svg.includes("R$"));
  assert.ok(!svg.includes("ECONOMIZE"));
  assert.ok(!svg.includes("DE DESCONTO"));
});

test("name-and-price model omits optional product fields and preserves source data", () => {
  for (const [kind, widthMm, heightMm] of [
    ["poster", 210, 297],
    ["poster", 297, 210],
    ["label", 60, 30],
    ["label", 40, 65],
    ["label", 210, 10],
  ]) {
    const state = base();
    state.design.template = "text-only";
    state.data.headline = "CHAMADA EXCLUSIVA";
    state.data.footer = "RODAPÉ EXCLUSIVO";
    state.data.validity = "2026-10-31";
    state.assets = {
      photo: "data:image/png;base64,iVBORw0KGgo=",
      logo: "data:image/png;base64,iVBORw0KGgo=",
    };
    state.format = { kind, widthMm, heightMm };
    const original = JSON.stringify(state),
      svg = renderPosterSVG(state);
    assert.equal(
      JSON.stringify(state),
      original,
      "rendering must not erase hidden product data",
    );
    for (const id of [
      "photo",
      "headline",
      "description",
      "weight",
      "oldPrice",
      "savings",
      "footer",
    ]) {
      const match = svg.match(
        new RegExp(`<g data-element="${id}"[^>]*>([\\s\\S]*?)</g>`),
      );
      assert.ok(match, `editable ${id} layer remains available`);
      assert.equal(
        match[1],
        "",
        `${id} has no hidden printed content by default`,
      );
    }
    const product = svg.match(
      /<g data-element="product"[^>]*>([\s\S]*?)<\/g>/,
    )[1];
    assert.equal(
      product.replace(/<[^>]+>/g, "").replace(/\s/g, ""),
      "CAFÉESPECIAL",
    );
    assert.ok(svg.includes('data-element="price"'));
    assert.ok(svg.includes('data-store-logo="true"'));
    assert.equal(
      (svg.match(/<image/g) || []).length,
      1,
      "only the original logo is included",
    );
    assert.ok(!svg.includes("CHAMADA EXCLUSIVA"));
    assert.ok(!svg.includes("RODAPÉ EXCLUSIVO"));
    assert.ok(!svg.includes("ECONOMIZE"));
    assert.ok(!svg.includes("Por apenas"));
  }
});

test("name-and-price model permits explicitly restoring optional editable fields", () => {
  const state = base();
  state.design.template = "text-only";
  state.design.elements.description = { hidden: false };
  let svg = renderPosterSVG(state);
  const description = svg.match(
    /<g data-element="description"[^>]*>([\s\S]*?)<\/g>/,
  )[1];
  assert.ok(description.includes("<text"));
  assert.ok(!svg.includes("ECONOMIZE"));
  assert.ok(!svg.includes("10,01"));
  state.design.elements = {
    oldPrice: { hidden: false },
    savings: { hidden: false },
  };
  svg = renderPosterSVG(state);
  assert.ok(svg.includes("10,01"));
  assert.ok(svg.includes("ECONOMIZE"));
  state.design.template = "official";
  state.design.elements = {};
  svg = renderPosterSVG(state);
  assert.ok(
    svg.includes("10,01"),
    "other templates keep their ordinary fields",
  );
  assert.ok(svg.includes("Torrado"));
});
