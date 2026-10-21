/** Physical units and printing for Trilha. All geometry is in millimetres. */
const PAPER_SIZES = Object.freeze({
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
});
const LABEL_SIZES = Object.freeze({
  "60x30": [60, 30],
  "40x65": [40, 65],
  "40x40": [40, 40],
  "100x150": [100, 150],
  "30x90": [30, 90],
});
const MAX_COPIES = 500;
const roundMm = (number) => Math.round(number * 1e6) / 1e6;
const finiteNumber = (value) =>
  value !== "" &&
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value))
    ? Number(value)
    : NaN;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

/** Explicit dimensions are final/oriented dimensions. Presets only fill absent values. */
export function getFormatSize(format = {}) {
  let fallback = PAPER_SIZES[format.preset] ||
    LABEL_SIZES[format.preset] || [NaN, NaN];
  if (PAPER_SIZES[format.preset] && format.orientation === "landscape")
    fallback = [fallback[1], fallback[0]];
  return {
    widthMm:
      format.widthMm === undefined ? fallback[0] : finiteNumber(format.widthMm),
    heightMm:
      format.heightMm === undefined
        ? fallback[1]
        : finiteNumber(format.heightMm),
  };
}

/** Describe available A4 slots without stretching labels or exceeding sheet bounds. */
export function computeImposition(format = {}, settings = {}) {
  const { widthMm, heightMm } = getFormatSize(format);
  const label = format.kind === "label";
  const paperLandscape = settings.paperOrientation === "landscape";
  const paperWidthMm = label ? (paperLandscape ? 297 : 210) : widthMm;
  const paperHeightMm = label ? (paperLandscape ? 210 : 297) : heightMm;
  const errors = [];
  const copies =
    settings.copies === undefined ? 1 : finiteNumber(settings.copies);
  const result = {
    paperWidthMm,
    paperHeightMm,
    itemWidthMm: widthMm,
    itemHeightMm: heightMm,
    columns: 0,
    rows: 0,
    capacity: 0,
    perPage: 0,
    pages: 0,
    positions: [],
    errors,
  };
  if (
    !(widthMm >= 1 && widthMm <= 2000) ||
    !(heightMm >= 1 && heightMm <= 2000)
  )
    errors.push("Informe largura e altura válidas, entre 1 e 2.000 mm.");
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES)
    errors.push(`Informe uma quantidade inteira entre 1 e ${MAX_COPIES}.`);
  if (errors.length) return result;
  if (!label)
    return {
      ...result,
      columns: 1,
      rows: 1,
      capacity: 1,
      perPage: 1,
      pages: copies,
      positions: [{ xMm: 0, yMm: 0 }],
    };
  const margin =
    settings.marginMm === undefined ? 8 : finiteNumber(settings.marginMm);
  const gap = settings.gapMm === undefined ? 3 : finiteNumber(settings.gapMm);
  const requested =
    settings.perPage === undefined ? 0 : finiteNumber(settings.perPage);
  if (
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin >= Math.min(paperWidthMm, paperHeightMm) / 2
  )
    errors.push(
      "A margem deve ser positiva ou zero e deixar espaço útil na folha.",
    );
  if (
    !Number.isFinite(gap) ||
    gap < 0 ||
    gap > Math.max(paperWidthMm, paperHeightMm)
  )
    errors.push("Informe um espaçamento válido, positivo ou zero.");
  if (!Number.isInteger(requested) || requested < 0 || requested > MAX_COPIES)
    errors.push(
      `Etiquetas por folha: use 0 para automático ou um inteiro entre 1 e ${MAX_COPIES}.`,
    );
  if (
    settings.paperOrientation !== undefined &&
    !["portrait", "landscape"].includes(settings.paperOrientation)
  )
    errors.push("Escolha uma orientação válida para a folha A4.");
  if (errors.length) return result;
  const columns = Math.max(
    0,
    Math.floor((paperWidthMm - margin * 2 + gap + 1e-8) / (widthMm + gap)),
  );
  const rows = Math.max(
    0,
    Math.floor((paperHeightMm - margin * 2 + gap + 1e-8) / (heightMm + gap)),
  );
  const capacity = columns * rows;
  result.columns = columns;
  result.rows = rows;
  result.capacity = capacity;
  if (!capacity) {
    errors.push(
      "Essa etiqueta não cabe na folha A4 com as margens escolhidas. Reduza as dimensões ou margens, ou gire a folha.",
    );
    return result;
  }
  if (requested > capacity) {
    errors.push(
      `Cabem no máximo ${capacity} etiquetas por folha com essas dimensões, margens e espaçamentos.`,
    );
    return result;
  }
  const perPage = requested || Math.min(capacity, MAX_COPIES);
  result.perPage = perPage;
  result.pages = Math.ceil(copies / perPage);
  result.positions = Array.from({ length: perPage }, (_, index) => ({
    xMm: roundMm(margin + (index % columns) * (widthMm + gap)),
    yMm: roundMm(margin + Math.floor(index / columns) * (heightMm + gap)),
  }));
  return result;
}

function requireLayout(state) {
  const layout = computeImposition(state?.format, state?.print);
  if (layout.errors.length) throw new Error(layout.errors.join(" "));
  return layout;
}

function parseArtwork(svg, widthMm, heightMm) {
  if (typeof svg !== "string")
    throw new Error("Não foi possível preparar o desenho para impressão.");
  const match = svg
    .trim()
    .match(/^(?:<\?xml[^>]*>\s*)?<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  if (!match)
    throw new Error("Não foi possível preparar o desenho para impressão.");
  const rawViewBox = match[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  const viewBox = rawViewBox?.trim().split(/[ ,]+/).map(Number);
  const box =
    viewBox?.length === 4 &&
    viewBox.every(Number.isFinite) &&
    viewBox[2] > 0 &&
    viewBox[3] > 0
      ? viewBox
      : [0, 0, 600, (600 * heightMm) / widthMm];
  // Retain presentation attributes from the root when moving its contents into a symbol.
  const presentation = [
    "fill",
    "stroke",
    "font-family",
    "font-size",
    "font-weight",
    "color",
    "style",
  ]
    .map((name) =>
      match[1].match(
        new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i"),
      ),
    )
    .filter(Boolean)
    .map((attribute) => attribute[0].trim())
    .join(" ");
  return { box, viewBox: box.join(" "), inner: match[2], presentation };
}

function cropMarks(position, width, height, settings) {
  if (settings.cropMarks === false) return "";
  const margin = Number(settings.marginMm ?? 8),
    gap = Number(settings.gapMm ?? 3);
  const length = Math.min(2, margin / 2, gap / 2);
  if (length < 0.25) return "";
  const { xMm: x, yMm: y } = position,
    right = x + width,
    bottom = y + height;
  return `<path d="M${x - length} ${y}H${x}M${x} ${y - length}V${y}M${right} ${y - length}V${y}M${right} ${y}H${right + length}M${x - length} ${bottom}H${x}M${x} ${bottom}V${bottom + length}M${right} ${bottom}H${right + length}M${right} ${bottom}V${bottom + length}" fill="none" stroke="#88909d" stroke-width="0.12"/>`;
}

/** One shared symbol keeps large product photos from being duplicated for every label. */
export function buildPrintDocument(svg, state) {
  const layout = requireLayout(state);
  const artwork = parseArtwork(svg, layout.itemWidthMm, layout.itemHeightMm);
  const copies = Number(state.print?.copies ?? 1);
  const title = `Trilha — ${state.data?.product || "Cartaz de oferta"}`;
  const symbolId = "trilha-print-artwork";
  const shared = `<svg class="print-defs" width="0" height="0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><symbol id="${symbolId}" viewBox="${artwork.viewBox}" preserveAspectRatio="xMidYMid meet"><g ${artwork.presentation}>${artwork.inner}</g></symbol></defs></svg>`;
  let pages = "";
  for (let page = 0; page < layout.pages; page++) {
    const count = Math.min(layout.perPage, copies - page * layout.perPage);
    let items = "",
      marks = "";
    for (let item = 0; item < count; item++) {
      const position = layout.positions[item];
      items += `<div class="print-item" style="left:${position.xMm}mm;top:${position.yMm}mm;width:${layout.itemWidthMm}mm;height:${layout.itemHeightMm}mm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${artwork.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(state.data?.product || "Oferta")}"><use href="#${symbolId}" x="${artwork.box[0]}" y="${artwork.box[1]}" width="${artwork.box[2]}" height="${artwork.box[3]}"/></svg></div>`;
      if (state.format.kind === "label")
        marks += cropMarks(
          position,
          layout.itemWidthMm,
          layout.itemHeightMm,
          state.print || {},
        );
    }
    pages += `<section class="print-sheet" aria-label="Folha ${page + 1}">${items}${marks ? `<svg class="crop-marks" viewBox="0 0 ${layout.paperWidthMm} ${layout.paperHeightMm}" aria-hidden="true">${marks}</svg>` : ""}</section>`;
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>${esc(title)}</title><style>
@page{size:${layout.paperWidthMm}mm ${layout.paperHeightMm}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#101D40;font-family:Arial,sans-serif}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-defs{position:absolute;width:0;height:0;overflow:hidden}.print-sheet{width:${layout.paperWidthMm}mm;height:${layout.paperHeightMm}mm;position:relative;overflow:hidden;break-after:page;page-break-after:always;background:#fff}.print-sheet:last-child{break-after:auto;page-break-after:auto}.print-item{position:absolute;overflow:hidden}.print-item>svg{display:block;width:100%;height:100%}.crop-marks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
</style></head><body>${shared}${pages}</body></html>`;
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function waitForImages(doc) {
  const sources = [
    ...new Set(
      [...doc.querySelectorAll("image")]
        .map(
          (image) =>
            image.getAttribute("href") || image.getAttribute("xlink:href"),
        )
        .filter(Boolean),
    ),
  ];
  await Promise.all(
    sources.map(
      (source) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = () =>
            reject(
              new Error(
                "Uma imagem não pôde ser preparada para impressão. Reenvie a foto e tente novamente.",
              ),
            );
          image.src = source;
          if (image.complete && image.naturalWidth) resolve();
        }),
    ),
  );
}

/** Print only the generated physical sheets, without opening an external window. */
export async function printPoster(svg, state) {
  const html = buildPrintDocument(svg, state);
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Impressão do cartaz");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-12000px;top:0;width:1200px;height:900px;border:0;";
  let cleanupTimer;
  const cleanup = () => {
    clearTimeout(cleanupTimer);
    frame.remove();
  };
  try {
    const loaded = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = reject;
    });
    frame.srcdoc = html;
    document.body.append(frame);
    await withTimeout(
      loaded,
      30000,
      "A impressão demorou para abrir. Tente novamente.",
    );
    const doc = frame.contentDocument,
      target = frame.contentWindow;
    if (!doc || !target) throw new Error("Não foi possível abrir a impressão.");
    await withTimeout(
      Promise.all([doc.fonts?.ready || Promise.resolve(), waitForImages(doc)]),
      30000,
      "As imagens demoraram para carregar. Tente novamente.",
    );
    await new Promise((resolve) =>
      target.requestAnimationFrame(() => target.requestAnimationFrame(resolve)),
    );
    target.addEventListener("afterprint", cleanup, { once: true });
    cleanupTimer = setTimeout(cleanup, 300000);
    target.focus();
    target.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function getPNGDimensions(format, dpi = 300) {
  const { widthMm, heightMm } = getFormatSize(format);
  if (
    !(widthMm >= 1 && heightMm >= 1) ||
    !Number.isFinite(dpi) ||
    dpi < 72 ||
    dpi > 600
  )
    throw new Error("Dimensões ou resolução de exportação inválidas.");
  const widthPx = Math.round((widthMm / 25.4) * dpi),
    heightPx = Math.round((heightMm / 25.4) * dpi);
  if (widthPx * heightPx > 40000000 || Math.max(widthPx, heightPx) > 16384)
    throw new Error(
      "Esse tamanho é muito grande para exportar em PNG. Use a impressão em PDF.",
    );
  return { widthPx, heightPx, dpi };
}

function standaloneSVG(svg, width, height) {
  const match = svg.match(/<svg\b([^>]*)>/i);
  if (!match)
    throw new Error("Não foi possível preparar o desenho para exportação.");
  const attributes = match[1].replace(
    /\s(?:width|height|preserveAspectRatio)\s*=\s*(["']).*?\1/gi,
    "",
  );
  return svg.replace(
    match[0],
    `<svg${attributes} width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">`,
  );
}

function fileName(state, extension) {
  const product = String(state.data?.product || "oferta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `trilha-${product || "oferta"}.${extension}`;
}

function saveBlob(blob, filename) {
  const link = document.createElement("a"),
    url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const CRC_TABLE = new Uint32Array(256).map((_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Canvas defaults to 96 dpi metadata. Replace pHYs with the requested physical DPI. */
export async function withPngDpi(blob, dpi = 300) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (
    bytes.length < 33 ||
    bytes[0] !== 137 ||
    bytes[1] !== 80 ||
    bytes[2] !== 78 ||
    bytes[3] !== 71
  )
    throw new Error("Não foi possível gerar o PNG.");
  const metadata = new Uint8Array(21),
    view = new DataView(metadata.buffer);
  view.setUint32(0, 9);
  metadata.set([112, 72, 89, 115], 4);
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  metadata[16] = 1;
  view.setUint32(17, crc32(metadata.subarray(4, 17)));
  const parts = [bytes.subarray(0, 33), metadata];
  const sourceView = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  let offset = 33;
  while (offset + 12 <= bytes.length) {
    const length = sourceView.getUint32(offset),
      end = offset + 12 + length;
    if (end > bytes.length)
      throw new Error("Não foi possível gerar o PNG completo.");
    if (
      !(
        bytes[offset + 4] === 112 &&
        bytes[offset + 5] === 72 &&
        bytes[offset + 6] === 89 &&
        bytes[offset + 7] === 115
      )
    )
      parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  return new Blob(parts, { type: "image/png" });
}

/** Export a single design at its physical size; sheet imposition is used by PDF/print. */
export async function exportPNG(
  svg,
  state,
  { download = true, dpi = 300 } = {},
) {
  requireLayout(state);
  const { widthPx, heightPx } = getPNGDimensions(state.format, dpi);
  const source = standaloneSVG(svg, widthPx, heightPx);
  const url = URL.createObjectURL(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await withTimeout(
      image.decode(),
      30000,
      "Não foi possível carregar o desenho para exportação.",
    );
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Não foi possível preparar o PNG neste aparelho. Use a impressão em PDF.",
      );
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, widthPx, heightPx);
    const raster = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!raster)
      throw new Error(
        "Não foi possível gerar o PNG neste aparelho. Use a impressão em PDF.",
      );
    const blob = await withPngDpi(raster, dpi),
      filename = fileName(state, "png");
    if (download) saveBlob(blob, filename);
    return { blob, widthPx, heightPx, filename };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportSVG(svg, state, { download = true } = {}) {
  requireLayout(state);
  const { widthMm, heightMm } = getFormatSize(state.format);
  const source = standaloneSVG(svg, `${widthMm}mm`, `${heightMm}mm`);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
    filename = fileName(state, "svg");
  if (download) saveBlob(blob, filename);
  return { blob, filename };
}
