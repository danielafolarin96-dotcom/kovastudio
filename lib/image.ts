import { MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, MIN_IMAGE_SIDE, RECOMMENDED_IMAGE_SIDE } from "@/lib/config";

export type PreparedImage = {
  blob: Blob; // resized JPEG sent to the AI
  url: string; // object URL for the preview thumbnail
  width: number;
  height: number;
  warning: string | null;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Checks the picked file, fixes phone rotation, shrinks it to MAX_IMAGE_SIDE
// and converts it to JPEG so uploads stay small and fast.
export async function prepareReferenceImage(file: Blob): Promise<PreparedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Use a JPG, PNG or WebP image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is over 10 MB. Pick a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Could not read that image. Try a different file.");
  }

  const shortest = Math.min(bitmap.width, bitmap.height);
  if (shortest < MIN_IMAGE_SIDE) {
    bitmap.close();
    throw new Error(
      `Image is too small (${bitmap.width}x${bitmap.height}). Use one at least ${RECOMMENDED_IMAGE_SIDE}px on each side.`,
    );
  }

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Your browser could not process this image.");
  }
  ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not convert the image."))), "image/jpeg", 0.92);
  });

  const warning =
    shortest < RECOMMENDED_IMAGE_SIDE
      ? "This image is a bit small, so the result may look soft. 512px or bigger works best."
      : null;

  return { blob, url: URL.createObjectURL(blob), width, height, warning };
}

// Loads a gallery preset from its public URL and prepares it the same way.
export async function prepareFromUrl(url: string): Promise<PreparedImage> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "force-cache" });
  } catch {
    throw new Error("Could not load that character. Check your connection.");
  }
  if (!res.ok) throw new Error("That character image is missing. Pick another one.");
  const blob = await res.blob();
  return prepareReferenceImage(blob);
}
