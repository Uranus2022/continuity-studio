"use client";

import { useMemo, useState } from "react";
import type { GenerationQuality } from "@/lib/generations";

type GenerationPanelProps = {
  shotNumber: number;
  ready: boolean;
  generating: boolean;
  referenceCount: number;
  hasPreviousCanon: boolean;
  onGenerate: (directorNote: string, quality: GenerationQuality) => Promise<void>;
};

export function GenerationPanel({
  shotNumber,
  ready,
  generating,
  referenceCount,
  hasPreviousCanon,
  onGenerate,
}: GenerationPanelProps) {
  const [directorNote, setDirectorNote] = useState("");
  const [quality, setQuality] = useState<GenerationQuality>("medium");

  const continuityLabel = useMemo(() => {
    const total = referenceCount + (hasPreviousCanon ? 1 : 0);
    if (!total) return "No visual references";
    return `${total} visual reference${total === 1 ? "" : "s"}`;
  }, [referenceCount, hasPreviousCanon]);

  return (
    <section className="generation-card">
      <div className="generation-header">
        <div>
          <span className="eyebrow">AI GENERATION · SHOT {String(shotNumber).padStart(2, "0")}</span>
          <strong>Generate continuity frame</strong>
          <p>
            GPT-Image-2.5 Flare receives the canon assets for this shot
            {hasPreviousCanon ? " plus the previous canon frame" : ""}.
          </p>
        </div>
        <div className="generation-model-pill">GPT-Image-2.5 Flare</div>
      </div>

      <div className="generation-meta-row">
        <span>{continuityLabel}</span>
        <span>9:16 output</span>
        <span>{ready ? "Continuity ready" : "References incomplete"}</span>
      </div>

      <label className="generation-note-field">
        <span>Director adjustment <small>optional</small></span>
        <textarea
          value={directorNote}
          onChange={(event) => setDirectorNote(event.target.value)}
          placeholder="Example: keep the camera slightly lower and make her expression more restrained."
          disabled={generating}
        />
      </label>

      <div className="generation-actions">
        <label className="generation-quality">
          <span>Quality</span>
          <select
            value={quality}
            onChange={(event) => setQuality(event.target.value as GenerationQuality)}
            disabled={generating}
          >
            <option value="low">Low · draft</option>
            <option value="medium">Medium · default</option>
            <option value="high">High · final candidate</option>
          </select>
        </label>

        <button
          className="generate-frame-button"
          disabled={!ready || generating}
          onClick={() => void onGenerate(directorNote.trim(), quality)}
        >
          {generating ? "Generating frame…" : "✦ Generate frame"}
        </button>
      </div>

      {!ready ? (
        <p className="generation-warning">Lock the linked Story Bible assets as canon and attach their references before generating.</p>
      ) : null}
    </section>
  );
}
