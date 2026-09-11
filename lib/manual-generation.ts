export type ManualPromptProject = {
  title: string;
  aspect_ratio: string;
  visual_style: string | null;
};

export type ManualPromptShot = {
  shot_number: number;
  title: string;
  camera: string | null;
  action: string | null;
  time_of_day: string | null;
};

export type ManualPromptAsset = {
  kind: "character" | "location" | "prop" | "wardrobe";
  name: string;
  description: string | null;
};

export type ManualPromptRule = {
  description: string;
};

type BuildManualGenerationPromptInput = {
  project: ManualPromptProject;
  shot: ManualPromptShot;
  assets: ManualPromptAsset[];
  rules: ManualPromptRule[];
  previousCanonShotNumber?: number | null;
};

function assetLabel(kind: ManualPromptAsset["kind"]) {
  if (kind === "character") return "CHARACTER";
  if (kind === "location") return "LOCATION";
  if (kind === "wardrobe") return "WARDROBE";
  return "PROP";
}

export function buildManualGenerationPrompt({
  project,
  shot,
  assets,
  rules,
  previousCanonShotNumber,
}: BuildManualGenerationPromptInput) {
  const assetLines = assets.length
    ? assets.map((asset) => `- ${assetLabel(asset.kind)} — ${asset.name}${asset.description ? `: ${asset.description}` : ""}`)
    : ["- No recurring visual assets linked to this shot."];

  const ruleLines = rules.length
    ? rules.map((rule, index) => `${index + 1}. ${rule.description}`)
    : ["1. Preserve established continuity from the supplied references."];

  const previousCanonInstruction = previousCanonShotNumber
    ? `A canon frame from Shot ${String(previousCanonShotNumber).padStart(2, "0")} may also be attached. Use it only as continuity evidence for identity, wardrobe, lighting, spatial relationships, and established visual details. Do not copy its composition unless the current shot asks for it.`
    : "There is no previous canon shot frame attached for this shot.";

  return [
    "Create one cinematic still for the following film shot.",
    "",
    `PROJECT: ${project.title}`,
    `SHOT: ${String(shot.shot_number).padStart(2, "0")} — ${shot.title}`,
    `OUTPUT: vertical ${project.aspect_ratio || "9:16"}, one image only`,
    `VISUAL STYLE: ${project.visual_style || "cinematic photorealism"}`,
    `CAMERA: ${shot.camera || "match the established shot plan"}`,
    `TIME: ${shot.time_of_day || "match the established timeline"}`,
    `ACTION: ${shot.action || "follow the established shot action"}`,
    "",
    "CANON VISUAL REFERENCES",
    "Use the attached reference images as authoritative continuity references. Preserve the same identity, face, hair, wardrobe, props, location design, and recurring visual details unless the current shot explicitly requires a change.",
    ...assetLines,
    "",
    "PREVIOUS CANON FRAME",
    previousCanonInstruction,
    "",
    "ACTIVE CONTINUITY RULES",
    ...ruleLines,
    "",
    "GENERATION REQUIREMENTS",
    "- Keep recurring character identity and facial structure consistent with the canon character reference.",
    "- Keep wardrobe, phone, props, furniture, room layout, and other established objects consistent with their references.",
    "- Follow the current shot's camera size, action, and time of day even if a reference image uses a different framing.",
    "- Do not introduce new people, props, text, subtitles, logos, captions, borders, or collage layouts unless the shot explicitly calls for them.",
    "- Keep anatomy natural and physically plausible.",
    "- Return a single finished frame, not a storyboard sheet.",
  ].join("\n");
}

export function buildReferenceChecklist(
  assets: ManualPromptAsset[],
  previousCanonShotNumber?: number | null,
) {
  const labels = assets.map((asset) => `${asset.name} (${assetLabel(asset.kind).toLowerCase()})`);
  if (previousCanonShotNumber) {
    labels.push(`Previous canon frame — Shot ${String(previousCanonShotNumber).padStart(2, "0")}`);
  }
  return labels;
}
