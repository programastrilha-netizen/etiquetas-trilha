/** Official image sources. Original bytes are embedded without re-encoding. */
export const OFFICIAL_LOGOS = Object.freeze([
  Object.freeze({
    id: "dark",
    name: "Logo escuro",
    url: "https://dcdn-us.mitiendanube.com/stores/006/752/693/themes/common/logo-938984077-1762189512-00fafd9e99e4002c1781379251ca21e91762189512-480-0.webp",
    mime: "image/webp",
  }),
  Object.freeze({
    id: "light",
    name: "Logo claro",
    url: "https://i.imgur.com/CpZs2GK.png",
    mime: "image/png",
  }),
]);

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const successfulLoads = new Map();
const CONNECTION_MESSAGE =
  "Não foi possível carregar o logotipo oficial. Verifique sua conexão ou envie o arquivo da logo.";

function imageDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(CONNECTION_MESSAGE));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = reader.onabort = () =>
      reject(new Error(CONNECTION_MESSAGE));
    reader.readAsDataURL(blob);
  });
}

async function fetchLogo(definition) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(definition.url, {
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(CONNECTION_MESSAGE);
    const original = await response.blob();
    if (!original.size || original.size > MAX_BYTES) {
      throw new Error(
        "O logotipo oficial não pôde ser usado. Envie uma imagem da logo com até 5 MB.",
      );
    }
    const mime = original.type.toLowerCase().split(";")[0].trim();
    // Some image hosts return binary MIME metadata. Only fix that metadata;
    // wrapping the Blob leaves every byte of the downloaded image intact.
    const blob =
      !mime || mime === "application/octet-stream"
        ? new Blob([original], { type: definition.mime })
        : original;
    if (!/^image\/(png|jpe?g|webp)(?:;|$)/i.test(blob.type)) {
      throw new Error(CONNECTION_MESSAGE);
    }
    const bitmap = await createImageBitmap(blob);
    try {
      if (!bitmap.width || !bitmap.height) throw new Error(CONNECTION_MESSAGE);
    } finally {
      bitmap.close();
    }
    return await imageDataURL(blob);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "O carregamento do logotipo demorou demais. Verifique sua conexão ou envie o arquivo da logo.",
      );
    }
    if (
      error instanceof Error &&
      (error.message === CONNECTION_MESSAGE ||
        error.message ===
          "O logotipo oficial não pôde ser usado. Envie uma imagem da logo com até 5 MB.")
    )
      throw error;
    throw new Error(CONNECTION_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch once per logo, sharing in-flight loads; failed requests can be retried. */
export async function loadOfficialLogo(id) {
  const definition = OFFICIAL_LOGOS.find((logo) => logo.id === id);
  if (!definition) {
    throw new Error(
      "Escolha um logotipo oficial válido ou envie uma imagem da logo.",
    );
  }
  let pending = successfulLoads.get(id);
  if (!pending) {
    pending = fetchLogo(definition).catch((error) => {
      if (successfulLoads.get(id) === pending) successfulLoads.delete(id);
      throw error;
    });
    successfulLoads.set(id, pending);
  }
  return pending;
}
