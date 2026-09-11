import { supabase } from "@/lib/supabase";

export type VideoPackageOptions = {
  targetDurationSeconds: number;
  motionIntensity: string;
  cameraMotion: string;
  directorAdjustment?: string;
};

export type ManualVideoPackage = {
  prompt: string;
  referenceLabels: string[];
  hasCanonFrame: boolean;
  hasPreviousCanonVideo: boolean;
};

export async function prepareManualVideoPackage(
  shotNumber: number,
  options: VideoPackageOptions,
  copyToClipboard = true,
): Promise<ManualVideoPackage> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,aspect_ratio,visual_style")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (projectError || !project) throw projectError ?? new Error("Project not found.");

  const { data: shot, error: shotError } = await supabase
    .from("shots")
    .select("id,shot_number,title,camera,action,time_of_day")
    .eq("project_id", project.id)
    .eq("shot_number", shotNumber)
    .single();

  if (shotError || !shot) throw shotError ?? new Error("Shot not found.");

  const { data: canonFrame, error: canonFrameError } = await supabase
    .from("shot_frames")
    .select("id")
    .eq("shot_id", shot.id)
    .eq("is_canon", true)
    .maybeSingle();
  if (canonFrameError) throw canonFrameError;
  if (!canonFrame) throw new Error("Make one frame canon before preparing a video package.");

  const { data: links, error: linksError } = await supabase
    .from("shot_assets")
    .select("asset_id")
    .eq("shot_id", shot.id);
  if (linksError) throw linksError;

  const assetIds = (links ?? []).map((link) => link.asset_id);
  let assets: Array<{
    kind: "character" | "location" | "prop" | "wardrobe";
    name: string;
    description: string | null;
    lock_state: "draft" | "canon";
    reference_image_url: string | null;
  }> = [];

  if (assetIds.length) {
    const { data: assetRows, error: assetError } = await supabase
      .from("assets")
      .select("kind,name,description,lock_state,reference_image_url")
      .in("id", assetIds);
    if (assetError) throw assetError;
    assets = (assetRows ?? []) as typeof assets;
  }

  const canonAssets = assets.filter(
    (asset) => asset.lock_state === "canon" && Boolean(asset.reference_image_url),
  );
  if (canonAssets.length !== assets.length) {
    throw new Error("This shot still has missing or unlocked Story Bible references.");
  }

  const { data: rules, error: rulesError } = await supabase
    .from("continuity_rules")
    .select("description,start_shot,end_shot,target_shot_id")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });
  if (rulesError) throw rulesError;

  const activeRules = (rules ?? []).filter((rule) => {
    if (rule.target_shot_id && rule.target_shot_id !== shot.id) return false;
    if (rule.start_shot != null && shotNumber < rule.start_shot) return false;
    if (rule.end_shot != null && shotNumber > rule.end_shot) return false;
    return true;
  });

  const { data: priorShots, error: priorShotsError } = await supabase
    .from("shots")
    .select("id,shot_number")
    .eq("project_id", project.id)
    .lt("shot_number", shotNumber)
    .order("shot_number", { ascending: false });
  if (priorShotsError) throw priorShotsError;

  let previousCanonVideoShotNumber: number | null = null;
  for (const priorShot of priorShots ?? []) {
    const { data: canonVideo, error: canonVideoError } = await supabase
      .from("shot_video_takes")
      .select("id")
      .eq("shot_id", priorShot.id)
      .eq("is_canon", true)
      .maybeSingle();
    if (canonVideoError) throw canonVideoError;
    if (canonVideo) {
      previousCanonVideoShotNumber = priorShot.shot_number;
      break;
    }
  }

  const assetLines = canonAssets.length
    ? canonAssets.map((asset) => `- ${asset.name}${asset.description ? `: ${asset.description}` : ""}`).join("\n")
    : "- No linked Story Bible assets.";

  const ruleLines = activeRules.length
    ? activeRules.map((rule) => `- ${rule.description}`).join("\n")
    : "- Preserve the established visual continuity of the project.";

  const directorNote = options.directorAdjustment?.trim();

  const prompt = [
    `PROJECT\n${project.title}`,
    `SHOT\n${String(shot.shot_number).padStart(2, "0")} — ${shot.title}`,
    `FORMAT\nVertical ${project.aspect_ratio || "9:16"}\nTarget duration: ${options.targetDurationSeconds} seconds`,
    `SOURCE FRAME\nUse the canon frame for this shot as the primary visual source. Do not redesign the image composition, character identity, wardrobe, or room layout.`,
    `SHOT INTENT\nCamera: ${shot.camera || "preserve the canon frame composition"}\nTime: ${shot.time_of_day || "match canon frame"}\nAction: ${shot.action || "preserve the shot action from the canon frame"}`,
    `VISUAL STYLE\n${project.visual_style || "Photoreal cinematic continuity matching the canon frame."}`,
    `STORY BIBLE REFERENCES\n${assetLines}`,
    `ACTIVE CONTINUITY RULES\n${ruleLines}`,
    `MOTION DIRECTION\n- Motion intensity: ${options.motionIntensity}.\n- Camera motion: ${options.cameraMotion}.\n- Use restrained, natural body movement, breathing, eye movement, hair and fabric response only when physically appropriate.\n- Preserve face identity and proportions frame-to-frame.\n- Avoid temporal flicker, morphing, object duplication, sudden lighting changes, or room-layout drift.`,
    `VIDEO CONTINUITY RULES\n- Preserve identity, wardrobe, props, and room layout exactly.\n- Motion should feel like a continuation of the same film world.\n- Keep camera language consistent with neighboring shots.\n- Do not introduce new people, objects, text, subtitles, logos, or supernatural events.\n- Do not exaggerate facial emotion unless the shot explicitly requires it.`,
    previousCanonVideoShotNumber != null
      ? `PREVIOUS VIDEO CONTEXT\nA canon video exists for Shot ${String(previousCanonVideoShotNumber).padStart(2, "0")}. Use it only as continuity guidance for movement rhythm and cinematic language; the current shot's canon frame remains the primary visual source.`
      : `PREVIOUS VIDEO CONTEXT\nNo earlier canon video is available. Base motion on the current shot's canon frame and Story Bible only.`,
    directorNote ? `DIRECTOR ADJUSTMENT\n${directorNote}` : "",
    `OUTPUT\nCreate one short cinematic vertical video take. Keep the first frame visually consistent with the supplied canon frame and maintain stable identity throughout the take.`,
  ].filter(Boolean).join("\n\n");

  const referenceLabels = [
    `Canon frame · Shot ${String(shotNumber).padStart(2, "0")}`,
    ...canonAssets.map((asset) => asset.name),
  ];
  if (previousCanonVideoShotNumber != null) {
    referenceLabels.push(`Previous canon video · Shot ${String(previousCanonVideoShotNumber).padStart(2, "0")}`);
  }

  if (copyToClipboard) await navigator.clipboard.writeText(prompt);

  return {
    prompt,
    referenceLabels,
    hasCanonFrame: true,
    hasPreviousCanonVideo: previousCanonVideoShotNumber != null,
  };
}
