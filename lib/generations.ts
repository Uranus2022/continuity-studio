import { supabase } from "@/lib/supabase";

export type GenerationQuality = "low" | "medium" | "high";

export type GenerateShotImageResult = {
  ok: true;
  generationId: string;
  shotFrameId: string;
  model: string;
  quality: GenerationQuality;
  size: string;
  referenceCount: number;
  prompt: string;
  durationMs: number;
};

function errorMessageFromFunction(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Image generation failed.";
}

export async function generateShotImage(input: {
  shotId: string;
  directorNote?: string;
  quality?: GenerationQuality;
}): Promise<GenerateShotImageResult> {
  const { data, error } = await supabase.functions.invoke("generate-shot-image", {
    body: {
      shotId: input.shotId,
      directorNote: input.directorNote ?? "",
      quality: input.quality ?? "medium",
    },
  });

  if (error) {
    let message = errorMessageFromFunction(error);
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) message = payload.error;
      } catch {
        // Keep the original invocation error.
      }
    }
    throw new Error(message);
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? "Image generation failed.");
  }

  return data as GenerateShotImageResult;
}
