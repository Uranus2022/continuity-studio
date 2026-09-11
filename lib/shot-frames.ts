import { supabase } from "@/lib/supabase";

export const SHOT_FRAME_BUCKET = "shot-frames";
export const MAX_SHOT_FRAME_BYTES = 10 * 1024 * 1024;
export const ALLOWED_SHOT_FRAME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ShotFrame = {
  id: string;
  shot_id: string;
  created_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  label: string | null;
  is_approved: boolean;
  is_canon: boolean;
  created_at: string;
  updated_at: string;
  signed_url: string | null;
};

type UploadShotFrameInput = {
  file: File;
  userId: string;
  projectId: string;
  shotId: string;
};

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function attachSignedUrl<T extends Omit<ShotFrame, "signed_url">>(frame: T): Promise<ShotFrame> {
  const { data, error } = await supabase.storage
    .from(SHOT_FRAME_BUCKET)
    .createSignedUrl(frame.storage_path, 60 * 60);

  return {
    ...frame,
    signed_url: error ? null : data?.signedUrl ?? null,
  };
}

export async function listShotFrames(shotIds: string[]): Promise<ShotFrame[]> {
  if (!shotIds.length) return [];

  const { data, error } = await supabase
    .from("shot_frames")
    .select("id,shot_id,created_by,storage_path,file_name,mime_type,file_size,label,is_approved,is_canon,created_at,updated_at")
    .in("shot_id", shotIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all((data ?? []).map((frame) => attachSignedUrl(frame)));
}

export async function uploadShotFrame({ file, userId, projectId, shotId }: UploadShotFrameInput): Promise<ShotFrame> {
  if (!ALLOWED_SHOT_FRAME_TYPES.has(file.type)) {
    throw new Error("Shot frames must be JPEG, PNG, or WebP.");
  }

  if (file.size > MAX_SHOT_FRAME_BYTES) {
    throw new Error("Shot frames must be 10 MB or smaller.");
  }

  const extension = extensionForMimeType(file.type);
  const objectName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const storagePath = `${userId}/${projectId}/${shotId}/${objectName}`;

  const { error: uploadError } = await supabase.storage
    .from(SHOT_FRAME_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("shot_frames")
    .insert({
      shot_id: shotId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    })
    .select("id,shot_id,created_by,storage_path,file_name,mime_type,file_size,label,is_approved,is_canon,created_at,updated_at")
    .single();

  if (insertError || !data) {
    await supabase.storage.from(SHOT_FRAME_BUCKET).remove([storagePath]);
    throw insertError ?? new Error("Could not save shot frame metadata.");
  }

  return attachSignedUrl(data);
}

export async function deleteShotFrame(frame: ShotFrame): Promise<void> {
  const { error: deleteError } = await supabase.from("shot_frames").delete().eq("id", frame.id);
  if (deleteError) throw deleteError;

  const { error: storageError } = await supabase.storage.from(SHOT_FRAME_BUCKET).remove([frame.storage_path]);
  if (storageError) {
    console.warn("Shot frame metadata was deleted, but the storage object could not be removed:", storageError.message);
  }
}
