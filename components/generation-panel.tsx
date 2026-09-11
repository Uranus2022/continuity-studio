"use client";

import { useMemo, useState } from "react";

type GenerationPanelProps = {
  shotNumber: number;
  ready: boolean;
  prompt: string;
  referenceLabels: string[];
  hasPreviousCanon: boolean;
};

export function GenerationPanel({
  shotNumber,
  ready,
  prompt,
  referenceLabels,
  hasPreviousCanon,
}: GenerationPanelProps) {
  const [directorNote, setDirectorNote] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const finalPrompt = useMemo(() => {
    const note = directorNote.trim();
    if (!note) return prompt;
    return `${prompt}\n\nDIRECTOR ADJUSTMENT\n${note}`;
  }, [directorNote, prompt]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(finalPrompt);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
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
            Continuity Studio builds the prompt and reference checklist here. Generate the image in ChatGPT, then upload the result into Visual History below.
          </p>
        </div>
        <div className="generation-model-pill no-api-pill">NO API · $0</div>
      </div>

      <div className="generation-meta-row">
        <span>{referenceLabels.length} reference{referenceLabels.length === 1 ? "" : "s"}</span>
        <span>9:16 target</span>
        <span>{hasPreviousCanon ? "Previous canon included" : "No previous canon"}</span>
        <span>{ready ? "Continuity ready" : "References incomplete"}</span>
      </div>

      <div className="manual-workflow">
        <div><b>1</b><span>Copy the continuity prompt.</span></div>
        <div><b>2</b><span>Open ChatGPT and attach the listed canon references.</span></div>
        <div><b>3</b><span>Generate one frame, save it, then use Upload frame below.</span></div>
      </div>

      <div className="reference-checklist">
        <span className="generation-field-label">Attach these references</span>
        <div className="reference-chip-row">
          {referenceLabels.length ? referenceLabels.map((label) => <span key={label}>{label}</span>) : <em>No references linked yet.</em>}
        </div>
      </div>

      <label className="generation-note-field">
        <span>Director adjustment <small>optional</small></span>
        <textarea
          value={directorNote}
          onChange={(event) => setDirectorNote(event.target.value)}
          placeholder="Example: keep the camera slightly lower and make her expression more restrained."
        />
      </label>

      <details className="prompt-preview">
        <summary>Preview generated prompt</summary>
        <pre>{finalPrompt}</pre>
      </details>

      <div className="manual-generation-actions">
        <button className="copy-prompt-button" disabled={!ready} onClick={() => void copyPrompt()}>
          {copyState === "copied" ? "✓ Prompt copied" : copyState === "failed" ? "Copy failed" : "Copy prompt"}
        </button>
        <button className="open-chatgpt-button" disabled={!ready} onClick={openChatGPT}>
          Open ChatGPT ↗
        </button>
      </div>

      {!ready ? (
        <p className="generation-warning">Attach and canon-lock the linked Story Bible references before preparing this shot.</p>
      ) : (
        <p className="manual-generation-note">No API key, credits, or paid API account is required for this workflow.</p>
      )}
    </section>
  );
}
