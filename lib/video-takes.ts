import { supabase } from "@/lib/supabase";

export const SHOT_VIDEO_BUCKET = "shot-videos";
export const MAX_SHOT_VIDEO_BYTES = 50 * 1024 * 1024;
export const ALLOWED_SHOT_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export type ShotVideoTake = {
  id: string;
  shot_id: string;
  created_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  duration_seconds: number | null;
  source_frame_id: string | null;
  previous_video_take_id: string | null;
  prompt_package: string | null;
  director_adjustment: string | null;
  target_duration_seconds: number | null;
  motion_intensity: string | null;
  camera_motion: string | null;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  is_canon: boolean;
  canon_at: string | null;
  canon_by: string | null;
  created_at: string;
  updated_at: string;
  signed_url: string | null;
};

type UploadShotVideoTakeInput = {
  file: File;
  userId: string;
  projectId: string;
  shotId: string;
  sourceFrameId: string | null;
  previousVideoTakeId: string | null;
  promptPackage?: string;
  directorAdjustment?: string;
  targetDurationSeconds?: number;
  motionIntensity?: string;
  cameraMotion?: string;
};

const VIDEO_SELECT =
  "id,shot_id,created_by,storage_path,file_name,mime_type,file_size,duration_seconds,source_frame_id,previous_video_take_id,prompt_package,director_adjustment,target_duration_seconds,motion_intensity,camera_motion,is_approved,approved_at,approved_by,is_canon,canon_at,canon_by,created_at,updated_at";

function extensionForMimeType(mimeType: string) {
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "mp4";
}

async function attachSignedUrl<T extends Omit<ShotVideoTake, "signed_url">>(take: T): Promise<ShotVideoTake> {
  const { data, error } = await supabase.storage
    .from(SHOT_VIDEO_BUCKET)
    .createSignedUrl(take.storage_path, 60 * 60);

  return {
    ...take,
    signed_url: error ? null : data?.signedUrl ?? null,
  };
}

export async function listShotVideoTakes(shotIds: string[]): Promise<ShotVideoTake[]> {
  if (!shotIds.length) return [];

  const { data, error } = await supabase
    .from("shot_video_takes")
    .select(VIDEO_SELECT)
    .in("shot_id", shotIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Promise.all((data ?? []).map((take) => attachSignedUrl(take as Omit<ShotVideoTake, "signed_url">)));
}

export async function uploadShotVideoTake(input: UploadShotVideoTakeInput): Promise<ShotVideoTake> {
  const { file } = input;

  if (!ALLOWED_SHOT_VIDEO_TYPES.has(file.type)) {
    throw new Error("Video takes must be MP4, MOV, or WebM.");
  }

  if (file.size > MAX_SHOT_VIDEO_BYTES) {
    throw new Error("Video takes must be 50 MB or smaller for this MVP.");
  }

  const extension = extensionForMimeType(file.type);
  const objectName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const storagePath = `${input.userId}/${input.projectId}/${input.shotId}/${objectName}`;

  const { error: uploadError } = await supabase.storage
    .from(SHOT_VIDEO_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("shot_video_takes")
    .insert({
      shot_id: input.shotId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      source_frame_id: input.sourceFrameId,
      previous_video_take_id: input.previousVideoTakeId,
      prompt_package: input.promptPackage?.trim() || null,
      director_adjustment: input.directorAdjustment?.trim() || null,
      target_duration_seconds: input.targetDurationSeconds ?? null,
      motion_intensity: input.motionIntensity ?? null,
      camera_motion: input.cameraMotion ?? null,
    })
    .select(VIDEO_SELECT)
    .single();

  if (insertError || !data) {
    await supabase.storage.from(SHOT_VIDEO_BUCKET).remove([storagePath]);
    throw insertError ?? new Error("Could not save video take metadata.");
  }

  return attachSignedUrl(data as Omit<ShotVideoTake, "signed_url">);
}

export async function approveShotVideoTake(takeId: string): Promise<void> {
  const { error } = await supabase.rpc("set_shot_video_take_approved", { p_take_id: takeId });
  if (error) throw error;
}

export async function canonShotVideoTake(takeId: string): Promise<void> {
  const { error } = await supabase.rpc("set_shot_video_take_canon", { p_take_id: takeId });
  if (error) throw error;
}

export async function deleteShotVideoTake(take: ShotVideoTake): Promise<void> {
  const { error: deleteError } = await supabase.from("shot_video_takes").delete().eq("id", take.id);
  if (deleteError) throw deleteError;

  const { error: storageError } = await supabase.storage.from(SHOT_VIDEO_BUCKET).remove([take.storage_path]);
  if (storageError) {
    console.warn("Video take metadata was deleted, but the storage object could not be removed:", storageError.message);
  }
}
