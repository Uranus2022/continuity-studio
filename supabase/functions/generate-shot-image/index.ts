import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANON_BUCKET = "canon-references";
const SHOT_FRAME_BUCKET = "shot-frames";
const DEFAULT_MODEL = "gpt-image-2.5-flare";
const ALLOWED_QUALITIES = new Set(["low", "medium", "high"]);

type AssetRow = {
  id: string;
  kind: "character" | "location" | "prop" | "wardrobe";
  name: string;
  description: string | null;
  reference_image_url: string | null;
  lock_state: "draft" | "canon";
};

type ReferenceInput = {
  label: string;
  fileName: string;
  blob: Blob;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sizeForAspectRatio(aspectRatio: string) {
  if (aspectRatio === "9:16") return "1152x2048";
  if (aspectRatio === "16:9") return "2048x1152";
  if (aspectRatio === "1:1") return "1536x1536";
  return "auto";
}

function mimeExtension(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

function assetPriority(kind: AssetRow["kind"]) {
  if (kind === "character") return 0;
  if (kind === "location") return 1;
  if (kind === "wardrobe") return 2;
  return 3;
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAIKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase function environment is incomplete." }, 500);
  }
  if (!openAIKey) {
    return json({
      error: "OpenAI image generation is not configured yet. Add OPENAI_API_KEY to Supabase Edge Function secrets.",
      code: "provider_not_configured",
    }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) return json({ error: "Invalid session." }, 401);

  let generationId: string | null = null;

  try {
    const body = await req.json();
    const shotId = typeof body?.shotId === "string" ? body.shotId : "";
    const directorNote = typeof body?.directorNote === "string" ? body.directorNote.trim() : "";
    const quality = ALLOWED_QUALITIES.has(body?.quality) ? body.quality : "medium";
    if (!shotId) return json({ error: "shotId is required." }, 400);

    const { data: shot, error: shotError } = await admin
      .from("shots")
      .select("id,project_id,shot_number,title,camera,action,time_of_day,prompt")
      .eq("id", shotId)
      .single();
    if (shotError || !shot) return json({ error: "Shot not found." }, 404);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id,user_id,title,aspect_ratio,visual_style")
      .eq("id", shot.project_id)
      .single();
    if (projectError || !project || project.user_id !== user.id) {
      return json({ error: "You do not have access to this shot." }, 403);
    }

    const [{ data: links, error: linksError }, { data: allRules, error: rulesError }] = await Promise.all([
      admin.from("shot_assets").select("asset_id,role").eq("shot_id", shot.id),
      admin
        .from("continuity_rules")
        .select("description,start_shot,end_shot,target_shot_id,severity")
        .eq("project_id", project.id),
    ]);
    if (linksError) throw linksError;
    if (rulesError) throw rulesError;

    const assetIds = (links ?? []).map((link) => link.asset_id);
    let assets: AssetRow[] = [];
    if (assetIds.length) {
      const { data: assetRows, error: assetError } = await admin
        .from("assets")
        .select("id,kind,name,description,reference_image_url,lock_state")
        .in("id", assetIds);
      if (assetError) throw assetError;
      assets = (assetRows ?? []) as AssetRow[];
    }

    const activeRules = (allRules ?? []).filter((rule) => {
      if (rule.target_shot_id && rule.target_shot_id !== shot.id) return false;
      if (rule.start_shot != null && shot.shot_number < rule.start_shot) return false;
      if (rule.end_shot != null && shot.shot_number > rule.end_shot) return false;
      return true;
    });

    const { data: previousShots, error: previousShotError } = await admin
      .from("shots")
      .select("id,shot_number,title")
      .eq("project_id", project.id)
      .lt("shot_number", shot.shot_number)
      .order("shot_number", { ascending: false })
      .limit(1);
    if (previousShotError) throw previousShotError;

    const previousShot = previousShots?.[0] ?? null;
    let previousCanonFrame: { storage_path: string } | null = null;
    if (previousShot) {
      const { data: previousFrame, error: previousFrameError } = await admin
        .from("shot_frames")
        .select("storage_path")
        .eq("shot_id", previousShot.id)
        .eq("is_canon", true)
        .maybeSingle();
      if (previousFrameError) throw previousFrameError;
      previousCanonFrame = previousFrame;
    }

    const linkedRole = new Map((links ?? []).map((link) => [link.asset_id, link.role]));
    const canonAssets = assets
      .filter((asset) => asset.lock_state === "canon" && asset.reference_image_url)
      .sort((a, b) => assetPriority(a.kind) - assetPriority(b.kind));

    const assetLines = assets.map((asset) => {
      const role = linkedRole.get(asset.id);
      const description = asset.description ? ` — ${asset.description}` : "";
      return `- ${asset.name} (${asset.kind}${role ? `, ${role}` : ""})${description}`;
    });
    const ruleLines = activeRules.map((rule) => `- ${rule.description}`);

    const prompt = [
      `Create one continuity-critical cinematic frame for the short film “${project.title}”.`,
      `Shot ${String(shot.shot_number).padStart(2, "0")}: ${shot.title}.`,
      `Camera: ${shot.camera ?? "not specified"}.`,
      `Action: ${shot.action ?? "not specified"}.`,
      `Time of day: ${shot.time_of_day ?? "not specified"}.`,
      `Visual style: ${project.visual_style ?? "cinematic photorealism"}.`,
      `Target aspect ratio: ${project.aspect_ratio}.`,
      "",
      "Continuity assets for this shot:",
      ...(assetLines.length ? assetLines : ["- No recurring assets linked."]),
      "",
      "Hard continuity rules:",
      ...(ruleLines.length ? ruleLines : ["- Preserve established project continuity."]),
      "",
      "Reference handling:",
      "- Treat every attached reference image as authoritative, not inspirational.",
      "- Preserve the exact recurring character identity, hair, wardrobe, phone, room layout, prop design, and lighting logic shown in the references.",
      previousCanonFrame && previousShot
        ? `- The final attached continuity image from Shot ${String(previousShot.shot_number).padStart(2, "0")} is the previous canon frame; inherit visual continuity from it without copying its camera angle unless appropriate.`
        : "- There is no previous canon shot frame attached; rely on the asset references.",
      "",
      "Output requirements:",
      "- Produce exactly one finished frame, not a storyboard, split screen, collage, contact sheet, or UI mockup.",
      "- No captions, subtitles, watermarks, frame numbers, borders, or production notes.",
      "- Do not invent extra people, props, costume changes, injuries, or story events.",
      "- If a phone screen is visible, keep interface text minimal and non-legible unless the shot explicitly requires readable text.",
      "- Natural skin and fabric texture; cinematic lighting; no excessive beauty retouching.",
      directorNote ? `\nDirector adjustment for this render:\n${directorNote}` : "",
    ].filter(Boolean).join("\n");

    const references: ReferenceInput[] = [];
    for (const asset of canonAssets.slice(0, 15)) {
      const { data: blob, error: downloadError } = await admin.storage
        .from(CANON_BUCKET)
        .download(asset.reference_image_url!);
      if (downloadError || !blob) continue;
      references.push({
        label: asset.name,
        blob,
        fileName: `${asset.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${mimeExtension(blob.type)}`,
      });
    }

    if (previousCanonFrame && references.length < 16) {
      const { data: previousBlob, error: previousDownloadError } = await admin.storage
        .from(SHOT_FRAME_BUCKET)
        .download(previousCanonFrame.storage_path);
      if (!previousDownloadError && previousBlob) {
        references.push({
          label: `Previous canon Shot ${previousShot?.shot_number ?? ""}`,
          blob: previousBlob,
          fileName: `previous-canon.${mimeExtension(previousBlob.type)}`,
        });
      }
    }

    const size = sizeForAspectRatio(project.aspect_ratio);
    const model = DEFAULT_MODEL;
    const { data: generation, error: generationError } = await admin
      .from("generations")
      .insert({
        shot_id: shot.id,
        provider: "openai",
        model,
        media_type: "image",
        prompt,
        status: "running",
        reference_count: references.length,
        input: {
          quality,
          size,
          asset_names: assets.map((asset) => asset.name),
          reference_labels: references.map((reference) => reference.label),
          previous_canon_shot: previousShot?.shot_number ?? null,
          director_note: directorNote || null,
        },
      })
      .select("id")
      .single();
    if (generationError || !generation) throw generationError ?? new Error("Could not create generation record.");
    generationId = generation.id;

    let openAIResponse: Response;
    if (references.length) {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("n", "1");
      form.append("size", size);
      form.append("quality", quality);
      form.append("background", "opaque");
      form.append("output_format", "jpeg");
      form.append("output_compression", "90");
      for (const reference of references) {
        form.append("image[]", new File([reference.blob], reference.fileName, {
          type: reference.blob.type || "image/jpeg",
        }));
      }

      openAIResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${openAIKey}` },
        body: form,
      });
    } else {
      openAIResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          quality,
          background: "opaque",
          output_format: "jpeg",
          output_compression: 90,
        }),
      });
    }

    const openAIBody = await openAIResponse.json();
    if (!openAIResponse.ok) {
      throw new Error(openAIBody?.error?.message ?? `OpenAI image generation failed (${openAIResponse.status}).`);
    }

    const base64 = openAIBody?.data?.[0]?.b64_json;
    if (!base64 || typeof base64 !== "string") {
      throw new Error("OpenAI returned no image data.");
    }

    const imageBytes = decodeBase64(base64);
    const timestamp = Date.now();
    const fileName = `shot-${String(shot.shot_number).padStart(2, "0")}-${timestamp}.jpg`;
    const storagePath = `${user.id}/${project.id}/${shot.id}/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from(SHOT_FRAME_BUCKET)
      .upload(storagePath, imageBytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: frame, error: frameError } = await admin
      .from("shot_frames")
      .insert({
        shot_id: shot.id,
        created_by: user.id,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: "image/jpeg",
        file_size: imageBytes.byteLength,
        label: "AI · GPT-Image-2.5 Flare",
      })
      .select("id")
      .single();
    if (frameError || !frame) {
      await admin.storage.from(SHOT_FRAME_BUCKET).remove([storagePath]);
      throw frameError ?? new Error("Could not save generated frame.");
    }

    const durationMs = Date.now() - startedAt;
    await admin
      .from("generations")
      .update({
        status: "succeeded",
        output_url: storagePath,
        shot_frame_id: frame.id,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", generationId);

    return json({
      ok: true,
      generationId,
      shotFrameId: frame.id,
      model,
      quality,
      size,
      referenceCount: references.length,
      prompt,
      durationMs,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Image generation failed.";
    if (generationId) {
      await admin
        .from("generations")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", generationId);
    }
    return json({ error: message }, 500);
  }
});
