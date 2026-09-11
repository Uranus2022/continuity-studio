"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { prepareManualVideoPackage } from "@/lib/manual-video-package";
import type { ShotVideoTake } from "@/lib/video-takes";

export type VideoUploadMetadata = {
  targetDurationSeconds: number;
  motionIntensity: string;
  cameraMotion: string;
  directorAdjustment: string;
  promptPackage: string;
};

type VideoWorkflowPanelProps = {
  shotNumber: number;
  ready: boolean;
  hasCanonFrame: boolean;
  hasPreviousCanonVideo: boolean;
  takes: ShotVideoTake[];
  uploading: boolean;
  busyTakeId: string | null;
  onUpload: (file: File, metadata: VideoUploadMetadata) => Promise<void>;
  onApprove: (take: ShotVideoTake) => Promise<void>;
  onCanon: (take: ShotVideoTake) => Promise<void>;
  onDelete: (take: ShotVideoTake) => Promise<void>;
};

export function VideoWorkflowPanel({
  shotNumber,
  ready,
  hasCanonFrame,
  hasPreviousCanonVideo,
  takes,
  uploading,
  busyTakeId,
  onUpload,
  onApprove,
  onCanon,
  onDelete,
}: VideoWorkflowPanelProps) {
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(5);
  const [motionIntensity, setMotionIntensity] = useState("minimal");
  const [cameraMotion, setCameraMotion] = useState("locked camera");
  const [directorAdjustment, setDirectorAdjustment] = useState("");
  const [working, setWorking] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [promptPreview, setPromptPreview] = useState("");
  const [referenceLabels, setReferenceLabels] = useState<string[]>([]);
  const [localError, setLocalError] = useState("");

  const canonTake = useMemo(() => takes.find((take) => take.is_canon) ?? null, [takes]);

  async function copyVideoPackage() {
    setWorking(true);
    setLocalError("");
    setCopyState("idle");

    try {
      const result = await prepareManualVideoPackage(shotNumber, {
        targetDurationSeconds,
        motionIntensity,
        cameraMotion,
        directorAdjustment,
      });
      setPromptPreview(result.prompt);
      setReferenceLabels(result.referenceLabels);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Unable to prepare the video package.");
      setCopyState("failed");
    } finally {
      setWorking(false);
    }
  }

  function openChatGPT() {
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  function chooseVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    void onUpload(file, {
      targetDurationSeconds,
      motionIntensity,
      cameraMotion,
      directorAdjustment: directorAdjustment.trim(),
      promptPackage: promptPreview,
    });
  }

  return (
    <section className="video-workflow-card">
      <div className="video-workflow-header">
        <div>
          <span className="eyebrow">NO-API VIDEO · SHOT {String(shotNumber).padStart(2, "0")}</span>
          <strong>Animate the canon frame</strong>
          <p>
            Build a continuity-safe video prompt, generate the clip in any video tool you already use, then upload the take here for approval and canon locking.
          </p>
        </div>
        <div className="video-no-api-pill">NO API · $0</div>
      </div>

      <div className="video-meta-row">
        <span className={hasCanonFrame ? "ready" : "warn"}>{hasCanonFrame ? "Canon frame ready" : "Canon frame required"}</span>
        <span>{hasPreviousCanonVideo ? "Previous canon video available" : "No previous canon video"}</span>
        <span>Vertical 9:16</span>
        {canonTake ? <span className="ready">Video canon locked</span> : <span>No video canon yet</span>}
      </div>

      <div className="video-settings-grid">
        <label>
          <span>Duration</span>
          <select value={targetDurationSeconds} onChange={(event) => setTargetDurationSeconds(Number(event.target.value))} disabled={working || uploading}>
            <option value={3}>3 seconds</option>
            <option value={5}>5 seconds</option>
            <option value={8}>8 seconds</option>
          </select>
        </label>
        <label>
          <span>Motion intensity</span>
          <select value={motionIntensity} onChange={(event) => setMotionIntensity(event.target.value)} disabled={working || uploading}>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
          </select>
        </label>
        <label>
          <span>Camera motion</span>
          <select value={cameraMotion} onChange={(event) => setCameraMotion(event.target.value)} disabled={working || uploading}>
            <option value="locked camera">Locked camera</option>
            <option value="extremely subtle push-in">Subtle push-in</option>
            <option value="slow controlled pan">Slow pan</option>
            <option value="restrained handheld drift">Subtle handheld</option>
          </select>
        </label>
      </div>

      <label className="video-director-field">
        <span>Director adjustment <small>optional</small></span>
        <textarea
          value={directorAdjustment}
          onChange={(event) => setDirectorAdjustment(event.target.value)}
          placeholder="Example: only a tiny breath, one glance at the phone, and a nearly imperceptible push-in."
          disabled={working || uploading}
        />
      </label>

      {referenceLabels.length ? (
        <div className="video-reference-checklist">
          <span>Use these references</span>
          <div>{referenceLabels.map((label) => <i key={label}>{label}</i>)}</div>
        </div>
      ) : null}

      {promptPreview ? (
        <details className="video-prompt-preview">
          <summary>Preview copied video prompt</summary>
          <pre>{promptPreview}</pre>
        </details>
      ) : null}

      <div className="video-package-actions">
        <button className="video-copy-button" disabled={!ready || working} onClick={() => void copyVideoPackage()}>
          {working ? "Preparing…" : copyState === "copied" ? "✓ Video prompt copied" : copyState === "failed" ? "Try again" : "Copy video prompt package"}
        </button>
        <button className="open-chatgpt-button" disabled={!ready} onClick={openChatGPT}>
          Open ChatGPT ↗
        </button>
        <label className={`video-upload-button ${!hasCanonFrame || uploading ? "disabled" : ""}`}>
          {uploading ? "Uploading take…" : "＋ Upload video take"}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            disabled={!hasCanonFrame || uploading}
            onChange={chooseVideo}
          />
        </label>
      </div>

      {!hasCanonFrame ? <p className="video-warning">Make the shot's final frame canon before creating video takes.</p> : null}
      {!ready && hasCanonFrame ? <p className="video-warning">Finish the linked Story Bible references before preparing the video prompt.</p> : null}
      {localError ? <p className="video-warning">{localError}</p> : null}

      <div className="video-history-heading">
        <div>
          <span className="eyebrow">VIDEO HISTORY</span>
          <strong>{takes.length} take{takes.length === 1 ? "" : "s"}</strong>
        </div>
        <small>MP4 · MOV · WebM · max 50 MB</small>
      </div>

      {!takes.length ? (
        <div className="video-empty-state">
          <span>▶</span>
          <strong>No video takes yet</strong>
          <small>Generate externally, then upload the first take here.</small>
        </div>
      ) : (
        <div className="video-take-grid">
          {takes.map((take, index) => {
            const busy = busyTakeId === take.id;
            return (
              <article className={`video-take-card ${take.is_canon ? "is-canon" : take.is_approved ? "is-approved" : ""}`} key={take.id}>
                <div className="video-preview-wrap">
                  {take.signed_url ? (
                    <video src={take.signed_url} controls playsInline preload="metadata" />
                  ) : (
                    <div className="video-no-preview">Preview unavailable</div>
                  )}
                  <div className="video-take-badges">
                    {take.is_canon ? <span className="video-badge canon">CANON</span> : null}
                    {!take.is_canon && take.is_approved ? <span className="video-badge approved">APPROVED</span> : null}
                  </div>
                </div>
                <div className="video-take-meta">
                  <div>
                    <strong>Take {takes.length - index}</strong>
                    <small>{take.target_duration_seconds ? `${take.target_duration_seconds}s target · ` : ""}{take.motion_intensity ?? "motion not set"}</small>
                  </div>
                  <small>{new Date(take.created_at).toLocaleString()}</small>
                </div>
                <div className="video-take-actions">
                  <button disabled={busy || take.is_approved || take.is_canon} onClick={() => void onApprove(take)}>
                    {busy ? "…" : take.is_approved ? "Approved" : "Approve"}
                  </button>
                  <button className="canon" disabled={busy || take.is_canon} onClick={() => void onCanon(take)}>
                    {busy ? "…" : take.is_canon ? "◆ Canon" : "Make Canon"}
                  </button>
                  <button className="delete" disabled={busy} onClick={() => void onDelete(take)}>
                    {busy ? "…" : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
