/** Local-only draft and reusable-settings storage.
 * Drafts retain their original image data in IndexedDB. The localStorage mirror
 * intentionally omits image bytes. All writes clone/sanitize caller data and
 * never mutate the state supplied by the editor.
 */
const DATABASE = "trilha-studio";
const STORE = "drafts";
const CURRENT = "current";
const BRAND_LOGO = "brand-logo";
const DRAFT_KEY = "trilha-v2-draft";
const LEGACY_KEY = "trilha-offer";
const PREFIX = "trilha-v2-";
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const SECTIONS = ["data", "design", "format", "print"];
const ASSET_KEYS = ["photo", "logo", "originalPhoto"];
let databasePromise;
let operationQueue = Promise.resolve();
let lastStamp = 0;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanJSON(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "object" || depth > 20 || seen.has(value))
    return undefined;
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((item) => cleanJSON(item, depth + 1, seen) ?? null);
  } else {
    result = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN.has(key)) continue;
      const clean = cleanJSON(item, depth + 1, seen);
      if (clean !== undefined) result[key] = clean;
    }
  }
  seen.delete(value);
  return result;
}

function cleanDraft(input) {
  if (!isRecord(input) || !SECTIONS.some((key) => isRecord(input[key])))
    return null;
  const result = { version: 2 };
  for (const key of SECTIONS) {
    if (isRecord(input[key])) result[key] = cleanJSON(input[key]);
  }
  result.assets = { photo: "", logo: "", originalPhoto: "" };
  if (isRecord(input.assets)) {
    for (const key of ASSET_KEYS) {
      const value = input.assets[key];
      // An asset is embedded image data, never a script, remote URL or credential.
      if (
        typeof value === "string" &&
        /^data:image\/(png|jpe?g|webp);base64,/i.test(value)
      ) {
        result.assets[key] = value;
      }
    }
  }
  return result;
}

function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readLocal(key) {
  try {
    const value = storage()?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  const target = storage();
  if (!target) throw new Error("O armazenamento local está indisponível.");
  target.setItem(key, JSON.stringify(value));
}

function nextStamp() {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function enqueue(operation) {
  const pending = operationQueue.then(operation);
  operationQueue = pending.catch(() => {});
  return pending;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    let request,
      finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(
      () =>
        finish(reject, new Error("O armazenamento de imagens não respondeu.")),
      3000,
    );
    try {
      if (!globalThis.indexedDB) throw new Error("IndexedDB indisponível.");
      request = globalThis.indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE);
      };
      request.onblocked = () =>
        finish(reject, new Error("O armazenamento de imagens está ocupado."));
      request.onerror = () =>
        finish(
          reject,
          request.error ||
            new Error("Falha ao abrir o armazenamento de imagens."),
        );
      request.onsuccess = () => {
        const db = request.result;
        if (finished) {
          db.close();
          return;
        }
        if (!db.objectStoreNames.contains(STORE)) {
          db.close();
          finish(
            reject,
            new Error("O armazenamento de imagens não está disponível."),
          );
          return;
        }
        db.onversionchange = () => {
          db.close();
          databasePromise = undefined;
        };
        finish(resolve, db);
      };
    } catch (error) {
      finish(reject, error);
    }
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function transact(mode, envelope, key = CURRENT) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx,
      result,
      settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      try {
        tx?.abort();
      } catch {
        /* A transaction may already have completed. */
      }
      finish(reject, new Error("O armazenamento de imagens não respondeu."));
    }, 5000);
    try {
      tx = db.transaction(STORE, mode);
      const request =
        mode === "readonly"
          ? tx.objectStore(STORE).get(key)
          : tx.objectStore(STORE).put(envelope, key);
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => finish(resolve, result);
      tx.onerror = tx.onabort = () =>
        finish(
          reject,
          tx.error || new Error("Falha no armazenamento de imagens."),
        );
    } catch (error) {
      databasePromise = undefined;
      finish(reject, error);
    }
  });
}

function decodeEnvelope(raw) {
  if (!isRecord(raw)) return null;
  if (Object.hasOwn(raw, "state")) {
    const state = raw.state === null ? null : cleanDraft(raw.state);
    if (raw.state !== null && !state) return null;
    return {
      state,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    };
  }
  // Tolerate a directly stored draft from an earlier development build.
  const state = cleanDraft(raw);
  return state ? { state, updatedAt: 0 } : null;
}

function imageFreeEnvelope(envelope) {
  if (envelope.state === null) return { ...envelope };
  return {
    ...envelope,
    state: {
      ...envelope.state,
      assets: { photo: "", logo: "", originalPhoto: "" },
    },
  };
}

async function persistEnvelope(envelope) {
  let indexed = false;
  try {
    await transact("readwrite", envelope);
    indexed = true;
  } catch {
    /* Use the image-free fallback below. */
  }
  let mirrored = false;
  try {
    writeLocal(DRAFT_KEY, imageFreeEnvelope(envelope));
    mirrored = true;
  } catch {
    /* IndexedDB may still contain the complete draft. */
  }
  if (!indexed && !mirrored) {
    throw new Error(
      "Não foi possível salvar o rascunho neste navegador. Libere espaço ou permita o armazenamento do site.",
    );
  }
  const hasImages =
    !!envelope.state && ASSET_KEYS.some((key) => envelope.state.assets[key]);
  if (indexed) return { imagesSaved: true, storage: "indexeddb" };
  return {
    imagesSaved: !hasImages,
    storage: "localstorage",
    ...(hasImages
      ? {
          warning:
            "Os textos foram salvos, mas será necessário reenviar as fotos e o logotipo ao reabrir.",
        }
      : {}),
  };
}

/** Read the latest completed save. Corrupt/unavailable storage never throws. */
export async function loadDraft() {
  return enqueue(async () => {
    let indexed = null;
    try {
      indexed = decodeEnvelope(await transact("readonly"));
    } catch {
      /* Optional browser capability. */
    }
    const mirrored = decodeEnvelope(readLocal(DRAFT_KEY));
    const candidates = [indexed, mirrored]
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (candidates.length) {
      lastStamp = Math.max(
        lastStamp,
        ...candidates.map((item) => item.updatedAt),
      );
      // A successful IndexedDB save wins its image-free mirror at the same time.
      return candidates[0].state;
    }
    const legacy = readLocal(LEGACY_KEY);
    if (!isRecord(legacy?.v)) return null;
    const migrated = cleanDraft({
      data: legacy.v,
      design: {
        background: typeof legacy.color === "string" ? legacy.color : "#101D40",
      },
      assets: { photo: "", logo: "", originalPhoto: "" },
    });
    return migrated ? { ...migrated, migrated: true } : null;
  });
}

/** Save a snapshot without changing state; failed image storage is explicit. */
export async function saveDraft(state) {
  const snapshot = cleanDraft(state);
  if (!snapshot)
    throw new Error("O rascunho não contém dados válidos para salvar.");
  return enqueue(() =>
    persistEnvelope({ schema: 2, updatedAt: nextStamp(), state: snapshot }),
  );
}

/** A tombstone prevents an older IndexedDB or legacy draft from reappearing. */
export async function clearDraft() {
  return enqueue(async () => {
    await persistEnvelope({ schema: 2, updatedAt: nextStamp(), state: null });
    try {
      storage()?.removeItem(LEGACY_KEY);
    } catch {
      /* The tombstone already prevents migration. */
    }
  });
}

function collectionKey(key) {
  if (
    typeof key !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(key) ||
    ["draft", "offer"].includes(key)
  ) {
    throw new Error("Nome inválido para a configuração salva.");
  }
  return PREFIX + key;
}

/** Read reusable templates/settings. Missing or invalid collections are empty. */
export function loadCollection(key) {
  try {
    const value = readLocal(collectionKey(key));
    return Array.isArray(value) ? cleanJSON(value) : [];
  } catch {
    return [];
  }
}

export function saveCollection(key, items) {
  const name = collectionKey(key);
  if (!Array.isArray(items))
    throw new Error("A lista de configurações não é válida.");
  try {
    writeLocal(name, cleanJSON(items));
  } catch {
    throw new Error(
      "Não foi possível salvar a configuração neste navegador. Verifique o espaço e as permissões de armazenamento.",
    );
  }
}

/** Read the store identity independently of the active poster draft. */
export async function loadBrandLogo() {
  return enqueue(async () => {
    try {
      const value = await transact("readonly", undefined, BRAND_LOGO);
      return typeof value === "string" &&
        /^data:image\/(png|jpe?g|webp);base64,/i.test(value)
        ? value
        : "";
    } catch {
      return "";
    }
  });
}

/** Persist the original logo only in IndexedDB; an empty string removes it.
 * There is no image-bearing localStorage fallback and no change to the draft.
 */
export async function saveBrandLogo(dataurl) {
  if (
    typeof dataurl !== "string" ||
    (dataurl !== "" && !/^data:image\/(png|jpe?g|webp);base64,/i.test(dataurl))
  ) {
    throw new Error("Escolha um logotipo PNG, JPEG ou WebP válido.");
  }
  return enqueue(async () => {
    try {
      await transact("readwrite", dataurl, BRAND_LOGO);
    } catch {
      throw new Error(
        "Não foi possível salvar o logotipo neste navegador. Libere espaço ou permita o armazenamento do site.",
      );
    }
  });
}
