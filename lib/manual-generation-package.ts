import { buildManualGenerationPrompt, buildReferenceChecklist } from "@/lib/manual-generation";
import { supabase } from "@/lib/supabase";

export type ManualGenerationPackage = {
  prompt: string;
  referenceLabels: string[];
  hasPreviousCanon: boolean;
};

export async function prepareManualGenerationPackage(
  shotNumber: number,
  directorNote = "",
): Promise<ManualGenerationPackage> {
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

  const { data: links, error: linkError } = await supabase
    .from("shot_assets")
    .select("asset_id")
    .eq("shot_id", shot.id);
  if (linkError) throw linkError;

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

  const { data: previousShot, error: previousShotError } = await supabase
    .from("shots")
    .select("id,shot_number")
    .eq("project_id", project.id)
    .lt("shot_number", shotNumber)
    .order("shot_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousShotError) throw previousShotError;

  let previousCanonShotNumber: number | null = null;
  if (previousShot) {
    const { data: canonFrame, error: frameError } = await supabase
      .from("shot_frames")
      .select("id")
      .eq("shot_id", previousShot.id)
      .eq("is_canon", true)
      .maybeSingle();
    if (frameError) throw frameError;
    if (canonFrame) previousCanonShotNumber = previousShot.shot_number;
  }

  let prompt = buildManualGenerationPrompt({
    project,
    shot,
    assets: canonAssets,
    rules: activeRules,
    previousCanonShotNumber,
  });

  const note = directorNote.trim();
  if (note) prompt += `\n\nDIRECTOR ADJUSTMENT\n${note}`;

  const referenceLabels = buildReferenceChecklist(canonAssets, previousCanonShotNumber);

  await navigator.clipboard.writeText(prompt);

  return {
    prompt,
    referenceLabels,
    hasPreviousCanon: previousCanonShotNumber != null,
  };
}
