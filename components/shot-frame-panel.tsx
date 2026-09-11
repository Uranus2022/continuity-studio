"use client";

import type { ChangeEvent } from "react";
import type { ShotFrame } from "@/lib/shot-frames";

type ShotFramePanelProps = {
  shotNumber: number;
  frames: ShotFrame[];
  uploading: boolean;
  deletingFrameId: string | null;
  updatingFrameId: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: (frame: ShotFrame) => Promise<void>;
  onApprove: (frame: ShotFrame) => Promise<void>;
  onCanon: (frame: ShotFrame) => Promise<void>;
};

export function ShotFramePanel({
  shotNumber,
  frames,
  uploading,
  deletingFrameId,
  updatingFrameId,
  onUpload,
  onDelete,
  onApprove,
  onCanon,
}: ShotFramePanelProps) {
  function chooseFrame(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (file) void onUpload(file);
  }

  return (
    <section className="shot-frames-card">
      <div className="shot-frames-header">
        <div>
          <span className="eyebrow">SHOT {String(shotNumber).padStart(2, "0")} FRAMES</span>
          <strong>Visual history</strong>
          <p>Keep alternate renders here, approve the best candidate, then lock the final continuity frame as canon.</p>
        </div>
        <label className="shot-frame-upload-button">
          {uploading ? "Uploading…" : "＋ Upload frame"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={chooseFrame}
          />
        </label>
      </div>

      {!frames.length ? (
        <div className="shot-frames-empty">
          <span>▧</span>
          <strong>No frames yet</strong>
          <small>Upload the first rendered or reference frame for this shot.</small>
        </div>
      ) : (
        <div className="shot-frame-grid">
          {frames.map((frame, index) => {
            const busy = deletingFrameId === frame.id || updatingFrameId === frame.id;
            return (
              <article className={`shot-frame-item ${frame.is_canon ? "is-canon" : frame.is_approved ? "is-approved" : ""}`} key={frame.id}>
                <div className="shot-frame-image-wrap">
                  {frame.signed_url ? (
                    <img src={frame.signed_url} alt={frame.file_name || `Shot ${shotNumber} frame`} />
                  ) : (
                    <div className="shot-frame-no-preview">Preview unavailable</div>
                  )}
                  <div className="shot-frame-badges">
                    {frame.is_canon ? <span className="frame-badge canon">CANON</span> : null}
                    {!frame.is_canon && frame.is_approved ? <span className="frame-badge approved">APPROVED</span> : null}
                  </div>
                </div>

                <div className="shot-frame-meta">
                  <div>
                    <strong>{frame.label || `Frame ${frames.length - index}`}</strong>
                    <small>{new Date(frame.created_at).toLocaleString()}</small>
                  </div>
                </div>

                <div className="shot-frame-actions">
                  <button
                    className={`shot-frame-action approve ${frame.is_approved ? "active" : ""}`}
                    disabled={busy || frame.is_approved || frame.is_canon}
                    onClick={() => void onApprove(frame)}
                  >
                    {updatingFrameId === frame.id ? "…" : frame.is_approved ? "Approved" : "Approve"}
                  </button>
                  <button
                    className={`shot-frame-action canon ${frame.is_canon ? "active" : ""}`}
                    disabled={busy || frame.is_canon}
                    onClick={() => void onCanon(frame)}
                  >
                    {updatingFrameId === frame.id ? "…" : frame.is_canon ? "◆ Canon" : "Make Canon"}
                  </button>
                  <button
                    className="shot-frame-delete"
                    disabled={busy}
                    onClick={() => void onDelete(frame)}
                    title="Delete frame"
                  >
                    {deletingFrameId === frame.id ? "…" : "Delete"}
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
