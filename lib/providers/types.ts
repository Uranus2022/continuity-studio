export type GenerationRequest = {
  shotId: string;
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio: string;
};

export type GenerationResult = {
  provider: string;
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  outputUrl?: string;
};

export interface GenerationProvider {
  generateImage(request: GenerationRequest): Promise<GenerationResult>;
  generateVideo(request: GenerationRequest): Promise<GenerationResult>;
}
