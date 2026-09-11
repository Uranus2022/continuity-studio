"use client";

import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
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
};

type Shot = {
  id: string;
  project_id: string;
  shot_number: number;
  title: string;
  camera: string | null;
  action: string | null;
  time_of_day: string | null;
  status: "planned" | "draft" | "canon";
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
  const [selectedNumber, setSelectedNumber] = useState(3);
  const [savingCanon, setSavingCanon] = useState(false);

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
          .select("id,kind,name,description,lock_state")
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
      const shotIds = nextShots.map((shot) => shot.id);
      let links: ShotAsset[] = [];

      if (shotIds.length) {
        const linkResult = await supabase
          .from("shot_assets")
          .select("shot_id,asset_id,role")
          .in("shot_id", shotIds);
        if (linkResult.error) throw linkResult.error;
        links = (linkResult.data ?? []) as ShotAsset[];
      }

      setProject(projectResult.data as Project);
      setShots(nextShots);
      setAssets((assetResult.data ?? []) as Asset[]);
      setRules((ruleResult.data ?? []) as Rule[]);
      setShotAssets(links);

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

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedAssetNames = useMemo(() => {
    if (!selected) return [];
    return shotAssets
      .filter((link) => link.shot_id === selected.id)
      .map((link) => assetById.get(link.asset_id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [selected, shotAssets, assetById]);

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

  async function lockAsCanon() {
    if (!selected || selected.status === "canon") return;
    setSavingCanon(true);
    setError("");

    const { error: updateError } = await supabase
      .from("shots")
      .update({ status: "canon" })
      .eq("id", selected.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setShots((current) =>
        current.map((shot) => (shot.id === selected.id ? { ...shot, status: "canon" } : shot)),
      );
    }
    setSavingCanon(false);
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

        {error ? <p style={{ color: "#ff9b9b", margin: "0 0 16px" }}>{error}</p> : null}

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
              <div className="safe-frame">
                <div className="frame-glow" />
                <div className="frame-copy">
                  <span>{project.aspect_ratio} FRAME</span>
                  <strong>{selected.camera ?? "Camera not set"}</strong>
                  <p>{selected.action ?? "Action not set"}</p>
                </div>
              </div>
            </div>

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
              <button
                className="canon-button"
                onClick={() => void lockAsCanon()}
                disabled={savingCanon || selected.status === "canon"}
              >
                {selected.status === "canon" ? "◆ Canon locked" : savingCanon ? "Locking…" : "◆ Lock as Canon"}
              </button>
            </div>
          </section>

          <aside className="inspector">
            <div className="inspector-card">
              <div className="card-title"><span>Continuity Check</span><span className="pass-pill">PASS</span></div>
              <p className="muted">Assets and story rules inherited for this shot.</p>
              <div className="rule-list">
                {selectedAssetNames.map((item) => (
                  <div className="rule-row" key={item}><span className="check">✓</span><span>{item}</span><small>linked</small></div>
                ))}
                {!selectedAssetNames.length ? <p className="muted">No shot assets linked yet.</p> : null}
              </div>
            </div>

            <div className="inspector-card">
              <div className="card-title"><span>Story Bible</span><span>⌘</span></div>
              <BibleGroup title="CHARACTER" items={characters} />
              <BibleGroup title="LOCATION" items={locations} />
              <BibleGroup title="WARDROBE" items={wardrobe} />
              <BibleGroup title="PROPS" items={props} />
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
            <span className="timeline-legend"><i className="canon-dot" /> canon <i className="draft-dot" /> draft <i className="planned-dot" /> planned</span>
          </div>
          <div className="timeline">
            {shots.map((shot) => (
              <button
                key={shot.id}
                className={`timeline-shot ${shot.status} ${shot.shot_number === selectedNumber ? "selected" : ""}`}
                onClick={() => setSelectedNumber(shot.shot_number)}
              >
                <span>{String(shot.shot_number).padStart(2, "0")}</span>
                <div className="mini-frame"><i /></div>
                <strong>{shot.title}</strong>
                <small>{shot.time_of_day}</small>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function BibleGroup({ title, items }: { title: string; items: Asset[] }) {
  if (!items.length) return null;
  return (
    <div className="bible-group">
      <span className="eyebrow">{title}</span>
      {items.map((item) => (
        <button key={item.id} title={item.description ?? item.name}>
          <span className="asset-thumb" />
          {item.name}
          <span className="lock">{item.lock_state === "canon" ? "◆" : "◇"}</span>
        </button>
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
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
      <form
        onSubmit={submit}
        style={{ width: "min(440px, 100%)", border: "1px solid #252a34", borderRadius: 20, background: "#151820", padding: 28, boxShadow: "0 24px 70px rgba(0,0,0,.35)" }}
      >
        <div className="brand" style={{ marginBottom: 28 }}>
          <div className="brand-mark">C</div>
          <div><strong>Continuity Studio</strong><span>Persistent film workspace</span></div>
        </div>
        <span className="eyebrow">{mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}</span>
        <h1 style={{ fontSize: 30, margin: "8px 0 8px" }}>{mode === "signin" ? "Open your film" : "Create your workspace"}</h1>
        <p style={{ color: "#949aa8", marginTop: 0, marginBottom: 24 }}>
          Your characters, shots and continuity rules are now stored in Supabase.
        </p>
        <label style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ padding: "13px 14px", borderRadius: 10, border: "1px solid #303641", background: "#0f1218", color: "white" }}
          />
        </label>
        <label style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          <span>Password</span>
          <input
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{ padding: "13px 14px", borderRadius: 10, border: "1px solid #303641", background: "#0f1218", color: "white" }}
          />
        </label>
        {message ? <p style={{ color: message.startsWith("Account created") ? "#8fe3b0" : "#ff9b9b", lineHeight: 1.5 }}>{message}</p> : null}
        <button className="primary-button" type="submit" disabled={working} style={{ width: "100%", justifyContent: "center" }}>
          {working ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}
          style={{ width: "100%", marginTop: 12, border: 0, background: "transparent", color: "#aeb5c2", cursor: "pointer", padding: 10 }}
        >
          {mode === "signin" ? "First time? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
