import {
  TEMPLATE_DEFINITIONS,
  renderPosterSVG,
  getCanvasSize,
  parseMoney,
  calculateDiscount,
} from "./poster-renderer.js?v=21";
import {
  computeImposition,
  getPNGDimensions,
  exportPNG,
  printPoster,
} from "./print-engine.js?v=20";
import { VisualEditor } from "./visual-editor.js?v=20";
import {
  loadDraft,
  saveDraft,
  loadCollection,
  saveCollection,
  loadBrandLogo,
  saveBrandLogo,
} from "./persistence.js?v=21";
import { OFFICIAL_LOGOS, loadOfficialLogo } from "./brand-assets.js?v=22";

const $ = (id) => document.getElementById(id);
const clone = (value) => structuredClone(value);
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const iconPaths = {
  box: "M21 8l-9 5-9-5M12 13v9M3 8l9-5 9 5v11l-9 4-9-4z",
  tag: "M20 13l-7 7a2 2 0 01-3 0l-8-8V3h9l9 8a2 2 0 010 2zM7 7h.01",
  palette:
    "M12 3a9 9 0 100 18h1a2 2 0 002-3 2 2 0 012-3h1a4 4 0 004-4 9 9 0 00-10-8zM7 10h.01M11 7h.01M16 8h.01M6 14h.01",
  layers: "M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4",
  printer: "M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM17 11h.01",
  shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6",
  plus: "M12 5v14M5 12h14",
  image: "M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M16 8h.01",
  check: "M5 12l4 4L19 6",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  info: "M12 8h.01M12 11v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  undo: "M8 4L3 9l5 5M3 9h11a7 7 0 017 7v4",
  redo: "M16 4l5 5-5 5M21 9H10a7 7 0 00-7 7v4",
  download: "M12 3v12M7 10l5 5 5-5M4 16v5h16v-5",
  file: "M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h8",
  menu: "M3 6h18M3 12h18M3 18h18",
};
function icons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.firstChild)
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[el.dataset.icon] || iconPaths.layers}"/></svg>`;
  });
}
icons();
const layerNames = {
  store: "Nome da loja",
  logo: "Logotipo original",
  headline: "Chamada da oferta",
  photo: "Foto do produto",
  product: "Nome do produto",
  description: "Descrição",
  weight: "Peso / quantidade",
  oldPrice: "Preço anterior",
  price: "Preço da oferta",
  savings: "Economia / desconto",
  footer: "Rodapé e validade",
};
const minimalHidden = [
  "photo",
  "headline",
  "description",
  "weight",
  "oldPrice",
  "savings",
  "footer",
];
function elementIsHidden(id) {
  return (
    state.design.elements[id]?.hidden ??
    (state.design.template === "text-only" && minimalHidden.includes(id))
  );
}
const fields = [
  "product",
  "description",
  "weight",
  "oldPrice",
  "price",
  "unit",
  "headline",
  "store",
  "validity",
  "footer",
];
const designChecks = [
  "showCurrency",
  "showSavings",
  "showPercent",
  "splitCents",
];
const defaultState = () => ({
  version: 2,
  data: {
    product: "YOKITOS ASSADO",
    description: "Sabor requeijão",
    weight: "135g",
    oldPrice: "9,99",
    price: "6,99",
    unit: "CADA",
    headline: "OFERTA",
    store: "TRILHA MULTI COISAS",
    validity: "",
    footer: "Ofertas válidas enquanto durarem os estoques.",
  },
  design: {
    template: "official",
    background: "#101D40",
    priceColor: "#CF1826",
    fontFamily: "Arial",
    showCurrency: true,
    showSavings: true,
    showPercent: false,
    splitCents: false,
    elements: {},
  },
  format: {
    kind: "poster",
    preset: "A4",
    orientation: "portrait",
    widthMm: 210,
    heightMm: 297,
  },
  print: {
    marginMm: 8,
    gapMm: 3,
    copies: 1,
    perPage: 0,
    paperOrientation: "portrait",
    cropMarks: true,
  },
  assets: { photo: "", originalPhoto: "", logo: "" },
});
function normaliseDraft(saved) {
  const base = defaultState();
  if (!saved || typeof saved !== "object") return base;
  for (const id of fields)
    if (typeof saved.data?.[id] === "string") base.data[id] = saved.data[id];
  for (const key of ["background", "priceColor"])
    if (/^#[0-9a-f]{6}$/i.test(saved.design?.[key] || ""))
      base.design[key] = saved.design[key];
  if (TEMPLATE_DEFINITIONS.some((t) => t.id === saved.design?.template))
    base.design.template = saved.design.template;
  for (const key of designChecks)
    if (typeof saved.design?.[key] === "boolean")
      base.design[key] = saved.design[key];
  if (
    ["Arial", "Arial Black", "Verdana", "Georgia", "Trebuchet MS"].includes(
      saved.design?.fontFamily,
    )
  )
    base.design.fontFamily = saved.design.fontFamily;
  if (saved.design?.elements && typeof saved.design.elements === "object")
    for (const id of Object.keys(layerNames)) {
      const edit = saved.design.elements[id];
      if (edit && typeof edit === "object")
        base.design.elements[id] = { ...edit };
    }
  if (typeof saved.design?.customId === "string")
    base.design.customId = saved.design.customId;
  if (saved.format && typeof saved.format === "object") {
    const f = saved.format,
      w = Number(f.widthMm),
      h = Number(f.heightMm);
    if (w >= 10 && w <= 600 && h >= 10 && h <= 600) {
      base.format = {
        ...base.format,
        ...f,
        widthMm: w,
        heightMm: h,
        kind: f.kind === "label" ? "label" : "poster",
      };
    }
  }
  if (saved.print && typeof saved.print === "object")
    base.print = { ...base.print, ...saved.print };
  for (const key of Object.keys(base.assets))
    if (
      /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(
        saved.assets?.[key] || "",
      )
    )
      base.assets[key] = saved.assets[key];
  return base;
}
let state = normaliseDraft(await loadDraft());
let brandLogo = await loadBrandLogo();
let brandLogoBusy = false,
  brandLogoGeneration = 0;
let officialLogoBusy = false,
  officialLogoGeneration = 0;
let templates = loadCollection("templates").filter(
    (t) =>
      t &&
      typeof t.id === "string" &&
      typeof t.name === "string" &&
      t.design &&
      t.format,
  ),
  printPresets = loadCollection("print-presets").filter(
    (p) =>
      p &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      p.format &&
      p.print,
  );
let activePanel = "product",
  viewMode = "design",
  zoomMode = "fit",
  selectedId = null,
  visual,
  dragBefore = null;
let undoStack = [],
  redoStack = [],
  lastHistoryKey = "",
  lastHistoryTime = 0,
  saveTimer,
  saveSequence = 0,
  toastTimer;
let backgroundBusy = false,
  photoGeneration = 0;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
}
function setStatus(message) {
  $("status").textContent = message;
}
function scheduleSave() {
  const sequence = ++saveSequence;
  $("save-status").innerHTML = "<i></i> Salvando…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const result = await saveDraft(state);
      if (sequence === saveSequence) {
        $("save-status").innerHTML =
          `<i></i> ${result.imagesSaved ? "Rascunho salvo" : "Textos salvos"}`;
        if (result.warning) setStatus(result.warning);
      }
    } catch (error) {
      if (sequence === saveSequence) {
        $("save-status").textContent = "Não foi possível salvar";
        setStatus(error.message);
      }
    }
  }, 450);
}
function remember(previous, key = "") {
  const now = Date.now();
  if (!key || key !== lastHistoryKey || now - lastHistoryTime > 850) {
    undoStack.push(previous);
    if (undoStack.length > 40) undoStack.shift();
  }
  lastHistoryKey = key;
  lastHistoryTime = now;
  redoStack = [];
}
function update(patch, { history = true, key = "", save = true } = {}) {
  const previous = state;
  state = { ...state, ...patch };
  if (history) remember(previous, key);
  if (save) scheduleSave();
  render();
}
function dataUpdate(id, value) {
  update({ data: { ...state.data, [id]: value } }, { key: "data." + id });
}
function designUpdate(patch, key = "") {
  update({ design: { ...state.design, ...patch } }, { key });
}
function elementUpdate(id, patch, { history = true, key = "" } = {}) {
  update(
    {
      design: {
        ...state.design,
        elements: {
          ...state.design.elements,
          [id]: { ...state.design.elements[id], ...patch },
        },
      },
    },
    { history, key },
  );
}
function cancelProcessing() {
  photoGeneration++;
  backgroundBusy = false;
  syncPhotoControls();
}
function undo() {
  if (!undoStack.length) return;
  cancelOfficialLogo();
  cancelProcessing();
  redoStack.push(state);
  state = undoStack.pop();
  lastHistoryKey = "";
  scheduleSave();
  render();
}
function redo() {
  if (!redoStack.length) return;
  cancelOfficialLogo();
  cancelProcessing();
  undoStack.push(state);
  state = redoStack.pop();
  lastHistoryKey = "";
  scheduleSave();
  render();
}
function activatePanel(panel) {
  if (!["product", "prices", "brand", "elements", "print"].includes(panel))
    return;
  activePanel = panel;
  const titles = {
    product: "Informações do produto",
    prices: "Preços e promoção",
    brand: "Identidade da loja",
    elements: "Editor visual",
    print: "Formato e impressão",
  };
  document
    .querySelectorAll("[data-section]")
    .forEach((el) => (el.hidden = el.dataset.section !== panel));
  document.querySelectorAll(".nav-item").forEach((el) => {
    const active = el.dataset.panel === panel;
    el.classList.toggle("active", active);
    el.setAttribute("aria-current", active ? "step" : "false");
  });
  $("panel-title").textContent = titles[panel];
  $("panel-step").textContent =
    String(Object.keys(titles).indexOf(panel) + 1).padStart(2, "0") + " / 05";
  closeSidebar();
}
function syncSidebarAccessibility() {
  const collapsed =
    matchMedia("(max-width: 1000px)").matches &&
    !$("sidebar").classList.contains("open");
  $("sidebar").inert = collapsed;
  $("sidebar").setAttribute("aria-hidden", String(collapsed));
}
function closeSidebar() {
  const wasOpen = $("sidebar").classList.contains("open");
  $("sidebar").classList.remove("open");
  $("sidebar-backdrop").hidden = true;
  $("menu-toggle").setAttribute("aria-expanded", "false");
  syncSidebarAccessibility();
  if (wasOpen) $("menu-toggle").focus();
}
document
  .querySelectorAll(".nav-item")
  .forEach(
    (button) => (button.onclick = () => activatePanel(button.dataset.panel)),
  );
$("menu-toggle").onclick = () => {
  if ($("sidebar").classList.contains("open")) {
    closeSidebar();
    return;
  }
  $("sidebar").classList.add("open");
  $("sidebar-backdrop").hidden = false;
  $("menu-toggle").setAttribute("aria-expanded", "true");
  syncSidebarAccessibility();
  $("sidebar").querySelector(".nav-item.active")?.focus();
};
$("sidebar-backdrop").onclick = closeSidebar;
window.addEventListener("resize", () => {
  if (innerWidth > 1000) closeSidebar();
  else syncSidebarAccessibility();
});
syncSidebarAccessibility();
function setValue(id, value) {
  const el = $(id);
  if (document.activeElement !== el) el.value = value ?? "";
}
function renderModels() {
  $("official-models").innerHTML = TEMPLATE_DEFINITIONS.map(
    (t) =>
      `<button type="button" class="model-item ${!state.design.customId && state.design.template === t.id ? "active" : ""}" data-template="${t.id}" aria-pressed="${!state.design.customId && state.design.template === t.id}"><span class="model-thumb" style="--thumb-bg:${t.background}"></span><span class="model-info"><strong>${escapeHTML(t.name)}</strong><small>MODELO OFICIAL</small></span></button>`,
  ).join("");
  $("custom-models").innerHTML = templates.length
    ? templates
        .map(
          (t) =>
            `<div class="model-item ${state.design.customId === t.id ? "active" : ""}"><button type="button" class="model-item custom-model-button" data-custom="${escapeHTML(t.id)}"><span class="model-thumb" style="--thumb-bg:${/^#[0-9a-f]{6}$/i.test(t.design?.background) ? t.design.background : "#101d40"}"></span><span class="model-info"><strong>${escapeHTML(t.name)}</strong><small>PERSONALIZADO</small></span></button><button type="button" class="delete-model" data-delete-model="${escapeHTML(t.id)}" aria-label="Excluir ${escapeHTML(t.name)}">×</button></div>`,
        )
        .join("")
    : '<p class="empty-models">Salve seus ajustes como um novo modelo para usar de novo.</p>';
}
function applyTemplate(id) {
  const def = TEMPLATE_DEFINITIONS.find((t) => t.id === id);
  if (!def) return;
  visual?.select(null);
  viewMode = "design";
  update({
    data: { ...state.data, headline: def.headline },
    design: {
      ...defaultState().design,
      template: id,
      background: def.background,
      priceColor: def.priceColor,
      fontFamily: state.design.fontFamily,
      showCurrency: state.design.showCurrency,
      showSavings: state.design.showSavings,
      showPercent: id === "discount" || state.design.showPercent,
      splitCents: state.design.splitCents,
    },
  });
  toast("Modelo oficial aplicado. Seus dados e imagens foram mantidos.");
}
$("official-models").onclick = (event) => {
  const button = event.target.closest("[data-template]");
  if (button) applyTemplate(button.dataset.template);
};
$("custom-models").onclick = async (event) => {
  const remove = event.target.closest("[data-delete-model]");
  if (remove) {
    if (
      await confirmAction(
        "Excluir modelo?",
        "Apenas esta personalização será removida. O cartaz atual e os modelos oficiais serão mantidos.",
      )
    ) {
      templates = templates.filter((t) => t.id !== remove.dataset.deleteModel);
      try {
        saveCollection("templates", templates);
        renderModels();
        toast("Modelo excluído.");
      } catch (error) {
        toast(error.message);
      }
    }
    return;
  }
  const button = event.target.closest("[data-custom]"),
    model = button && templates.find((t) => t.id === button.dataset.custom);
  if (!model) return;
  visual?.select(null);
  viewMode = "design";
  const restored = normaliseDraft({
    ...state,
    design: model.design,
    format: model.format,
  });
  update({
    data: {
      ...state.data,
      headline:
        typeof model.headline === "string"
          ? model.headline
          : TEMPLATE_DEFINITIONS.find((t) => t.id === restored.design.template)
              ?.headline || state.data.headline,
    },
    design: { ...restored.design, customId: model.id },
    format: restored.format,
    print: {
      ...state.print,
      perPage: 0,
      copies: restored.format.kind === "poster" ? 1 : state.print.copies,
    },
  });
  toast("Modelo personalizado aplicado.");
};
let dialogSaveAction = null;
function askName(title, description, onSave) {
  dialogSaveAction = onSave;
  $("dialog-title").textContent = title;
  $("dialog-description").textContent = description;
  $("dialog-name").value = "";
  $("dialog-error").textContent = "";
  $("name-dialog").showModal();
  setTimeout(() => $("dialog-name").focus(), 0);
}
$("name-dialog")
  .querySelector("form")
  .addEventListener("submit", (event) => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();
    const name = $("dialog-name").value.trim();
    if (!name) {
      $("dialog-error").textContent = "Informe um nome.";
      return;
    }
    try {
      dialogSaveAction?.(name);
      $("name-dialog").close("save");
    } catch (error) {
      $("dialog-error").textContent = error.message;
    }
  });
function confirmAction(title, description) {
  const dialog = $("confirm-dialog");
  $("confirm-title").textContent = title;
  $("confirm-description").textContent = description;
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
    dialog.showModal();
  });
}
function saveModel() {
  askName(
    "Salvar como novo modelo",
    "Seus ajustes de layout, cores e formato serão salvos. O modelo oficial continua intacto.",
    (name) => {
      const id = crypto.randomUUID();
      const entry = {
        id,
        name,
        design: clone({ ...state.design, customId: undefined }),
        format: clone(state.format),
        headline: state.data.headline,
      };
      const next = [...templates, entry];
      saveCollection("templates", next);
      templates = next;
      designUpdate({ customId: id });
      toast("Personalização salva em Meus modelos.");
    },
  );
}
$("save-model").onclick = saveModel;
$("save-model-editor").onclick = saveModel;
$("restore-template").onclick = async () => {
  if (
    await confirmAction(
      "Restaurar o modelo oficial?",
      "As posições, tamanhos e estilos personalizados serão restaurados. O produto, os preços e as imagens serão mantidos.",
    )
  )
    applyTemplate(state.design.template);
};
$("new-poster").onclick = async () => {
  if (
    !(await confirmAction(
      "Criar um novo cartaz?",
      "O rascunho atual será substituído. Seus modelos e configurações salvas serão mantidos.",
    ))
  )
    return;
  cancelOfficialLogo();
  cancelProcessing();
  visual?.select(null);
  viewMode = "design";
  const fresh = defaultState();
  fresh.data.store = state.data.store;
  fresh.assets.logo = state.assets.logo;
  fresh.design.background = state.design.background;
  fresh.data.product = "";
  fresh.data.description = "";
  fresh.data.weight = "";
  fresh.data.oldPrice = "";
  fresh.data.price = "";
  update(fresh);
  $("photo").value = "";
  activatePanel("product");
  $("product").focus();
  toast("Novo cartaz. A marca da loja foi mantida.");
};
for (const id of fields)
  $(id).addEventListener("input", () => dataUpdate(id, $(id).value));
for (const id of designChecks)
  $(id).addEventListener("change", () => designUpdate({ [id]: $(id).checked }));
$("background").oninput = () =>
  designUpdate({ background: $("background").value }, "design.background");
$("priceColor").oninput = () =>
  designUpdate({ priceColor: $("priceColor").value }, "design.priceColor");
$("default-font").onchange = () =>
  designUpdate({ fontFamily: $("default-font").value });
const posterFormats = { A4: [210, 297], A3: [297, 420], A5: [148, 210] };
const labelFormats = {
  "60x30": [60, 30, "6 × 3 cm"],
  "40x65": [40, 65, "4 × 6,5 cm"],
  "40x40": [40, 40, "4 × 4 cm"],
  "100x150": [100, 150, "10 × 15 cm"],
  "30x90": [30, 90, "3 × 9 cm"],
};
function formatLabel() {
  const f = state.format;
  if (f.kind === "label") return `Etiqueta · ${f.widthMm} × ${f.heightMm} mm`;
  return `${f.preset === "custom" ? "Personalizado" : f.preset} ${f.orientation === "landscape" ? "horizontal" : "vertical"} · ${f.widthMm} × ${f.heightMm} mm`;
}
function syncFormatControls() {
  const f = state.format;
  const selectedPreset = printPresets.find(
    (p) => p.id === $("print-presets").value,
  );
  if (
    selectedPreset &&
    (!Object.keys(f).every((key) => selectedPreset.format[key] === f[key]) ||
      !Object.keys(state.print).every(
        (key) => selectedPreset.print[key] === state.print[key],
      ))
  ) {
    $("print-presets").value = "";
    $("delete-print-preset").disabled = true;
  }
  document
    .querySelectorAll("[data-kind]")
    .forEach((b) => b.classList.toggle("active", b.dataset.kind === f.kind));
  const options =
    f.kind === "poster"
      ? Object.entries(posterFormats).map(([id, wh]) => [
          id,
          `${id} · ${wh[0]} × ${wh[1]} mm`,
        ])
      : Object.entries(labelFormats).map(([id, wh]) => [id, wh[2]]);
  const html =
    options
      .map(([id, label]) => `<option value="${id}">${label}</option>`)
      .join("") + '<option value="custom">Dimensões personalizadas</option>';
  if ($("format-preset").innerHTML !== html)
    $("format-preset").innerHTML = html;
  setValue("format-preset", f.preset);
  setValue("orientation", f.orientation);
  $("orientation-row").hidden = f.kind === "label" || f.preset === "custom";
  $("custom-dimensions").hidden = f.preset !== "custom";
  setValue("format-width", f.widthMm);
  setValue("format-height", f.heightMm);
  for (const id of ["format-width", "format-height"])
    if (document.activeElement !== $(id)) $(id).setCustomValidity("");
  $("label-print-settings").hidden = f.kind !== "label";
  $("canvas-view-tabs").hidden = f.kind !== "label";
  for (const [id, key] of [
    ["print-margin", "marginMm"],
    ["print-gap", "gapMm"],
    ["print-copies", "copies"],
    ["print-per-page", "perPage"],
    ["paper-orientation", "paperOrientation"],
  ])
    setValue(id, state.print[key]);
  $("print-crop-marks").checked = state.print.cropMarks;
  const layout = computeImposition(f, state.print);
  $("imposition-info").classList.toggle("invalid", !!layout.errors.length);
  $("imposition-info").textContent = layout.errors.length
    ? layout.errors.join(" ")
    : `${layout.perPage} por folha · capacidade ${layout.columns} × ${layout.rows} · ${layout.pages} ${layout.pages === 1 ? "folha" : "folhas"} para ${state.print.copies} etiquetas`;
}
function applyFormat(preset, kind = state.format.kind) {
  let dims = kind === "poster" ? posterFormats[preset] : labelFormats[preset];
  let widthMm = dims?.[0] ?? state.format.widthMm,
    heightMm = dims?.[1] ?? state.format.heightMm;
  const orientation = kind === "poster" ? state.format.orientation : "portrait";
  if (kind === "poster" && preset !== "custom" && orientation === "landscape")
    [widthMm, heightMm] = [heightMm, widthMm];
  visual?.select(null);
  viewMode = "design";
  update({
    format: { kind, preset, orientation, widthMm, heightMm },
    design: { ...state.design, elements: {}, customId: undefined },
    print: {
      ...state.print,
      copies:
        kind === "label" ? Math.max(1, Number(state.print.copies) || 1) : 1,
      perPage: 0,
    },
  });
  if (kind === "label")
    toast("Medidas da etiqueta aplicadas. Confira a distribuição na folha A4.");
}
$("format-kind").onclick = (event) => {
  const button = event.target.closest("[data-kind]");
  if (button && button.dataset.kind !== state.format.kind)
    applyFormat(
      button.dataset.kind === "label" ? "60x30" : "A4",
      button.dataset.kind,
    );
};
$("format-preset").onchange = () => applyFormat($("format-preset").value);
$("orientation").onchange = () => {
  const o = $("orientation").value;
  if (o === state.format.orientation) return;
  visual?.select(null);
  update({
    format: {
      ...state.format,
      orientation: o,
      widthMm: state.format.heightMm,
      heightMm: state.format.widthMm,
    },
    design: { ...state.design, elements: {}, customId: undefined },
  });
};
for (const [id, key] of [
  ["format-width", "widthMm"],
  ["format-height", "heightMm"],
])
  $(id).oninput = () => {
    const value = Number($(id).value);
    $(id).setCustomValidity(
      value >= 10 && value <= 600
        ? ""
        : "Informe uma medida entre 10 e 600 mm.",
    );
    if (value >= 10 && value <= 600) {
      const format = { ...state.format, [key]: value };
      if (format.kind === "poster")
        format.orientation =
          Number(format.widthMm) > Number(format.heightMm)
            ? "landscape"
            : "portrait";
      update({ format }, { key: "format." + key });
    }
  };
for (const [id, key] of [
  ["print-margin", "marginMm"],
  ["print-gap", "gapMm"],
  ["print-copies", "copies"],
  ["print-per-page", "perPage"],
])
  $(id).oninput = () =>
    update(
      {
        print: {
          ...state.print,
          [key]: $(id).value === "" ? "" : Number($(id).value),
        },
      },
      { key: "print." + key },
    );
$("paper-orientation").onchange = () =>
  update({
    print: { ...state.print, paperOrientation: $("paper-orientation").value },
  });
$("print-crop-marks").onchange = () =>
  update({
    print: { ...state.print, cropMarks: $("print-crop-marks").checked },
  });
function renderPrintPresets() {
  const selected = $("print-presets").value;
  $("print-presets").innerHTML =
    '<option value="">Escolher configuração…</option>' +
    printPresets
      .map(
        (p) =>
          `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`,
      )
      .join("");
  if (printPresets.some((p) => p.id === selected))
    $("print-presets").value = selected;
  $("delete-print-preset").disabled = !$("print-presets").value;
}
$("save-print-preset").onclick = () => {
  const layout = computeImposition(state.format, state.print);
  if (layout.errors.length) {
    toast(layout.errors.join(" "));
    return;
  }
  askName(
    "Salvar configuração de impressão",
    "Guarde as medidas, margens, espaçamento e distribuição para reutilizar.",
    (name) => {
      const entry = {
        id: crypto.randomUUID(),
        name,
        format: clone(state.format),
        print: clone(state.print),
      };
      const next = [...printPresets, entry];
      saveCollection("print-presets", next);
      printPresets = next;
      renderPrintPresets();
      $("print-presets").value = entry.id;
      $("delete-print-preset").disabled = false;
      toast("Configuração de impressão salva.");
    },
  );
};
$("print-presets").onchange = () => {
  const preset = printPresets.find((p) => p.id === $("print-presets").value);
  $("delete-print-preset").disabled = !preset;
  if (!preset) return;
  const safe = normaliseDraft({
    ...state,
    format: preset.format,
    print: preset.print,
  });
  visual?.select(null);
  viewMode = "design";
  update({
    format: safe.format,
    print: safe.print,
    design: { ...state.design, elements: {} },
  });
  toast("Configuração de impressão aplicada.");
};
$("delete-print-preset").onclick = async () => {
  const id = $("print-presets").value;
  if (
    !id ||
    !(await confirmAction(
      "Excluir configuração?",
      "Esta configuração será removida apenas deste navegador.",
    ))
  )
    return;
  const next = printPresets.filter((p) => p.id !== id);
  try {
    saveCollection("print-presets", next);
    printPresets = next;
    renderPrintPresets();
    toast("Configuração excluída.");
  } catch (error) {
    toast(error.message);
  }
};
function renderLayers() {
  $("layers").innerHTML = Object.entries(layerNames)
    .map(
      ([id, name]) =>
        `<button type="button" data-layer="${id}" class="layer-item ${id === selectedId ? "active" : ""} ${elementIsHidden(id) ? "dimmed" : ""}" aria-pressed="${id === selectedId}"><span data-icon="${id === "photo" || id === "logo" ? "image" : id === "price" || id === "oldPrice" ? "tag" : "layers"}"></span>${name}<span class="layer-state">${elementIsHidden(id) ? "Oculto" : "Visível"}</span></button>`,
    )
    .join("");
  icons($("layers"));
  syncProperties();
}
function syncProperties() {
  $("element-properties").hidden = !selectedId;
  if (!selectedId) return;
  const edit = state.design.elements[selectedId] || {};
  $("selected-name").textContent = layerNames[selectedId] || selectedId;
  $("element-visible").checked = !elementIsHidden(selectedId);
  setValue("element-x", Math.round((edit.x || 0) * 10) / 10);
  setValue("element-y", Math.round((edit.y || 0) * 10) / 10);
  setValue("element-scale", Math.round((edit.scale || 1) * 100));
  $("element-scale-value").textContent =
    Math.round((edit.scale || 1) * 100) + "%";
  setValue("element-font-scale", Math.round((edit.fontScale || 1) * 100));
  $("element-font-scale-value").textContent =
    Math.round((edit.fontScale || 1) * 100) + "%";
  setValue("element-font", edit.fontFamily || "");
  setValue("element-weight", edit.fontWeight || "");
  setValue("element-align", edit.align || "");
  $("text-properties").hidden = selectedId === "photo" || selectedId === "logo";
}
$("layers").onclick = (event) => {
  const button = event.target.closest("[data-layer]");
  if (button) {
    if (viewMode === "sheet") {
      viewMode = "design";
      render();
    }
    visual?.select(button.dataset.layer);
  }
};
$("element-visible").onchange = () => {
  if (selectedId)
    elementUpdate(selectedId, { hidden: !$("element-visible").checked });
};
for (const [id, key] of [
  ["element-x", "x"],
  ["element-y", "y"],
])
  $(id).oninput = () => {
    if (selectedId && $(id).value !== "")
      elementUpdate(
        selectedId,
        { [key]: Number($(id).value) },
        { key: selectedId + "." + key },
      );
  };
for (const [id, key] of [
  ["element-scale", "scale"],
  ["element-font-scale", "fontScale"],
])
  $(id).oninput = () => {
    if (selectedId)
      elementUpdate(
        selectedId,
        { [key]: Number($(id).value) / 100 },
        { key: selectedId + "." + key },
      );
  };
for (const [id, key] of [
  ["element-font", "fontFamily"],
  ["element-weight", "fontWeight"],
  ["element-align", "align"],
])
  $(id).onchange = () => {
    if (selectedId) elementUpdate(selectedId, { [key]: $(id).value });
  };
$("reset-element").onclick = () => {
  if (!selectedId) return;
  const elements = { ...state.design.elements };
  delete elements[selectedId];
  designUpdate({ elements });
};
function sheetPreview(svg) {
  const layout = computeImposition(state.format, state.print);
  const width = layout.paperWidthMm || 210,
    height = layout.paperHeightMm || 297;
  if (layout.errors.length)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#8794a9" font-size="5">Confira as medidas de impressão</text></svg>`;
  const inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>")),
    canvas = getCanvasSize(state);
  const count = Math.min(layout.perPage, Number(state.print.copies));
  const uses = layout.positions
    .slice(0, count)
    .map(
      (p) =>
        `<use href="#sheet-artwork" x="${p.xMm}" y="${p.yMm}" width="${state.format.widthMm}" height="${state.format.heightMm}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-label="Prévia da primeira folha A4"><rect width="100%" height="100%" fill="white"/><defs><symbol id="sheet-artwork" viewBox="0 0 ${canvas.width} ${canvas.height}">${inner}</symbol></defs>${uses}</svg>`;
}
function applyZoom() {
  const sheet = viewMode === "sheet" && state.format.kind === "label";
  const layout = computeImposition(state.format, state.print);
  const widthMm = sheet ? layout.paperWidthMm : state.format.widthMm,
    heightMm = sheet ? layout.paperHeightMm : state.format.heightMm;
  const widthPx = (widthMm * 96) / 25.4,
    heightPx = (heightMm * 96) / 25.4;
  const viewport = $("canvas-viewport"),
    padding = innerWidth <= 700 ? 48 : 64;
  let zoom = Number(zoomMode) / 100;
  if (zoomMode === "fit")
    zoom = Math.max(
      0.05,
      Math.min(
        (viewport.clientWidth - padding) / widthPx,
        (viewport.clientHeight - padding) / heightPx,
      ),
    );
  $("poster").style.width = Math.max(20, widthPx * zoom) + "px";
  $("zoom-status").textContent =
    `${Math.round(zoom * 100)}%${zoomMode === "fit" ? " · ajustado à tela" : zoomMode === "100" ? " · 96 px/pol." : ""}`;
  visual?.refresh();
}
$("zoom").onchange = () => {
  zoomMode = $("zoom").value;
  applyZoom();
};
function stepZoom(delta) {
  const current =
    Number(zoomMode) || parseInt($("zoom-status").textContent) || 50;
  const choices = [25, 50, 75, 100, 125, 150, 200];
  const next =
    delta > 0
      ? choices.find((n) => n > current)
      : choices
          .slice()
          .reverse()
          .find((n) => n < current);
  zoomMode = String(next ?? (delta > 0 ? 200 : 25));
  $("zoom").value = zoomMode;
  applyZoom();
}
$("zoom-in").onclick = () => stepZoom(1);
$("zoom-out").onclick = () => stepZoom(-1);
new ResizeObserver(() => requestAnimationFrame(applyZoom)).observe(
  $("canvas-viewport"),
);
$("canvas-view-tabs").onclick = (event) => {
  const button = event.target.closest("[data-view]");
  if (button) {
    viewMode = button.dataset.view;
    visual?.select(null);
    render();
  }
};
function render() {
  for (const id of fields) setValue(id, state.data[id]);
  for (const id of designChecks) $(id).checked = state.design[id];
  setValue("background", state.design.background);
  setValue("priceColor", state.design.priceColor);
  setValue("default-font", state.design.fontFamily);
  const def =
    TEMPLATE_DEFINITIONS.find((t) => t.id === state.design.template) ||
    TEMPLATE_DEFINITIONS[0];
  $("preview-title").textContent =
    state.format.kind === "label" ? "Etiqueta de oferta" : def.name;
  $("template-badge").textContent = state.design.customId
    ? "MODELO PERSONALIZADO"
    : "MODELO OFICIAL";
  renderModels();
  syncFormatControls();
  const discount = calculateDiscount(state.data.oldPrice, state.data.price);
  $("discount-feedback").textContent = discount
    ? `Economia de R$ ${money(discount.amount)} · ${money(discount.percent)}% de desconto`
    : "";
  $("undo").disabled = !undoStack.length;
  $("redo").disabled = !redoStack.length;
  renderLayers();
  syncPhotoControls();
  const svg = renderPosterSVG(state);
  const sheet = viewMode === "sheet" && state.format.kind === "label";
  $("poster").innerHTML = sheet ? sheetPreview(svg) : svg;
  $("poster").classList.toggle("sheet-view", sheet);
  if (sheet) {
    visual?.destroy();
    visual = null;
  } else if (!visual) createVisual();
  else visual.refresh();
  $("format-status").textContent = sheet
    ? "Folha A4 · " +
      (state.print.paperOrientation === "landscape"
        ? "297 × 210 mm"
        : "210 × 297 mm")
    : formatLabel();
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === viewMode));
  const dimensions = getPNGDimensions(state.format);
  $("export-dimensions").textContent =
    `${dimensions.widthPx} × ${dimensions.heightPx} px · PNG a 300 dpi`;
  applyZoom();
  refreshPhotoQuality();
}
let photoMetrics = { src: "", width: 0, height: 0 };
function refreshPhotoQuality() {
  const source = state.assets.photo;
  if (!source) {
    $("photo-quality").hidden = true;
    photoMetrics = { src: "", width: 0, height: 0 };
    return;
  }
  if (photoMetrics.src !== source) {
    photoMetrics = { src: source, width: 0, height: 0 };
    const image = new Image();
    image.onload = () => {
      if (state.assets.photo !== source) return;
      photoMetrics = {
        src: source,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      refreshPhotoQuality();
    };
    image.src = source;
    return;
  }
  if (!photoMetrics.width) return;
  const group = $("poster").querySelector("[data-element=photo]"),
    boxW = Number(group?.dataset.baseWidth),
    boxH = Number(group?.dataset.baseHeight);
  let text = `${photoMetrics.width} × ${photoMetrics.height} px · original preservada.`;
  if (
    group?.querySelector("image") &&
    boxW > 0 &&
    boxH > 0 &&
    !state.design.elements.photo?.hidden
  ) {
    const width =
        Math.min(boxW, (boxH * photoMetrics.width) / photoMetrics.height) *
        (state.design.elements.photo?.scale || 1),
      dpi = Math.round(
        photoMetrics.width / ((width * state.format.widthMm) / 600 / 25.4),
      );
    text = `${photoMetrics.width} × ${photoMetrics.height} px · ${dpi} dpi no tamanho atual.${dpi < 200 ? " Prefira uma foto maior para impressão." : ""}`;
  }
  $("photo-quality").hidden = false;
  if ($("photo-quality").textContent !== text)
    $("photo-quality").textContent = text;
}
function createVisual() {
  visual = new VisualEditor({
    container: $("poster"),
    getEdit: (id) => state.design.elements[id] || {},
    onSelect: (id) => {
      selectedId = id;
      renderLayers();
      if (id) activatePanel("elements");
    },
    onStart: () => {
      dragBefore = state;
    },
    onChange: (id, patch) => elementUpdate(id, patch, { history: false }),
    onCommit: () => {
      if (dragBefore && dragBefore !== state) {
        remember(dragBefore);
        dragBefore = null;
        scheduleSave();
        $("undo").disabled = !undoStack.length;
        $("redo").disabled = !redoStack.length;
      }
    },
  });
  if (selectedId) visual?.select(selectedId);
}
$("undo").onclick = undo;
$("redo").onclick = redo;
document.addEventListener("keydown", (event) => {
  if ($("name-dialog").open || $("confirm-dialog").open) return;
  const typing = event.target.closest?.(
    'input,textarea,select,[contenteditable="true"]',
  );
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
    event.preventDefault();
    $("print").click();
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "z" &&
    !typing
  ) {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "y" &&
    !typing
  ) {
    event.preventDefault();
    redo();
  }
  if (event.key === "Escape") closeSidebar();
});
function syncPhotoControls() {
  syncBrandLogo();
  $("remove-photo").hidden = !state.assets.photo;
  $("remove-logo").hidden = !state.assets.logo;
  document.querySelector("label[for=photo] strong").textContent = state.assets
    .photo
    ? "Trocar foto do produto"
    : "Escolher foto do produto";
  document.querySelector("label[for=logo] strong").textContent = state.assets
    .logo
    ? "Trocar logo deste cartaz"
    : "Enviar outro logo para este cartaz";
  $("cut-background").disabled = !state.assets.originalPhoto || backgroundBusy;
  $("cut-background").textContent = backgroundBusy
    ? "Removendo fundo…"
    : "Remover fundo";
  $("background-strength").disabled = backgroundBusy;
  $("restore-photo").hidden =
    !state.assets.originalPhoto ||
    state.assets.photo === state.assets.originalPhoto;
  $("background-refinement").hidden = $("restore-photo").hidden;
}
function fileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function syncBrandLogo() {
  const siteLogo = brandLogo || OFFICIAL_LOGOS[0].url;
  for (const id of ["site-logo", "mobile-site-logo"]) {
    const image = $(id);
    image.onload = image.onerror = syncSiteLogoAvailability;
    if (image.getAttribute("src") !== siteLogo) image.src = siteLogo;
  }
  const preview = $("saved-logo-preview");
  preview.hidden = !brandLogo;
  if (brandLogo && preview.getAttribute("src") !== brandLogo)
    preview.src = brandLogo;
  if (!brandLogo) preview.removeAttribute("src");
  syncSiteLogoAvailability();
  $("custom-logo-preview").hidden = !brandLogo;
  $("brand-logo-label").textContent = brandLogoBusy
    ? "Carregando logo…"
    : brandLogo
      ? "Trocar logo salvo"
      : "Carregar outro logo para o site";
  $("brand-logo").disabled = brandLogoBusy;
  $("use-brand-logo").hidden = !brandLogo;
  $("use-brand-logo").disabled = !brandLogo || brandLogoBusy;
  const applied =
    !!brandLogo && state.assets.logo === brandLogo && !elementIsHidden("logo");
  $("use-brand-logo").setAttribute("aria-pressed", String(applied));
  $("use-brand-logo").textContent = applied
    ? "Logo aplicado ao cartaz"
    : "Usar meu logo no panfleto";
  $("clear-brand-logo").hidden = !brandLogo;
  $("clear-brand-logo").disabled = brandLogoBusy;
  for (const logo of OFFICIAL_LOGOS)
    $("use-trilha-" + logo.id).disabled = officialLogoBusy || brandLogoBusy;
}
function syncSiteLogoAvailability() {
  const site = $("site-logo");
  const mobile = $("mobile-site-logo");
  const siteFailed = site.complete && !site.naturalWidth;
  const mobileFailed = mobile.complete && !mobile.naturalWidth;
  site.hidden = siteFailed;
  mobile.hidden = mobileFailed;
  $("brand-fallback").hidden = !siteFailed;
  document
    .querySelector(".app-header")
    .classList.toggle("has-brand-logo", !mobileFailed);
}
$("brand-logo").onchange = async () => {
  const file = $("brand-logo").files[0];
  if (!file) return;
  const generation = ++brandLogoGeneration;
  brandLogoBusy = true;
  $("brand-logo-error").textContent = "";
  $("brand-logo-status").textContent = "";
  syncBrandLogo();
  try {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw new Error("Escolha uma imagem PNG, JPG ou WebP de até 5 MB.");
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(
        "Não foi possível abrir este logo. Escolha outro arquivo.",
      );
    }
    bitmap.close();
    const original = await fileAsDataURL(file);
    if (generation !== brandLogoGeneration) return;
    brandLogo = original;
    syncBrandLogo();
    try {
      await saveBrandLogo(original);
      if (generation === brandLogoGeneration)
        $("brand-logo-status").textContent =
          "Logo salvo no site, neste navegador. Clique em “Usar meu logo no panfleto” para incluí-lo na oferta.";
    } catch {
      if (generation === brandLogoGeneration)
        $("brand-logo-error").textContent =
          "O logo está disponível nesta sessão, mas o navegador não permitiu salvá-lo. Será necessário carregá-lo novamente ao reabrir.";
    }
  } catch (error) {
    if (generation === brandLogoGeneration)
      $("brand-logo-error").textContent =
        error.message || "Não foi possível carregar o logo.";
  } finally {
    if (generation === brandLogoGeneration) {
      brandLogoBusy = false;
      $("brand-logo").value = "";
      syncBrandLogo();
    }
  }
};
function applyPosterLogo(source) {
  update({
    assets: { ...state.assets, logo: source },
    design: {
      ...state.design,
      elements: {
        ...state.design.elements,
        logo: { ...state.design.elements.logo, hidden: false },
      },
    },
  });
  toast(
    "Logo incluído no cartaz. Ajuste a posição e o tamanho no editor visual.",
  );
}
function cancelOfficialLogo() {
  if (officialLogoBusy) $("brand-logo-status").textContent = "";
  officialLogoGeneration++;
  officialLogoBusy = false;
}
$("use-brand-logo").onclick = () => {
  if (!brandLogo || brandLogoBusy) return;
  cancelOfficialLogo();
  applyPosterLogo(brandLogo);
};
for (const logo of OFFICIAL_LOGOS)
  $("use-trilha-" + logo.id).onclick = async () => {
    if (officialLogoBusy || brandLogoBusy) return;
    const generation = ++officialLogoGeneration;
    const previousLogo = state.assets.logo;
    officialLogoBusy = true;
    $("brand-logo-error").textContent = "";
    $("brand-logo-status").textContent =
      `Carregando ${logo.name.toLowerCase()}…`;
    syncBrandLogo();
    try {
      const original = await loadOfficialLogo(logo.id);
      if (generation !== officialLogoGeneration) return;
      if (state.assets.logo !== previousLogo) {
        $("brand-logo-status").textContent = "";
        return;
      }
      applyPosterLogo(original);
      $("brand-logo-status").textContent =
        `${logo.name} aplicado. A imagem original acompanha o PNG e a impressão.`;
    } catch (error) {
      if (generation === officialLogoGeneration) {
        $("brand-logo-status").textContent = "";
        $("brand-logo-error").textContent = error.message;
      }
    } finally {
      if (generation === officialLogoGeneration) {
        officialLogoBusy = false;
        syncBrandLogo();
      }
    }
  };
$("clear-brand-logo").onclick = async () => {
  if (brandLogoBusy) return;
  brandLogoBusy = true;
  $("brand-logo-error").textContent = "";
  syncBrandLogo();
  try {
    await saveBrandLogo("");
    brandLogo = "";
    $("brand-logo-status").textContent =
      "Logo da Trilha restaurado no site. O cartaz atual mantém suas imagens.";
  } catch {
    $("brand-logo-error").textContent =
      "Não foi possível remover o logo salvo. Tente novamente.";
  } finally {
    brandLogoBusy = false;
    syncBrandLogo();
  }
};
function bindImage(id, errorId, maxMB) {
  let version = 0;
  $(id).onchange = async () => {
    const generation = ++version,
      file = $(id).files[0];
    if (!file) return;
    if (id === "logo") {
      cancelOfficialLogo();
      syncBrandLogo();
    }
    $(errorId).textContent = "";
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > maxMB * 1024 * 1024
    ) {
      $(errorId).textContent =
        `Escolha uma imagem PNG, JPG ou WebP de até ${maxMB} MB.`;
      $(id).value = "";
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width,
        height = bitmap.height;
      bitmap.close();
      const data = await fileAsDataURL(file);
      if (generation !== version) return;
      if (id === "photo") {
        cancelProcessing();
        update({
          assets: { ...state.assets, originalPhoto: data, photo: data },
        });
        $("photo-quality").hidden = false;
        const targetWidth = (state.format.widthMm / 25.4) * 300 * 0.55,
          dpi = Math.round((width / targetWidth) * 300);
        $("photo-quality").textContent =
          `${width} × ${height} px · original preservada${dpi < 200 ? " · prefira uma imagem maior para impressão." : "."}`;
        $("background-status").textContent = "";
        if ($("auto-background").checked) cutBackground();
      } else update({ assets: { ...state.assets, logo: data } });
    } catch {
      $(errorId).textContent =
        "Não foi possível abrir esta imagem. Escolha outro arquivo.";
    }
  };
  $("remove-" + id).onclick = () => {
    if (id === "logo") {
      cancelOfficialLogo();
      syncBrandLogo();
    }
    version++;
    $(id).value = "";
    $(errorId).textContent = "";
    if (id === "photo") {
      cancelProcessing();
      $("photo-quality").hidden = true;
      $("background-status").textContent = "";
      update({ assets: { ...state.assets, photo: "", originalPhoto: "" } });
    } else update({ assets: { ...state.assets, logo: "" } });
  };
}
bindImage("photo", "error", 20);
bindImage("logo", "logo-error", 5);
async function cutBackground() {
  if (!state.assets.originalPhoto || backgroundBusy) return;
  const generation = ++photoGeneration,
    source = state.assets.originalPhoto;
  backgroundBusy = true;
  syncPhotoControls();
  $("error").textContent = "";
  try {
    const result = await window.removeProductBackground(
      source,
      (message) => {
        if (generation === photoGeneration)
          $("background-status").textContent = message;
      },
      Number($("background-strength").value),
    );
    if (generation !== photoGeneration) return;
    update({ assets: { ...state.assets, photo: result } });
    $("background-status").textContent =
      "Fundo removido. O produto já está no cartaz.";
  } catch (error) {
    if (generation === photoGeneration) {
      $("background-status").textContent = "A imagem anterior foi mantida.";
      $("error").textContent =
        /^(Não (foi possível|consegui)|Para recortar)/.test(error.message || "")
          ? error.message
          : "Não foi possível remover o fundo. Verifique a conexão e tente novamente.";
    }
  } finally {
    if (generation === photoGeneration) {
      backgroundBusy = false;
      syncPhotoControls();
    }
  }
}
$("cut-background").onclick = cutBackground;
$("background-strength").oninput = () => {
  $("background-strength-value").textContent =
    Number($("background-strength").value) < 30
      ? "Suave"
      : Number($("background-strength").value) > 70
        ? "Forte"
        : "Equilibrada";
};
$("background-strength").onchange = cutBackground;
$("restore-photo").onclick = () => {
  cancelProcessing();
  update({ assets: { ...state.assets, photo: state.assets.originalPhoto } });
  $("background-status").textContent = "Foto original restaurada.";
};
function validateExport() {
  if (backgroundBusy) {
    setStatus("Aguarde o recorte da foto antes de exportar ou imprimir.");
    return false;
  }
  if (!state.data.product.trim()) {
    activatePanel("product");
    $("product").focus();
    toast("Informe o nome do produto.");
    return false;
  }
  const price = parseMoney(state.data.price),
    old = parseMoney(state.data.oldPrice);
  if (price === null || price <= 0 || price > 99999999.99) {
    activatePanel("prices");
    $("price").focus();
    toast("Informe um preço de oferta válido, como 6,99.");
    return false;
  }
  if (
    state.data.oldPrice.trim() &&
    (old === null || old <= 0 || old > 99999999.99)
  ) {
    activatePanel("prices");
    $("oldPrice").focus();
    toast("Corrija o preço anterior ou deixe o campo vazio.");
    return false;
  }
  if (
    state.format.preset === "custom" &&
    (!$("format-width").validity.valid || !$("format-height").validity.valid)
  ) {
    activatePanel("print");
    const invalid = !$("format-width").validity.valid
      ? $("format-width")
      : $("format-height");
    invalid.reportValidity();
    return false;
  }
  const layout = computeImposition(state.format, state.print);
  if (layout.errors.length) {
    activatePanel("print");
    setStatus(layout.errors.join(" "));
    toast(layout.errors[0]);
    return false;
  }
  return true;
}
$("download").onclick = async () => {
  if (!validateExport()) return;
  const button = $("download");
  button.disabled = true;
  setStatus("Preparando o PNG em alta resolução…");
  try {
    const result = await exportPNG(renderPosterSVG(state), state);
    setStatus(
      `PNG exportado: ${result.widthPx} × ${result.heightPx} px, 300 dpi.`,
    );
  } catch (error) {
    setStatus(error.message || "Não foi possível exportar o cartaz.");
  } finally {
    button.disabled = false;
  }
};
$("print").onclick = async () => {
  if (!validateExport()) return;
  const button = $("print");
  button.disabled = true;
  setStatus("Preparando as páginas nas medidas reais…");
  try {
    await printPoster(renderPosterSVG(state), state);
    setStatus(
      "Impressão preparada. Na janela de impressão, escolha o papel e use escala 100%. Você também pode salvar em PDF.",
    );
  } catch (error) {
    setStatus(error.message || "Não foi possível preparar a impressão.");
  } finally {
    button.disabled = false;
  }
};
renderPrintPresets();
render();
activatePanel("product");
scheduleSave();
window.addEventListener("beforeunload", () => {
  clearTimeout(saveTimer);
  saveDraft(state).catch(() => {});
});
