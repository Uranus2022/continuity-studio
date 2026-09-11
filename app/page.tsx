"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ShotFramePanel } from "@/components/shot-frame-panel";
import {
  approveShotFrame as approveShotFrameRecord,
  canonShotFrame as canonShotFrameRecord,
  deleteShotFrame as deleteShotFrameRecord,
  listShotFrames,
  uploadShotFrame as uploadShotFrameFile,
  type ShotFrame,
} from "@/lib/shot-frames";
import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  title: string;
  aspect_ratio: string;
  visual_style: string | null;
};

type Asset = {
  id: string;
  kind: "character" | "location" | "prop" | "wardrobe";
  name: string;
  description: string | null;
  lock_state: "draft" | "canon";
  reference_image_url: string | null;
};

type Shot = {
  id: string;
  project_id: string;
  shot_number: number;
  title: string;
  camera: string | null;
  action: string | null;
  time_of_day: string | null;
  status: "planned" | "draft" | "approved" | "canon";
};

type Rule = {
  id: string;
  description: string;
  start_shot: number | null;
  end_shot: number | null;
};

type ShotAsset = {
  shot_id: string;
  asset_id: string;
  role: string | null;
};

const STORAGE_BUCKET = "canon-references";
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_REFERENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const Icon = ({ children }: { children: ReactNode }) => <span className="icon">{children}</span>;

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [error, setError] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [shotAssets, setShotAssets] = useState<ShotAsset[]>([]);
  const [shotFrames, setShotFrames] = useState<ShotFrame[]>([]);
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<Record<string, string>>({});
  const [selectedNumber, setSelectedNumber] = useState(3);
  const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);
  const [lockingAssetId, setLockingAssetId] = useState<string | null>(null);
  const [uploadingShotFrame, setUploadingShotFrame] = useState(false);
  const [deletingShotFrameId, setDeletingShotFrameId] = useState<string | null>(null);
  const [updatingShotFrameId, setUpdatingShotFrameId] = useState<string | null>(null);

  async function refreshAssetPreviews(nextAssets: Asset[]) {
    const entries = await Promise.all(
      nextAssets.map(async (asset) => {
        if (!asset.reference_image_url) return null;
        const { data, error: signedUrlError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(asset.reference_image_url, 60 * 60);
        if (signedUrlError || !data?.signedUrl) return null;
        return [asset.id, data.signedUrl] as const;
      }),
    );

    setAssetPreviewUrls(
      Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))),
    );
  }

  async function refreshShotWorkflow(shotId: string) {
    const [frames, shotResult] = await Promise.all([
      listShotFrames([shotId]),
      supabase.from("shots").select("status").eq("id", shotId).single(),
    ]);

    if (shotResult.error) throw shotResult.error;

    setShotFrames((current) => [
      ...frames,
      ...current.filter((frame) => frame.shot_id !== shotId),
    ]);
    setShots((current) =>
      current.map((shot) =>
        shot.id === shotId ? { ...shot, status: shotResult.data.status as Shot["status"] } : shot,
      ),
    );
  }

  async function loadWorkspace() {
    setLoadingWorkspace(true);
    setError("");

    try {
      const { data: projectId, error: bootstrapError } = await supabase.rpc("bootstrap_demo_project");
      if (bootstrapError) throw bootstrapError;
      if (!projectId) throw new Error("Could not initialize the demo project.");

      const [projectResult, shotResult, assetResult, ruleResult] = await Promise.all([
        supabase.from("projects").select("id,title,aspect_ratio,visual_style").eq("id", projectId).single(),
        supabase
          .from("shots")
          .select("id,project_id,shot_number,title,camera,action,time_of_day,status")
          .eq("project_id", projectId)
          .order("shot_number"),
        supabase
          .from("assets")
          .select("id,kind,name,description,lock_state,reference_image_url")
          .eq("project_id", projectId)
          .order("kind")
          .order("name"),
        supabase
          .from("continuity_rules")
          .select("id,description,start_shot,end_shot")
          .eq("project_id", projectId)
          .order("created_at"),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (shotResult.error) throw shotResult.error;
      if (assetResult.error) throw assetResult.error;
      if (ruleResult.error) throw ruleResult.error;

      const nextShots = (shotResult.data ?? []) as Shot[];
      const nextAssets = (assetResult.data ?? []) as Asset[];
      const shotIds = nextShots.map((shot) => shot.id);
      let links: ShotAsset[] = [];
      let frames: ShotFrame[] = [];

      if (shotIds.length) {
        const [linkResult, frameResult] = await Promise.all([
          supabase
            .from("shot_assets")
            .select("shot_id,asset_id,role")
            .in("shot_id", shotIds),
          listShotFrames(shotIds),
        ]);
        if (linkResult.error) throw linkResult.error;
        links = (linkResult.data ?? []) as ShotAsset[];
        frames = frameResult;
      }

      setProject(projectResult.data as Project);
      setShots(nextShots);
      setAssets(nextAssets);
      setRules((ruleResult.data ?? []) as Rule[]);
      setShotAssets(links);
      setShotFrames(frames);
      await refreshAssetPreviews(nextAssets);

      if (!nextShots.some((shot) => shot.shot_number === selectedNumber)) {
        setSelectedNumber(nextShots[0]?.shot_number ?? 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load workspace.");
    } finally {
      setLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setBooting(false);
      if (data.session) void loadWorkspace();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (nextSession) {
        void loadWorkspace();
      } else {
        setProject(null);
        setShots([]);
        setAssets([]);
        setRules([]);
        setShotAssets([]);
        setShotFrames([]);
        setAssetPreviewUrls({});
      }
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
    // loadWorkspace intentionally runs when auth state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => shots.find((shot) => shot.shot_number === selectedNumber) ?? shots[0],
    [shots, selectedNumber],
  );

  const selectedFrames = useMemo(
    () => (selected ? shotFrames.filter((frame) => frame.shot_id === selected.id) : []),
    [selected, shotFrames],
  );

  const heroFrame = useMemo(
    () => selectedFrames.find((frame) => frame.is_canon) ?? selectedFrames.find((frame) => frame.is_approved) ?? selectedFrames[0],
    [selectedFrames],
  );

  const primaryFrameByShotId = useMemo(() => {
    const grouped = new Map<string, ShotFrame[]>();
    for (const frame of shotFrames) {
      grouped.set(frame.shot_id, [...(grouped.get(frame.shot_id) ?? []), frame]);
    }

    const result = new Map<string, ShotFrame>();
    for (const [shotId, frames] of grouped) {
      const primary =
        frames.find((frame) => frame.is_canon) ??
        frames.find((frame) => frame.is_approved) ??
        [...frames].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
      if (primary) result.set(shotId, primary);
    }
    return result;
  }, [shotFrames]);

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedAssets = useMemo(() => {
    if (!selected) return [];
    return shotAssets
      .filter((link) => link.shot_id === selected.id)
      .map((link) => assetById.get(link.asset_id))
      .filter((asset): asset is Asset => Boolean(asset));
  }, [selected, shotAssets, assetById]);

  const missingReferences = selectedAssets.filter((asset) => !asset.reference_image_url);
  const unlockedAssets = selectedAssets.filter((asset) => asset.lock_state !== "canon");
  const continuityReady = selectedAssets.length > 0 && missingReferences.length === 0 && unlockedAssets.length === 0;

  const characters = assets.filter((asset) => asset.kind === "character");
  const locations = assets.filter((asset) => asset.kind === "location");
  const wardrobe = assets.filter((asset) => asset.kind === "wardrobe");
  const props = assets.filter((asset) => asset.kind === "prop");
  const activeRules = selected
    ? rules.filter(
        (rule) =>
          rule.start_shot == null ||
          rule.end_shot == null ||
          (selected.shot_number >= rule.start_shot && selected.shot_number <= rule.end_shot),
      )
    : [];

  async function uploadReference(asset: Asset, file: File) {
    if (!session || !project) return;
    setError("");

    if (!ALLOWED_REFERENCE_TYPES.has(file.type)) {
      setError("Reference images must be JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_REFERENCE_BYTES) {
      setError("Reference images must be 10 MB or smaller.");
      return;
    }

    setUploadingAssetId(asset.id);

    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${session.user.id}/${project.id}/${asset.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("assets")
        .update({ reference_image_url: path })
        .eq("id", asset.id);

      if (updateError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
        throw updateError;
      }

      if (asset.reference_image_url) {
        await supabase.storage.from(STORAGE_BUCKET).remove([asset.reference_image_url]);
      }

      const updatedAsset = { ...asset, reference_image_url: path };
      setAssets((current) => current.map((item) => (item.id === asset.id ? updatedAsset : item)));

      const { data: signedData } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 60);
      if (signedData?.signedUrl) {
        setAssetPreviewUrls((current) => ({ ...current, [asset.id]: signedData.signedUrl }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload reference image.");
    } finally {
      setUploadingAssetId(null);
    }
  }

  async function lockAssetAsCanon(asset: Asset) {
    if (asset.lock_state === "canon") return;
    setLockingAssetId(asset.id);
    setError("");

    const { error: updateError } = await supabase
      .from("assets")
      .update({ lock_state: "canon" })
      .eq("id", asset.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setAssets((current) =>
        current.map((item) => (item.id === asset.id ? { ...item, lock_state: "canon" } : item)),
      );
    }
    setLockingAssetId(null);
  }

  async function handleShotFrameUpload(file: File) {
    if (!session || !project || !selected) return;
    setUploadingShotFrame(true);
    setError("");

    try {
      await uploadShotFrameFile({
        file,
        userId: session.user.id,
        projectId: project.id,
        shotId: selected.id,
      });
      await refreshShotWorkflow(selected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload shot frame.");
    } finally {
      setUploadingShotFrame(false);
    }
  }

  async function handleShotFrameApprove(frame: ShotFrame) {
    setUpdatingShotFrameId(frame.id);
    setError("");
    try {
      await approveShotFrameRecord(frame.id);
      await refreshShotWorkflow(frame.shot_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to approve shot frame.");
    } finally {
      setUpdatingShotFrameId(null);
    }
  }

  async function handleShotFrameCanon(frame: ShotFrame) {
    setUpdatingShotFrameId(frame.id);
    setError("");
    try {
      await canonShotFrameRecord(frame.id);
      await refreshShotWorkflow(frame.shot_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to make shot frame canon.");
    } finally {
      setUpdatingShotFrameId(null);
    }
  }

  async function handleShotFrameDelete(frame: ShotFrame) {
    setDeletingShotFrameId(frame.id);
    setError("");

    try {
      await deleteShotFrameRecord(frame);
      await refreshShotWorkflow(frame.shot_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete shot frame.");
    } finally {
      setDeletingShotFrameId(null);
    }
  }

  if (booting) {
    return <LoadingScreen label="Connecting to Continuity Studio…" />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (loadingWorkspace && !project) {
    return <LoadingScreen label="Building your film workspace…" />;
  }

  if (!project || !selected) {
    return (
      <main style={{ minHeight: "100vh", padding: 40, background: "#0d0f14", color: "white" }}>
        <h1>Continuity Studio</h1>
        <p>{error || "Workspace is not available yet."}</p>
        <button className="primary-button" onClick={() => void loadWorkspace()}>Retry</button>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>Continuity Studio</strong>
            <span>AI filmmaking workspace</span>
          </div>
        </div>

        <div className="project-chip">
          <span className="eyebrow">PROJECT</span>
          <strong>{project.title}</strong>
          <small>Vertical {project.aspect_ratio} · {project.visual_style ?? "Visual style"}</small>
        </div>

        <nav className="nav-list" aria-label="Workspace sections">
          <button className="nav-item active"><Icon>◫</Icon>Shots <span>{shots.length}</span></button>
          <button className="nav-item"><Icon>●</Icon>Characters <span>{characters.length}</span></button>
          <button className="nav-item"><Icon>⌂</Icon>Locations <span>{locations.length}</span></button>
          <button className="nav-item"><Icon>◇</Icon>Props <span>{props.length + wardrobe.length}</span></button>
          <button className="nav-item"><Icon>✓</Icon>Continuity <span>{rules.length}</span></button>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" /> Supabase connected
          <small>{session.user.email ?? "Authenticated user"}</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">FILM WORKSPACE</span>
            <h1>{project.title}</h1>
          </div>
          <div className="top-actions">
            <button className="ghost-button" onClick={() => void supabase.auth.signOut()}>Sign out</button>
            <button className="ghost-button">Import Script</button>
            <button className="primary-button">＋ New Shot</button>
          </div>
        </header>

        {error ? <p className="workspace-error">{error}</p> : null}

        <div className="workspace-grid">
          <section className="shot-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SHOT {String(selected.shot_number).padStart(2, "0")}</span>
                <h2>{selected.title}</h2>
              </div>
              <span className={`badge ${selected.status}`}>{selected.status}</span>
            </div>

            <div className="frame-stage">
              <div className={`safe-frame ${heroFrame?.signed_url ? "has-shot-frame" : ""}`}>
                {heroFrame?.signed_url ? (
                  <img className="safe-frame-image" src={heroFrame.signed_url} alt={`Shot ${selected.shot_number} frame`} />
                ) : null}
                <div className="frame-glow" />
                <div className="frame-copy">
                  <span>{project.aspect_ratio} FRAME</span>
                  <strong>{selected.camera ?? "Camera not set"}</strong>
                  <p>{selected.action ?? "Action not set"}</p>
                </div>
              </div>
            </div>

            <ShotFramePanel
              shotNumber={selected.shot_number}
              frames={selectedFrames}
              uploading={uploadingShotFrame}
              deletingFrameId={deletingShotFrameId}
              updatingFrameId={updatingShotFrameId}
              onUpload={handleShotFrameUpload}
              onDelete={handleShotFrameDelete}
              onApprove={handleShotFrameApprove}
              onCanon={handleShotFrameCanon}
            />

            <div className="shot-fields">
              <label>
                <span>Camera</span>
                <input value={selected.camera ?? ""} readOnly />
              </label>
              <label>
                <span>Time</span>
                <input value={selected.time_of_day ?? ""} readOnly />
              </label>
              <label className="full-field">
                <span>Action</span>
                <textarea value={selected.action ?? ""} readOnly />
              </label>
            </div>

            <div className="canon-row">
              <button className="secondary-button">Preview Prompt</button>
              <span className={`shot-status-note ${selected.status}`}>
                Frame status: {selected.status}
              </span>
            </div>
          </section>

          <aside className="inspector">
            <div className="inspector-card">
              <div className="card-title">
                <span>Continuity Check</span>
                <span className={`pass-pill ${continuityReady ? "" : "warn"}`}>
                  {continuityReady ? "READY" : "NEEDS REFS"}
                </span>
              </div>
              <p className="muted">
                Recurring visual assets should have a reference image and be locked as canon before generation.
              </p>
              <div className="rule-list">
                {selectedAssets.map((item) => (
                  <div className="rule-row" key={item.id}>
                    <span className={item.reference_image_url && item.lock_state === "canon" ? "check" : "warning-mark"}>
                      {item.reference_image_url && item.lock_state === "canon" ? "✓" : "!"}
                    </span>
                    <span>{item.name}</span>
                    <small>
                      {!item.reference_image_url ? "needs ref" : item.lock_state === "canon" ? "canon ref" : "unlock"}
                    </small>
                  </div>
                ))}
                {!selectedAssets.length ? <p className="muted">No shot assets linked yet.</p> : null}
              </div>
            </div>

            <div className="inspector-card">
              <div className="card-title"><span>Story Bible</span><span>⌘</span></div>
              <p className="muted">Upload one trusted visual reference per recurring asset. References are private.</p>
              <BibleGroup title="CHARACTER" items={characters} previewUrls={assetPreviewUrls} uploadingAssetId={uploadingAssetId} lockingAssetId={lockingAssetId} onUpload={uploadReference} onLock={lockAssetAsCanon} />
              <BibleGroup title="LOCATION" items={locations} previewUrls={assetPreviewUrls} uploadingAssetId={uploadingAssetId} lockingAssetId={lockingAssetId} onUpload={uploadReference} onLock={lockAssetAsCanon} />
              <BibleGroup title="WARDROBE" items={wardrobe} previewUrls={assetPreviewUrls} uploadingAssetId={uploadingAssetId} lockingAssetId={lockingAssetId} onUpload={uploadReference} onLock={lockAssetAsCanon} />
              <BibleGroup title="PROPS" items={props} previewUrls={assetPreviewUrls} uploadingAssetId={uploadingAssetId} lockingAssetId={lockingAssetId} onUpload={uploadReference} onLock={lockAssetAsCanon} />
            </div>

            <div className="inspector-card rules-card">
              <div className="card-title"><span>Active Rules</span><span>{activeRules.length}</span></div>
              {activeRules.map((rule, index) => <p key={rule.id}><b>{String(index + 1).padStart(2, "0")}</b>{rule.description}</p>)}
            </div>
          </aside>
        </div>

        <section className="timeline-section">
          <div className="timeline-heading">
            <div><span className="eyebrow">TIMELINE</span><strong>{shots.length} shots</strong></div>
            <span className="timeline-legend">
              <i className="canon-dot" /> canon
              <i className="approved-dot" /> approved
              <i className="draft-dot" /> draft
              <i className="planned-dot" /> planned
            </span>
          </div>
          <div className="timeline">
            {shots.map((shot) => {
              const primaryFrame = primaryFrameByShotId.get(shot.id);
              return (
                <button
                  key={shot.id}
                  className={`timeline-shot ${shot.status} ${shot.shot_number === selectedNumber ? "selected" : ""}`}
                  onClick={() => setSelectedNumber(shot.shot_number)}
                >
                  <span>{String(shot.shot_number).padStart(2, "0")}</span>
                  <div className="mini-frame">
                    {primaryFrame?.signed_url ? <img src={primaryFrame.signed_url} alt="" /> : null}
                    <i />
                  </div>
                  <strong>{shot.title}</strong>
                  <small>{shot.time_of_day}</small>
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

type BibleGroupProps = {
  title: string;
  items: Asset[];
  previewUrls: Record<string, string>;
  uploadingAssetId: string | null;
  lockingAssetId: string | null;
  onUpload: (asset: Asset, file: File) => Promise<void>;
  onLock: (asset: Asset) => Promise<void>;
};

function BibleGroup({ title, items, previewUrls, uploadingAssetId, lockingAssetId, onUpload, onLock }: BibleGroupProps) {
  if (!items.length) return null;

  function chooseReference(asset: Asset, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (file) void onUpload(asset, file);
  }

  return (
    <div className="bible-group">
      <span className="eyebrow">{title}</span>
      {items.map((item) => (
        <div className="bible-asset" key={item.id} title={item.description ?? item.name}>
          {previewUrls[item.id] ? (
            <img className="asset-thumb asset-thumb-image" src={previewUrls[item.id]} alt={`${item.name} reference`} />
          ) : (
            <span className="asset-thumb" />
          )}
          <div className="asset-copy">
            <strong>{item.name}</strong>
            <small>{item.reference_image_url ? "Reference attached" : "No reference yet"}</small>
          </div>
          <div className="asset-actions">
            <label className="asset-upload-button">
              {uploadingAssetId === item.id ? "Uploading…" : item.reference_image_url ? "Replace" : "Upload"}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingAssetId === item.id} onChange={(event) => chooseReference(item, event)} />
            </label>
            <button
              className={`asset-lock-button ${item.lock_state === "canon" ? "locked" : ""}`}
              disabled={item.lock_state === "canon" || lockingAssetId === item.id}
              onClick={() => void onLock(item)}
            >
              {item.lock_state === "canon" ? "◆" : lockingAssetId === item.id ? "…" : "◇"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d0f14", color: "white" }}>
      <div style={{ textAlign: "center" }}>
        <div className="brand-mark" style={{ margin: "0 auto 18px" }}>C</div>
        <strong>{label}</strong>
      </div>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage("Account created. Check your email once to confirm it, then sign in here.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    }

    setWorking(false);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0d0f14", color: "white" }}>
      <form onSubmit={submit} style={{ width: "min(440px, 100%)", border: "1px solid #252a34", borderRadius: 20, background: "#151820", padding: 28, boxShadow: "0 24px 70px rgba(0,0,0,.35)" }}>
        <div className="brand" style={{ marginBottom: 28 }}>
          <div className="brand-mark">C</div>
          <div><strong>Continuity Studio</strong><span>Persistent film workspace</span></div>
        </div>
        <span className="eyebrow">{mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}</span>
        <h1 style={{ fontSize: 30, margin: "8px 0 8px" }}>{mode === "signin" ? "Open your film" : "Create your workspace"}</h1>
        <p style={{ color: "#949aa8", marginTop: 0, marginBottom: 24 }}>Your characters, shots and continuity rules are now stored in Supabase.</p>
        <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <span>Email</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={{ padding: "13px 14px", borderRadius: 10, border: "1px solid #303641", background: "#0f1218", color: "white" }} />
        </label>
        <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          <span>Password</span>
          <input type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: "13px 14px", borderRadius: 10, border: "1px solid #303641", background: "#0f1218", color: "white" }} />
        </label>
        {message ? <p style={{ color: message.startsWith("Account created") ? "#8fe3b0" : "#ff9b9b", lineHeight: 1.5 }}>{message}</p> : null}
        <button className="primary-button" type="submit" disabled={working} style={{ width: "100%", justifyContent: "center" }}>
          {working ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", color: "#aeb5c2", cursor: "pointer", padding: 10 }}>
          {mode === "signin" ? "First time? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
