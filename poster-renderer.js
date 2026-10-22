/**
 * Trilha's existing SVG poster renderer, extended with physical formats,
 * official templates and individually editable elements. Images keep their
 * original aspect ratio and uploaded logos are never recoloured or filtered.
 */
export const TEMPLATE_DEFINITIONS = Object.freeze(
  [
    {
      id: "official",
      name: "Trilha original",
      description: "A identidade azul da Trilha, com preço em vermelho.",
      background: "#101D40",
      priceColor: "#CF1826",
      headline: "OFERTA",
    },
    {
      id: "special",
      name: "Oferta especial",
      description: "Uma chamada marcante para a oferta da semana.",
      background: "#101D40",
      priceColor: "#CF1826",
      headline: "OFERTA ESPECIAL",
    },
    {
      id: "low-price",
      name: "Preço baixo",
      description: "Preço direto, com leitura rápida na loja.",
      background: "#101D40",
      priceColor: "#CF1826",
      headline: "PREÇO BAIXO",
    },
    {
      id: "clearance",
      name: "Queima de estoque",
      description: "Uma campanha em vermelho para a última oportunidade.",
      background: "#B91C2C",
      priceColor: "#B91C2C",
      headline: "QUEIMA DE ESTOQUE",
    },
    {
      id: "discount",
      name: "Desconto em %",
      description: "Destaque para a economia e a porcentagem de desconto.",
      background: "#101D40",
      priceColor: "#CF1826",
      headline: "DESCONTO ESPECIAL",
    },
    {
      id: "photo",
      name: "Produto com foto",
      description: "O produto em primeiro plano, com preço bem visível.",
      background: "#101D40",
      priceColor: "#CF1826",
      headline: "OFERTA",
    },
    {
      id: "text-only",
      name: "Nome e preço",
      description: "Um modelo limpo, sem foto, para ofertas diretas.",
      background: "#101D40",
      priceColor: "#CF1826",
      headline: "OFERTA",
    },
  ].map((item) => Object.freeze({ ...item, category: "official" })),
);

const NAVY = "#101D40",
  WHITE = "#FFFFFF",
  RED = "#CF1826";
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const xml = (value) =>
  String(value ?? "").replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
const colour = (value, fallback) =>
  /^(?:#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8})$/i.test(String(value))
    ? value
    : fallback;
let measuringContext,
  serial = 0;

/** Accepts Brazilian money (1.234,56), plain decimals and decimal dots (6.99). */
export function parseMoney(value) {
  if (typeof value === "number")
    return Number.isFinite(value) &&
      value >= 0 &&
      value <= Number.MAX_SAFE_INTEGER / 100
      ? value
      : null;
  const text = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/[\s\u00a0]/g, "");
  if (!text) return null;
  let normalized;
  if (/^\d+(?:,\d{1,2})?$/.test(text)) normalized = text.replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text))
    normalized = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(text)) normalized = text;
  else return null;
  const result = Number(normalized);
  return Number.isFinite(result) &&
    result >= 0 &&
    result <= Number.MAX_SAFE_INTEGER / 100
    ? result
    : null;
}

/** Computes discounts in integer cents; no savings are shown for a price rise. */
export function calculateDiscount(oldPrice, promotionalPrice) {
  const old = parseMoney(oldPrice),
    current = parseMoney(promotionalPrice);
  if (old === null || current === null) return null;
  const oldCents = Math.round(old * 100),
    currentCents = Math.round(current * 100);
  if (oldCents <= 0 || oldCents <= currentCents) return null;
  const difference = oldCents - currentCents;
  return {
    amount: difference / 100,
    percent: Math.round((difference / oldCents) * 10000) / 100,
  };
}

export function getCanvasSize(state = {}) {
  const widthMm = finite(state.format?.widthMm, 210),
    heightMm = finite(state.format?.heightMm, 297);
  const ratio = widthMm > 0 && heightMm > 0 ? heightMm / widthMm : 297 / 210;
  return { width: 600, height: 600 * ratio };
}

function headerInk(background) {
  let hex = String(background).slice(1);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  const rgb = [0, 2, 4].map(
    (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const luminosity = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return luminosity[0] * 0.2126 +
    luminosity[1] * 0.7152 +
    luminosity[2] * 0.0722 >
    0.45
    ? NAVY
    : WHITE;
}
function money(value) {
  return (value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function textWidth(text, size, weight = "400", family = "Arial") {
  if (typeof document !== "undefined") {
    measuringContext ||= document.createElement("canvas").getContext("2d");
    if (measuringContext) {
      measuringContext.font = `${weight} ${size}px ${family}`;
      return measuringContext.measureText(String(text)).width;
    }
  }
  return (
    Array.from(String(text)).reduce(
      (sum, char) =>
        sum +
        (/^[ilI1.,\s]$/.test(char) ? 0.3 : /^[MW@%]$/.test(char) ? 0.85 : 0.57),
      0,
    ) * size
  );
}
function wrap(text, width, size, weight, family) {
  const result = [];
  let row = "";
  for (const word of String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)) {
    if (row && textWidth(row + " " + word, size, weight, family) > width) {
      result.push(row);
      row = "";
    }
    let piece = "";
    for (const character of word) {
      if (piece && textWidth(piece + character, size, weight, family) > width) {
        result.push(piece);
        piece = "";
      }
      piece += character;
    }
    row = row ? row + " " + piece : piece;
  }
  if (row) result.push(row);
  return result;
}
function imageSource(value) {
  return /^data:image\/(png|jpe?g|webp);base64,[\da-z+/=\r\n]+$/i.test(
    String(value ?? ""),
  )
    ? value
    : "";
}
function fittedText(content, box, options) {
  const {
    family,
    weight,
    align,
    size,
    fill,
    maxLines = 20,
    uppercase = false,
  } = options;
  const value = uppercase
    ? String(content ?? "").toUpperCase()
    : String(content ?? "");
  if (!value.trim()) return "";
  let fontSize = size,
    rows = [];
  for (let attempt = 0; attempt < 160; attempt++) {
    rows = wrap(value, box.w, fontSize, weight, family);
    const longestWord = Math.max(
      0,
      ...value
        .trim()
        .split(/\s+/)
        .map((word) => textWidth(word, fontSize, weight, family)),
    );
    if (
      rows.length * fontSize * 1.12 <= box.h &&
      rows.length <= maxLines &&
      (longestWord <= box.w || fontSize <= 10)
    )
      break;
    fontSize *= 0.965;
  }
  const anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  const x =
    align === "left"
      ? box.x
      : align === "right"
        ? box.x + box.w
        : box.x + box.w / 2;
  const totalHeight = rows.length * fontSize * 1.12;
  const y = box.y + (box.h - totalHeight) / 2 + fontSize * 0.86;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${xml(family)}" font-size="${fontSize}" font-weight="${xml(weight)}" fill="${fill}">${rows.map((row, index) => `<tspan x="${x}" dy="${index ? fontSize * 1.12 : 0}">${xml(row)}</tspan>`).join("")}</text>`;
}

function createBuilder(state) {
  const design = state.design || {},
    elements = design.elements || {};
  const commonFamily = String(design.fontFamily || "Arial");
  function style(id, defaults = {}) {
    const edit = elements[id] || {};
    const align = ["left", "center", "right"].includes(edit.align)
      ? edit.align
      : defaults.align || "center";
    return {
      family: String(edit.fontFamily || commonFamily),
      weight: String(edit.fontWeight || defaults.weight || "700"),
      align,
      fill: colour(edit.color, defaults.fill || NAVY),
    };
  }
  function element(id, box, content, { text = false, size = 24 } = {}) {
    const edit = elements[id] || {};
    const x = clamp(finite(edit.x), -10000, 10000),
      y = clamp(finite(edit.y), -10000, 10000);
    const scale =
      clamp(finite(edit.scale, 1), 0.05, 20) *
      (text ? clamp(finite(edit.fontScale, 1), 0.15, 8) : 1);
    const cx = box.x + box.w / 2,
      cy = box.y + box.h / 2;
    return `<g data-element="${id}" data-base-cx="${cx}" data-base-cy="${cy}" data-base-width="${box.w}" data-base-height="${box.h}" data-base-font-size="${size}"${edit.hidden ? ' display="none" data-hidden="true"' : ""} transform="translate(${x} ${y}) translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})">${content}</g>`;
  }
  function text(id, value, box, defaults = {}) {
    const appearance = style(id, defaults),
      size = defaults.size || 24;
    return element(
      id,
      box,
      fittedText(value, box, {
        ...appearance,
        size,
        maxLines: defaults.maxLines,
        uppercase: defaults.uppercase,
      }),
      { text: true, size },
    );
  }
  function image(id, source, box) {
    return element(
      id,
      box,
      source
        ? `<image${id === "logo" ? ' data-store-logo="true"' : ""} href="${xml(source)}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"/>`
        : "",
    );
  }
  return { style, element, text, image };
}

function priceGraphic(state, builder, box, colourValue, small = false) {
  const design = state.design || {},
    value = parseMoney(state.data?.price) ?? 0;
  const parts = money(value).split(","),
    style = builder.style("price", { fill: colourValue, weight: "900" });
  const split = design.splitCents !== false,
    showCurrency = design.showCurrency !== false;
  let integerSize = box.h * (small ? 0.94 : 1.02),
    centRatio = split ? 0.58 : 1;
  let currencyRatio = 0.24;
  function measures(size) {
    const integer = textWidth(parts[0] + ",", size, style.weight, style.family);
    const cents = textWidth(
      parts[1],
      size * centRatio,
      style.weight,
      style.family,
    );
    const currency = showCurrency
      ? textWidth("R$", size * currencyRatio, "900", style.family) + size * 0.07
      : 0;
    return {
      integer,
      cents,
      currency,
      total: integer + cents + currency + size * 0.015,
    };
  }
  let measured = measures(integerSize);
  if (measured.total > box.w) {
    integerSize *= box.w / measured.total;
    measured = measures(integerSize);
  }
  const x =
    style.align === "left"
      ? box.x
      : style.align === "right"
        ? box.x + box.w - measured.total
        : box.x + (box.w - measured.total) / 2;
  const baseline = box.y + box.h * 0.8;
  const centY = baseline - (split ? integerSize * 0.12 : 0);
  let result = "";
  if (showCurrency)
    result += `<text data-price-currency="true" x="${x}" y="${baseline}" font-size="${integerSize * currencyRatio}" font-family="${xml(style.family)}" font-weight="900" fill="${style.fill}">R$</text>`;
  result += `<text data-price-whole="true" x="${x + measured.currency}" y="${baseline}" font-size="${integerSize}" font-family="${xml(style.family)}" font-weight="${xml(style.weight)}" fill="${style.fill}">${xml(parts[0])},</text>`;
  result += `<text data-price-cents="true" x="${x + measured.currency + measured.integer + integerSize * 0.015}" y="${centY}" font-size="${integerSize * centRatio}" font-family="${xml(style.family)}" font-weight="${xml(style.weight)}" fill="${style.fill}">${parts[1]}</text>`;
  result += `<text data-price-unit="true" x="${box.x + box.w}" y="${box.y + box.h + Math.min(10, box.h * 0.08)}" text-anchor="end" font-family="${xml(style.family)}" font-size="${Math.min(small ? 16 : 18, Math.max(7, box.h * 0.12))}" font-weight="700" fill="${NAVY}">${xml(state.data?.unit || "CADA")}</text>`;
  return builder.element("price", box, result, {
    text: true,
    size: integerSize,
  });
}
function oldPriceGraphic(state, builder, box, fill = NAVY, panel = null) {
  const old = parseMoney(state.data?.oldPrice);
  if (old === null || old <= 0) return builder.element("oldPrice", box, "");
  const style = builder.style("oldPrice", {
    fill,
    weight: "700",
    align: "left",
  });
  const label =
    (state.design?.showCurrency !== false ? "DE R$ " : "DE ") + money(old);
  const size = Math.min(
    box.h * 0.78,
    box.w / Math.max(1, textWidth(label, 1, style.weight, style.family)),
  );
  const width = textWidth(label, size, style.weight, style.family);
  const x =
    style.align === "left"
      ? box.x
      : style.align === "right"
        ? box.x + box.w - width
        : box.x + (box.w - width) / 2;
  const y = box.y + (box.h - size) / 2 + size * 0.83;
  const background = panel
    ? `<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="${panel.radius || 10}" fill="#EDF3FB" stroke="#DCE6F4"/>`
    : "";
  const content =
    background +
    `<text data-old-price-value="true" x="${x}" y="${y}" font-size="${size}" font-family="${xml(style.family)}" font-weight="${xml(style.weight)}" fill="${style.fill}">${xml(label)}</text><path d="M${x} ${y - size * 0.12}L${x + width} ${y - size * 0.62}" stroke="${RED}" stroke-width="${Math.max(1.2, size * 0.055)}" stroke-linecap="round"/>`;
  return builder.element("oldPrice", panel || box, content, {
    text: true,
    size,
  });
}
function savingsGraphic(
  state,
  builder,
  box,
  fill = "#176145",
  percentOnly = false,
) {
  const discount = calculateDiscount(state.data?.oldPrice, state.data?.price);
  const design = state.design || {};
  const showAmount = design.showSavings !== false;
  const forcePercent = percentOnly && design.showPercent !== false;
  const showPercent = design.showPercent === true || forcePercent;
  if (!discount || (!showAmount && !showPercent))
    return builder.element("savings", box, "");
  const parts = [];
  if (showAmount && !forcePercent)
    parts.push(
      `ECONOMIZE ${design.showCurrency !== false ? "R$ " : ""}${money(discount.amount)}`,
    );
  if (showPercent)
    parts.push(
      `${discount.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% DE DESCONTO`,
    );
  if (forcePercent) {
    const appearance = builder.style("savings", { fill, weight: "900" }),
      percent =
        discount.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
        "%";
    const first = { x: box.x, y: box.y, w: box.w, h: box.h * 0.72 },
      second = { x: box.x, y: box.y + box.h * 0.76, w: box.w, h: box.h * 0.24 };
    return builder.element(
      "savings",
      box,
      fittedText(percent, first, {
        ...appearance,
        size: Math.min(66, box.h * 0.76),
        maxLines: 1,
      }) +
        fittedText("DE DESCONTO", second, {
          ...appearance,
          size: Math.min(14, box.h * 0.2),
          maxLines: 1,
        }),
      { text: true, size: Math.min(66, box.h * 0.76) },
    );
  }
  return builder.text("savings", parts.join(" · "), box, {
    fill,
    weight: "800",
    size: Math.min(box.h * 0.7, 22),
    maxLines: 2,
  });
}
function dateFooter(data) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data.validity || ""));
  return (
    (match ? `Válido até ${match[3]}/${match[2]}/${match[1]}. ` : "") +
    String(data.footer || "")
  );
}

function posterPortrait(
  state,
  template,
  builder,
  h,
  background,
  priceColour,
  prefix,
) {
  const ink = headerInk(background);
  const data = state.data || {},
    photo =
      template.id !== "text-only" ||
      state.design?.elements?.photo?.hidden === false
        ? imageSource(state.assets?.photo)
        : "",
    logo = imageSource(state.assets?.logo);
  const topScale = Math.min(1.15, h / 849),
    headerH = 218 * topScale;
  const priceH = Math.min(
      h * (template.id === "low-price" ? 0.3 : 0.255),
      template.id === "low-price" ? 260 : 220,
    ),
    priceY = h - priceH - 46;
  const bodyTop = headerH + 20,
    bodyBottom = priceY - 18,
    bodyH = bodyBottom - bodyTop;
  const bodyX = 24,
    bodyW = 552;
  let result = `<rect width="600" height="${h}" fill="${background}"/><circle cx="-30" cy="-22" r="133" fill="none" stroke="#2563EB" stroke-width="48" opacity=".32"/><circle cx="620" cy="0" r="114" fill="none" stroke="#FFFFFF" stroke-opacity=".07" stroke-width="50"/>`;
  if (logo)
    result += builder.image("logo", logo, {
      x: 190,
      y: 14 * topScale,
      w: 220,
      h: 55 * topScale,
    });
  else
    result += builder.image("logo", "", {
      x: 190,
      y: 14 * topScale,
      w: 220,
      h: 55 * topScale,
    });
  result += builder.text(
    "store",
    data.store,
    {
      x: 42,
      y: logo ? 76 * topScale : 34 * topScale,
      w: 516,
      h: logo ? 26 * topScale : 38 * topScale,
    },
    {
      fill: ink,
      size: logo ? 19 : 29,
      weight: "900",
      uppercase: true,
      maxLines: 1,
    },
  );
  result += builder.text(
    "headline",
    data.headline || template.headline,
    { x: 32, y: 110 * topScale, w: 536, h: 80 * topScale },
    {
      fill: ink,
      size:
        template.id === "official" ||
        template.id === "photo" ||
        template.id === "text-only"
          ? 89
          : 65,
      weight: "900",
      uppercase: true,
      maxLines: 2,
    },
  );
  result += `<path d="M111 ${headerH - 15}Q300 ${headerH - 21} 489 ${headerH - 15}" fill="none" stroke="#3BAAFF" stroke-width="4" stroke-linecap="round"/><rect x="15" y="${headerH}" width="570" height="${h - headerH - 29}" rx="22" fill="${WHITE}"/>`;
  const textBox = photo
    ? { x: 360, y: bodyTop, w: 196, h: bodyH }
    : { x: 54, y: bodyTop, w: 492, h: bodyH };
  if (photo)
    result += builder.image("photo", photo, {
      x: bodyX + 4,
      y: bodyTop,
      w: 310,
      h: bodyH,
    });
  else
    result += builder.image("photo", "", {
      x: bodyX + 4,
      y: bodyTop,
      w: 310,
      h: bodyH,
    });
  const hasOld = parseMoney(data.oldPrice) > 0,
    savings = calculateDiscount(data.oldPrice, data.price);
  const oldSectionH = hasOld
    ? Math.min(
        template.id === "discount" ? 150 : 112,
        bodyH * (template.id === "discount" ? 0.42 : 0.3),
      )
    : 0;
  let titleH = Math.min(bodyH * (photo ? 0.4 : 0.4), 155),
    descH = data.description ? Math.min(64, bodyH * 0.19) : 0;
  const weightH = data.weight ? 28 : 0,
    gap = 8;
  const required = titleH + descH + weightH + oldSectionH + gap * 4;
  if (required > bodyH) {
    const ratio = Math.max(
      0.2,
      (bodyH - oldSectionH - weightH - gap * 4) / Math.max(1, titleH + descH),
    );
    titleH *= ratio;
    descH *= ratio;
  }
  let y = textBox.y;
  const align = photo ? "left" : "center";
  result += builder.text(
    "product",
    data.product,
    { x: textBox.x, y, w: textBox.w, h: titleH },
    {
      size: photo ? 42 : 56,
      fill: NAVY,
      weight: "900",
      align,
      uppercase: true,
      maxLines: 4,
    },
  );
  y += titleH + gap;
  result += builder.text(
    "description",
    data.description,
    { x: textBox.x, y, w: textBox.w, h: Math.max(descH, 1) },
    { size: photo ? 26 : 30, fill: NAVY, weight: "500", align, maxLines: 3 },
  );
  if (descH) y += descH + gap;
  result += builder.text(
    "weight",
    data.weight,
    { x: textBox.x, y, w: textBox.w, h: Math.max(weightH, 1) },
    { size: 22, fill: NAVY, weight: "700", align, maxLines: 1 },
  );
  if (weightH) y += weightH + gap;
  const oldY = Math.min(y + 5, bodyBottom - oldSectionH);
  const oldBox = {
    x: photo ? textBox.x + 12 : 165,
    y: oldY + 9,
    w: photo ? textBox.w - 24 : 270,
    h: Math.max(28, oldSectionH * (template.id === "discount" ? 0.3 : 0.48)),
  };
  result += oldPriceGraphic(
    state,
    builder,
    oldBox,
    NAVY,
    hasOld
      ? {
          x: photo ? textBox.x : 150,
          y: oldY,
          w: photo ? textBox.w : 300,
          h: oldSectionH,
          radius: 12,
        }
      : null,
  );
  const savingBox = {
    x: photo ? textBox.x + 10 : 163,
    y: oldY + oldSectionH * (template.id === "discount" ? 0.37 : 0.55),
    w: photo ? textBox.w - 20 : 274,
    h: Math.max(18, oldSectionH * (template.id === "discount" ? 0.55 : 0.34)),
  };
  result += savingsGraphic(
    state,
    builder,
    savingBox,
    "#176145",
    template.id === "discount",
  );
  result += `<rect data-offer-highlight="true" x="24" y="${priceY}" width="552" height="${priceH}" rx="21" fill="#FFE927" stroke="${priceColour}" stroke-width="3"/>`;
  const captionY = priceY + Math.min(32, priceH * 0.19);
  result += `<text x="43" y="${captionY}" font-family="Arial" font-size="22" font-weight="900" fill="${NAVY}">Por apenas</text>`;
  const priceBox = {
    x: 42,
    y: priceY + Math.min(26, priceH * 0.15),
    w: 516,
    h: priceH * 0.76,
  };
  result += priceGraphic(state, builder, priceBox, priceColour);
  result += builder.text(
    "footer",
    dateFooter(data),
    { x: 26, y: h - 25, w: 548, h: 15 },
    { fill: ink, size: 10, weight: "400", maxLines: 2 },
  );
  return result;
}

function posterLandscape(state, template, builder, h, background, priceColour) {
  const ink = headerInk(background);
  const data = state.data || {},
    photo =
      template.id !== "text-only" ||
      state.design?.elements?.photo?.hidden === false
        ? imageSource(state.assets?.photo)
        : "",
    logo = imageSource(state.assets?.logo);
  const headerH = h * 0.215,
    panelTop = headerH + 8,
    footerH = h * 0.055;
  const priceH = h * 0.29,
    priceY = h - footerH - priceH - 9;
  const contentTop = panelTop + 12,
    contentBottom = priceY - 10,
    contentH = contentBottom - contentTop;
  let result = `<rect width="600" height="${h}" fill="${background}"/><rect x="12" y="${panelTop}" width="576" height="${h - panelTop - footerH - 2}" rx="12" fill="${WHITE}"/>`;
  result += builder.image("logo", logo, {
    x: 24,
    y: 10,
    w: logo ? 112 : 0,
    h: headerH - 17,
  });
  result += builder.text(
    "store",
    data.store,
    { x: logo ? 148 : 24, y: 10, w: logo ? 426 : 552, h: headerH * 0.28 },
    {
      fill: ink,
      size: 17,
      weight: "900",
      uppercase: true,
      align: logo ? "left" : "center",
      maxLines: 1,
    },
  );
  result += builder.text(
    "headline",
    data.headline || template.headline,
    {
      x: logo ? 148 : 24,
      y: headerH * 0.4,
      w: logo ? 426 : 552,
      h: headerH * 0.48,
    },
    {
      fill: ink,
      size: 42,
      weight: "900",
      uppercase: true,
      align: logo ? "left" : "center",
      maxLines: 1,
    },
  );
  const titleX = photo ? 218 : 32,
    titleWidth = photo ? 236 : 376;
  result += builder.image("photo", photo, {
    x: 24,
    y: contentTop,
    w: 178,
    h: contentH,
  });
  result += builder.text(
    "product",
    data.product,
    { x: titleX, y: contentTop, w: titleWidth, h: contentH * 0.52 },
    {
      size: 31,
      weight: "900",
      fill: NAVY,
      align: "left",
      uppercase: true,
      maxLines: 3,
    },
  );
  result += builder.text(
    "description",
    data.description,
    {
      x: titleX,
      y: contentTop + contentH * 0.57,
      w: titleWidth,
      h: contentH * 0.23,
    },
    { size: 18, weight: "500", fill: NAVY, align: "left", maxLines: 2 },
  );
  result += builder.text(
    "weight",
    data.weight,
    {
      x: titleX,
      y: contentTop + contentH * 0.83,
      w: titleWidth,
      h: contentH * 0.15,
    },
    { size: 16, weight: "700", fill: NAVY, align: "left", maxLines: 1 },
  );
  const oldX = photo ? 467 : 420,
    oldW = photo ? 106 : 150;
  result += oldPriceGraphic(
    state,
    builder,
    { x: oldX, y: contentTop + contentH * 0.16, w: oldW, h: contentH * 0.31 },
    NAVY,
    parseMoney(data.oldPrice) > 0
      ? { x: oldX - 4, y: contentTop, w: oldW + 8, h: contentH, radius: 7 }
      : null,
  );
  result += savingsGraphic(
    state,
    builder,
    { x: oldX, y: contentTop + contentH * 0.53, w: oldW, h: contentH * 0.36 },
    "#176145",
    template.id === "discount",
  );
  result += `<rect data-offer-highlight="true" x="22" y="${priceY}" width="556" height="${priceH}" rx="12" fill="#FFE927" stroke="${priceColour}" stroke-width="2"/><text x="35" y="${priceY + 23}" font-family="Arial" font-size="16" font-weight="900" fill="${NAVY}">Por apenas</text>`;
  result += priceGraphic(
    state,
    builder,
    { x: 108, y: priceY + 3, w: 440, h: priceH * 0.87 },
    priceColour,
  );
  result += builder.text(
    "footer",
    dateFooter(data),
    { x: 24, y: h - footerH + 3, w: 552, h: footerH - 6 },
    { fill: ink, size: 8, weight: "400", maxLines: 1 },
  );
  return result;
}

function labelLayout(state, template, builder, h, background, priceColour) {
  const ink = headerInk(background);
  const data = state.data || {},
    logo = imageSource(state.assets?.logo),
    photo =
      template.id !== "text-only" ||
      state.design?.elements?.photo?.hidden === false
        ? imageSource(state.assets?.photo)
        : "";
  const wide = h <= 420,
    narrowTall = h > 950;
  const pad = 18,
    headerH = wide ? h * 0.12 : Math.min(115, h * 0.14),
    footerH = Math.min(28, h * 0.05);
  const priceH = wide ? h * 0.32 : Math.min(h * 0.34, 310),
    priceY = h - priceH - footerH - 9;
  const bodyTop = headerH + (wide ? 8 : 14),
    bodyH = priceY - bodyTop - (wide ? 6 : 12);
  let result = `<rect width="600" height="${h}" fill="${WHITE}"/><rect width="600" height="${headerH}" fill="${background}"/><rect x="3" y="3" width="594" height="${h - 6}" rx="${Math.min(12, h * 0.025)}" fill="none" stroke="${background}" stroke-width="3"/>`;
  const storeX = logo ? 145 : pad,
    storeW = logo ? 430 : 564;
  result += builder.image("logo", logo, {
    x: pad,
    y: 6,
    w: 112,
    h: headerH - 12,
  });
  result += builder.text(
    "store",
    data.store,
    { x: storeX, y: 5, w: storeW, h: headerH - 10 },
    {
      fill: ink,
      size: wide ? 22 : 24,
      weight: "900",
      align: logo ? "left" : "center",
      uppercase: true,
      maxLines: 1,
    },
  );
  // Compact formats use the product name and price as their primary hierarchy.
  const photoShown = !!photo,
    photoW = photoShown ? (wide ? 128 : 220) : 0;
  const stacked = narrowTall && photoShown,
    photoHeight = stacked ? bodyH * 0.48 : bodyH;
  const titleX = photoShown && !stacked ? pad + photoW + 14 : pad,
    titleW = 600 - titleX - pad;
  const detailsTop = stacked ? bodyTop + photoHeight + 8 : bodyTop,
    detailsH = stacked ? bodyH - photoHeight - 8 : bodyH;
  const titleH = detailsH * (wide ? 0.42 : 0.46),
    descriptionH = data.description ? detailsH * (wide ? 0.2 : 0.18) : 0;
  if (photoShown)
    result += builder.image("photo", photo, {
      x: pad,
      y: bodyTop,
      w: stacked ? 564 : photoW,
      h: photoHeight,
    });
  else
    result += builder.image("photo", "", {
      x: pad,
      y: bodyTop,
      w: photoW || 180,
      h: bodyH,
    });
  result += builder.text(
    "product",
    data.product,
    { x: titleX, y: detailsTop, w: titleW, h: titleH },
    {
      fill: NAVY,
      size: wide ? 42 : narrowTall ? 46 : 48,
      weight: "900",
      align: photoShown && !stacked ? "left" : "center",
      uppercase: true,
      maxLines: wide ? 2 : 4,
    },
  );
  result += builder.text(
    "description",
    data.description,
    {
      x: titleX,
      y: detailsTop + titleH + 2,
      w: titleW,
      h: Math.max(1, descriptionH),
    },
    {
      fill: NAVY,
      size: wide ? 22 : 25,
      weight: "500",
      align: photoShown && !stacked ? "left" : "center",
      maxLines: 2,
    },
  );
  const metaY = detailsTop + titleH + descriptionH + 3,
    metaH = Math.max(1, bodyTop + bodyH - metaY);
  const oldVisible = parseMoney(data.oldPrice) > 0;
  const weightH = data.weight ? (oldVisible ? metaH * 0.4 : metaH) : 0;
  result += builder.text(
    "weight",
    data.weight,
    { x: titleX, y: metaY, w: titleW, h: Math.max(1, weightH) },
    {
      fill: NAVY,
      size: wide ? 20 : 22,
      weight: "700",
      align: photoShown && !stacked ? "left" : "center",
      maxLines: 1,
    },
  );
  result += oldPriceGraphic(state, builder, {
    x: titleX,
    y: metaY + weightH,
    w: titleW,
    h: Math.max(1, metaH - weightH),
  });
  result += `<rect data-offer-highlight="true" x="${pad}" y="${priceY}" width="${600 - pad * 2}" height="${priceH}" rx="${Math.min(14, priceH * 0.1)}" fill="#FFE927" stroke="${priceColour}" stroke-width="2"/>`;
  result += priceGraphic(
    state,
    builder,
    { x: pad + 15, y: priceY + 1, w: 600 - pad * 2 - 30, h: priceH * 0.83 },
    priceColour,
    true,
  );
  result += savingsGraphic(
    state,
    builder,
    { x: pad + 6, y: h - footerH + 1, w: 600 - pad * 2 - 12, h: footerH - 5 },
    "#176145",
    template.id === "discount",
  );
  // Footer remains separately editable, but small labels do not repeat legal copy
  // at an unreadable scale; validity is offered when there is no discount line.
  const discount = calculateDiscount(data.oldPrice, data.price),
    showSaving =
      discount &&
      (state.design?.showSavings !== false ||
        state.design?.showPercent ||
        template.id === "discount");
  result += builder.text(
    "footer",
    state.design?.elements?.footer?.hidden === false
      ? dateFooter(data)
      : !showSaving && data.validity
        ? dateFooter({ validity: data.validity, footer: "" })
        : "",
    { x: pad, y: h - footerH + 1, w: 600 - pad * 2, h: footerH - 5 },
    { fill: NAVY, size: wide ? 10 : 13, weight: "400", maxLines: 1 },
  );
  result += builder.text(
    "headline",
    "",
    { x: pad, y: bodyTop, w: 600 - pad * 2, h: 0 },
    { fill: NAVY, size: 20, weight: "900" },
  );
  return result;
}

// Very wide custom shelf strips have their own horizontal composition. This
// prevents negative content heights at extreme, but valid, physical ratios.
function shelfStrip(state, template, builder, h, background, priceColour) {
  const ink = headerInk(background);
  const data = state.data || {},
    pad = Math.max(3, h * 0.06),
    headerH = h * 0.18;
  const logo = imageSource(state.assets?.logo),
    logoWidth = logo ? headerH * 2.8 : 0,
    storeX = pad + (logo ? logoWidth + pad : 0);
  const photo = imageSource(state.assets?.photo),
    hasPhoto = !!photo && template.id !== "text-only";
  let result = `<rect width="600" height="${h}" fill="${WHITE}"/><rect width="600" height="${headerH}" fill="${background}"/><rect x="1" y="1" width="598" height="${h - 2}" fill="none" stroke="${background}" stroke-width="2"/>`;
  result += builder.image("logo", logo, {
    x: pad,
    y: 1,
    w: logoWidth,
    h: Math.max(1, headerH - 2),
  });
  result += builder.text(
    "store",
    data.store,
    { x: storeX, y: 1, w: 365 - storeX, h: Math.max(1, headerH - 2) },
    {
      fill: ink,
      size: headerH * 0.75,
      weight: "900",
      align: "left",
      maxLines: 1,
    },
  );
  const photoWidth = hasPhoto ? h * 0.65 : 0,
    contentY = headerH + pad,
    contentH = h - contentY - pad;
  result += builder.image("photo", hasPhoto ? photo : "", {
    x: pad,
    y: contentY,
    w: photoWidth,
    h: contentH,
  });
  const titleX = pad + (hasPhoto ? photoWidth + pad : 0),
    titleWidth = 360 - titleX;
  result += builder.text(
    "product",
    data.product,
    { x: titleX, y: contentY, w: titleWidth, h: contentH * 0.65 },
    {
      fill: NAVY,
      size: contentH * 0.42,
      weight: "900",
      align: "left",
      uppercase: true,
      maxLines: 2,
    },
  );
  result += builder.text(
    "description",
    data.description,
    {
      x: titleX,
      y: contentY + contentH * 0.68,
      w: titleWidth * 0.65,
      h: contentH * 0.29,
    },
    {
      fill: NAVY,
      size: contentH * 0.2,
      weight: "400",
      align: "left",
      maxLines: 1,
    },
  );
  result += oldPriceGraphic(state, builder, {
    x: titleX + titleWidth * 0.68,
    y: contentY + contentH * 0.68,
    w: titleWidth * 0.32,
    h: contentH * 0.29,
  });
  result += `<rect x="375" y="${pad}" width="${225 - pad}" height="${h - pad * 2}" rx="${pad}" fill="#FFE927"/>`;
  result += priceGraphic(
    state,
    builder,
    { x: 382, y: pad, w: 210 - pad, h: h - pad * 3 },
    priceColour,
    true,
  );
  for (const id of ["headline", "weight", "savings", "footer"])
    result += builder.element(
      id,
      { x: pad, y: contentY, w: 100, h: Math.max(1, contentH * 0.2) },
      "",
    );
  return result;
}

const TEXT_ONLY_OPTIONAL_ELEMENTS = [
  "photo",
  "headline",
  "description",
  "weight",
  "oldPrice",
  "savings",
  "footer",
];

function textOnlyDocument(state) {
  const source = state.data || {};
  const enabled = (id) => state.design?.elements?.[id]?.hidden === false;
  const elements = { ...state.design?.elements };
  for (const id of TEXT_ONLY_OPTIONAL_ELEMENTS) {
    elements[id] = { ...elements[id], hidden: !enabled(id) };
  }
  return {
    ...state,
    data: {
      ...source,
      headline: enabled("headline") ? source.headline : "",
      description: enabled("description") ? source.description : "",
      weight: enabled("weight") ? source.weight : "",
      oldPrice:
        enabled("oldPrice") || enabled("savings") ? source.oldPrice : "",
      validity: enabled("footer") ? source.validity : "",
      footer: enabled("footer") ? source.footer : "",
    },
    assets: {
      ...state.assets,
      photo: enabled("photo") ? state.assets?.photo : "",
    },
    design: {
      ...state.design,
      elements,
      showSavings: enabled("savings") && state.design?.showSavings !== false,
      showPercent: enabled("savings") && state.design?.showPercent === true,
    },
  };
}

// A dedicated composition gives the name and price the space released by the
// optional fields, instead of leaving empty description/photo/old-price slots.
function minimalPoster(state, builder, h, background, priceColour) {
  const data = state.data || {},
    logo = imageSource(state.assets?.logo);
  const ink = headerInk(background),
    strip = h < 180;
  const label = state.format?.kind === "label";
  const landscape = h < 600;
  const pad = strip ? Math.max(3, h * 0.05) : label ? 16 : 26;
  const headerH = strip
    ? h * 0.2
    : Math.min(logo ? 112 : 88, h * (label ? 0.15 : 0.2));
  let result = `<rect width="600" height="${h}" fill="${background}"/>`;
  if (strip) {
    result += `<rect x="1" y="${headerH}" width="598" height="${h - headerH - 1}" fill="${WHITE}"/>`;
    const logoW = logo ? headerH * 2.8 : 0;
    result += builder.image("logo", logo, {
      x: pad,
      y: 1,
      w: logoW,
      h: headerH - 2,
    });
    result += builder.text(
      "store",
      data.store,
      { x: pad + logoW, y: 1, w: 365 - pad - logoW, h: headerH - 2 },
      {
        fill: ink,
        size: headerH * 0.72,
        weight: "900",
        align: "left",
        maxLines: 1,
      },
    );
    result += builder.text(
      "product",
      data.product,
      { x: pad, y: headerH + pad, w: 355 - pad, h: h - headerH - pad * 2 },
      {
        fill: NAVY,
        size: h * 0.45,
        weight: "900",
        align: "left",
        uppercase: true,
        maxLines: 2,
      },
    );
    result += `<rect data-offer-highlight="true" x="370" y="${pad}" width="${230 - pad}" height="${h - pad * 2}" rx="${pad}" fill="#FFE927" stroke="${priceColour}" stroke-width="1"/>`;
    result += priceGraphic(
      state,
      builder,
      { x: 380, y: pad, w: 210 - pad, h: h - pad * 3 },
      priceColour,
      true,
    );
  } else {
    result += `<rect x="${pad * 0.55}" y="${headerH + 8}" width="${600 - pad * 1.1}" height="${h - headerH - 8 - pad * 0.55}" rx="${label ? 10 : 20}" fill="${WHITE}"/>`;
    if (logo && landscape) {
      result += builder.image("logo", logo, {
        x: pad,
        y: 8,
        w: 130,
        h: headerH - 16,
      });
      result += builder.text(
        "store",
        data.store,
        { x: pad + 145, y: 10, w: 600 - pad * 2 - 145, h: headerH - 20 },
        {
          fill: ink,
          size: 24,
          weight: "900",
          uppercase: true,
          align: "left",
          maxLines: 2,
        },
      );
    } else {
      result += builder.image("logo", logo, {
        x: 190,
        y: 10,
        w: 220,
        h: Math.max(1, headerH * 0.55),
      });
      result += builder.text(
        "store",
        data.store,
        {
          x: pad,
          y: logo ? headerH * 0.65 : headerH * 0.24,
          w: 600 - pad * 2,
          h: logo ? headerH * 0.25 : headerH * 0.5,
        },
        {
          fill: ink,
          size: logo ? 19 : label ? 25 : 30,
          weight: "900",
          uppercase: true,
          maxLines: 1,
        },
      );
    }
    const priceH = Math.min(label ? 340 : 270, h * (landscape ? 0.45 : 0.34));
    const priceY = h - priceH - pad;
    const titleBox = {
      x: pad + 14,
      y: headerH + 24,
      w: 600 - pad * 2 - 28,
      h: Math.max(1, priceY - headerH - 42),
    };
    result += builder.text("product", data.product, titleBox, {
      fill: NAVY,
      size: label ? Math.min(96, titleBox.h * 0.72) : landscape ? 64 : 82,
      weight: "900",
      uppercase: true,
      maxLines: landscape ? 3 : 5,
    });
    result += `<rect data-offer-highlight="true" x="${pad}" y="${priceY}" width="${600 - pad * 2}" height="${priceH}" rx="${label ? 12 : 20}" fill="#FFE927" stroke="${priceColour}" stroke-width="${label ? 2 : 3}"/>`;
    result += priceGraphic(
      state,
      builder,
      {
        x: pad + 14,
        y: priceY + priceH * 0.08,
        w: 600 - pad * 2 - 28,
        h: priceH * 0.78,
      },
      priceColour,
      label,
    );
  }
  // Empty editable groups preserve the layer inspector and explicit re-enable
  // controls without leaking hidden field values into the printed SVG.
  for (const id of TEXT_ONLY_OPTIONAL_ELEMENTS) {
    result += builder.element(
      id,
      { x: pad, y: headerH + pad, w: 600 - pad * 2, h: Math.max(1, h * 0.1) },
      "",
    );
  }
  return result;
}

/** Renders a self-contained SVG, ready for visual editing, PNG and physical print. */
export function renderPosterSVG(state = {}) {
  const { width, height } = getCanvasSize(state),
    design = state.design || {};
  const template =
    TEMPLATE_DEFINITIONS.find((item) => item.id === design.template) ||
    TEMPLATE_DEFINITIONS[0];
  const background = colour(design.background, template.background),
    priceColour = colour(design.priceColor, template.priceColor);
  const minimal =
    template.id === "text-only" &&
    !TEXT_ONLY_OPTIONAL_ELEMENTS.some(
      (id) => design.elements?.[id]?.hidden === false,
    );
  const documentState =
    template.id === "text-only" ? textOnlyDocument(state) : state;
  const documentTemplate =
    template.id === "text-only" && documentState.design.elements.headline.hidden
      ? { ...template, headline: "" }
      : template;
  const builder = createBuilder(documentState),
    prefix = "trilha-" + ++serial;
  const body = minimal
    ? minimalPoster(documentState, builder, height, background, priceColour)
    : height < 180
      ? shelfStrip(
          documentState,
          documentTemplate,
          builder,
          height,
          background,
          priceColour,
        )
      : documentState.format?.kind === "label"
        ? labelLayout(
            documentState,
            documentTemplate,
            builder,
            height,
            background,
            priceColour,
          )
        : height < 600
          ? posterLandscape(
              documentState,
              documentTemplate,
              builder,
              height,
              background,
              priceColour,
            )
          : posterPortrait(
              documentState,
              documentTemplate,
              builder,
              height,
              background,
              priceColour,
              prefix,
            );
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden" role="img" aria-label="Cartaz de oferta de ${xml(state.data?.product || "produto")}" data-template="${template.id}">${body}</svg>`;
}
