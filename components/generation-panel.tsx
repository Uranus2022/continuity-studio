"use client";

import { useMemo, useState } from "react";
import type { GenerationQuality } from "@/lib/generations";
import { prepareManualGenerationPackage } from "@/lib/manual-generation-package";

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
  referenceCount,
  hasPreviousCanon,
}: GenerationPanelProps) {
  const [directorNote, setDirectorNote] = useState("");
  const [working, setWorking] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [referenceLabels, setReferenceLabels] = useState<string[]>([]);
  const [promptPreview, setPromptPreview] = useState("");
  const [localError, setLocalError] = useState("");

  const continuityLabel = useMemo(() => {
    const total = referenceCount + (hasPreviousCanon ? 1 : 0);
    if (!total) return "No visual references";
    return `${total} visual reference${total === 1 ? "" : "s"}`;
  }, [referenceCount, hasPreviousCanon]);

  async function preparePrompt() {
    setWorking(true);
    setLocalError("");
    setCopyState("idle");

    try {
      const result = await prepareManualGenerationPackage(shotNumber, directorNote);
      setPromptPreview(result.prompt);
      setReferenceLabels(result.referenceLabels);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Unable to prepare the prompt package.");
      setCopyState("failed");
    } finally {
      setWorking(false);
    }
  }

  function openChatGPT() {
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <section className="generation-card no-api-card">
      <div className="generation-header">
        <div>
          <span className="eyebrow">NO-API GENERATION · SHOT {String(shotNumber).padStart(2, "0")}</span>
          <strong>Prepare continuity package</strong>
          <p>
            Continuity Studio builds and copies the shot prompt from your canon Story Bible and continuity rules. Generate in ChatGPT, then upload the result into Visual History.
          </p>
        </div>
        <div className="generation-model-pill no-api-pill">NO API · $0</div>
      </div>

      <div className="generation-meta-row">
        <span>{continuityLabel}</span>
        <span>9:16 target</span>
        <span>{hasPreviousCanon ? "Previous canon available" : "No previous canon"}</span>
        <span>{ready ? "Continuity ready" : "References incomplete"}</span>
      </div>

      <div className="manual-workflow">
        <div><b>1</b><span>Click Copy prompt package.</span></div>
        <div><b>2</b><span>Open ChatGPT and attach the canon references listed below.</span></div>
        <div><b>3</b><span>Generate one frame, save it, then use Upload frame below.</span></div>
      </div>

      <label className="generation-note-field">
        <span>Director adjustment <small>optional</small></span>
        <textarea
          value={directorNote}
          onChange={(event) => setDirectorNote(event.target.value)}
          placeholder="Example: keep the camera slightly lower and make her expression more restrained."
          disabled={working}
        />
      </label>

      {referenceLabels.length ? (
        <div className="reference-checklist">
          <span className="generation-field-label">Attach these references</span>
          <div className="reference-chip-row">
            {referenceLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
        </div>
      ) : null}

      {promptPreview ? (
        <details className="prompt-preview">
          <summary>Preview copied prompt</summary>
          <pre>{promptPreview}</pre>
        </details>
      ) : null}

      <div className="manual-generation-actions">
        <button className="copy-prompt-button" disabled={!ready || working} onClick={() => void preparePrompt()}>
          {working ? "Preparing…" : copyState === "copied" ? "✓ Prompt copied" : copyState === "failed" ? "Try again" : "Copy prompt package"}
        </button>
        <button className="open-chatgpt-button" disabled={!ready} onClick={openChatGPT}>
          Open ChatGPT ↗
        </button>
      </div>

      {!ready ? (
        <p className="generation-warning">Attach and canon-lock the linked Story Bible references before preparing this shot.</p>
      ) : (
        <p className="manual-generation-note">No API key, API credits, or paid API account is required.</p>
      )}
      {localError ? <p className="generation-warning">{localError}</p> : null}
    </section>
  );
}
