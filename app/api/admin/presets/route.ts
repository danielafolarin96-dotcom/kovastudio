import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024; // Vercel rejects request bodies over 4.5 MB

// Admin: add a preset character (multipart form: file, name, category, promptExtra).
export async function POST(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Send the preset as a form.", 400);
  }

  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const category = String(form.get("category") ?? "").trim().slice(0, 40) || "General";
  const promptExtra = String(form.get("promptExtra") ?? "").trim().slice(0, 200) || null;

  if (!(file instanceof File)) return jsonError("Pick an image.", 400);
  if (!name) return jsonError("Give the character a name.", 400);
  const ext = TYPES[file.type];
  if (!ext) return jsonError("Use a JPG, PNG or WebP image.", 400);
  if (file.size > MAX_BYTES) return jsonError("Image must be under 4 MB.", 400);

  const admin = createAdminClient();
  const path = `${randomUUID()}.${ext}`;
  const upload = await admin.storage.from("presets").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) {
    console.error("[admin/presets] upload", upload.error);
    return jsonError("Upload failed. Check that the presets bucket exists (run schema.sql).", 500);
  }

  const { error } = await admin.from("presets").insert({ name, category, prompt_extra: promptExtra, image_path: path });
  if (error) {
    await admin.storage.from("presets").remove([path]);
    return jsonError("Could not save the preset.", 500);
  }
  return json({ ok: true });
}

// Admin: show/hide or reorder a preset.
export async function PATCH(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;

  const body = await readJson<{ id: string; active: boolean; sort: number }>(req);
  if (typeof body.id !== "string") return jsonError("Missing preset.", 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Number.isFinite(body.sort)) patch.sort = Math.floor(Number(body.sort));
  if (!Object.keys(patch).length) return jsonError("Nothing to change.", 400);

  const { error } = await createAdminClient().from("presets").update(patch).eq("id", body.id);
  if (error) return jsonError("Could not update.", 500);
  return json({ ok: true });
}

// Admin: delete a preset and its image.
export async function DELETE(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;

  const body = await readJson<{ id: string }>(req);
  if (typeof body.id !== "string") return jsonError("Missing preset.", 400);

  const admin = createAdminClient();
  const { data: preset } = await admin
    .from("presets")
    .select("image_path")
    .eq("id", body.id)
    .maybeSingle<{ image_path: string }>();
  if (!preset) return jsonError("Preset not found.", 404);

  await admin.storage.from("presets").remove([preset.image_path]);
  const { error } = await admin.from("presets").delete().eq("id", body.id);
  if (error) return jsonError("Could not delete.", 500);
  return json({ ok: true });
}
