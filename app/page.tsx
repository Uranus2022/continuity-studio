"use client";

import { useMemo, useState } from "react";
import { characters, locations, project, props, rules, shots } from "@/lib/mock-data";

const Icon = ({ children }: { children: React.ReactNode }) => <span className="icon">{children}</span>;

export default function Home() {
  const [selectedId, setSelectedId] = useState(3);
  const selected = useMemo(() => shots.find((shot) => shot.id === selectedId) ?? shots[2], [selectedId]);

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
          <small>{project.format}</small>
        </div>

        <nav className="nav-list" aria-label="Workspace sections">
          <button className="nav-item active"><Icon>◫</Icon>Shots <span>{shots.length}</span></button>
          <button className="nav-item"><Icon>●</Icon>Characters <span>{characters.length}</span></button>
          <button className="nav-item"><Icon>⌂</Icon>Locations <span>{locations.length}</span></button>
          <button className="nav-item"><Icon>◇</Icon>Props <span>{props.length}</span></button>
          <button className="nav-item"><Icon>✓</Icon>Continuity <span>{rules.length}</span></button>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" /> Local prototype
          <small>No generation API connected</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">FILM WORKSPACE</span>
            <h1>{project.title}</h1>
          </div>
          <div className="top-actions">
            <button className="ghost-button">Import Script</button>
            <button className="primary-button">＋ New Shot</button>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="shot-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SHOT {String(selected.id).padStart(2, "0")}</span>
                <h2>{selected.label}</h2>
              </div>
              <span className={`badge ${selected.status}`}>{selected.status}</span>
            </div>

            <div className="frame-stage">
              <div className="safe-frame">
                <div className="frame-glow" />
                <div className="frame-copy">
                  <span>9:16 FRAME</span>
                  <strong>{selected.camera}</strong>
                  <p>{selected.action}</p>
                </div>
              </div>
            </div>

            <div className="shot-fields">
              <label>
                <span>Camera</span>
                <input value={selected.camera} readOnly />
              </label>
              <label>
                <span>Time</span>
                <input value={selected.time} readOnly />
              </label>
              <label className="full-field">
                <span>Action</span>
                <textarea value={selected.action} readOnly />
              </label>
            </div>

            <div className="canon-row">
              <button className="secondary-button">Preview Prompt</button>
              <button className="canon-button">◆ Lock as Canon</button>
            </div>
          </section>

          <aside className="inspector">
            <div className="inspector-card">
              <div className="card-title"><span>Continuity Check</span><span className="pass-pill">PASS</span></div>
              <p className="muted">Assets and story rules inherited for this shot.</p>
              <div className="rule-list">
                {selected.continuity.map((item) => (
                  <div className="rule-row" key={item}><span className="check">✓</span><span>{item}</span><small>locked</small></div>
                ))}
              </div>
            </div>

            <div className="inspector-card">
              <div className="card-title"><span>Story Bible</span><span>⌘</span></div>
              <BibleGroup title="CHARACTER" items={characters.map((x) => x.name)} />
              <BibleGroup title="LOCATION" items={locations.map((x) => x.name)} />
              <BibleGroup title="PROPS" items={props.map((x) => x.name)} />
            </div>

            <div className="inspector-card rules-card">
              <div className="card-title"><span>Active Rules</span><span>{rules.length}</span></div>
              {rules.slice(0, 4).map((rule, index) => <p key={rule}><b>0{index + 1}</b>{rule}</p>)}
            </div>
          </aside>
        </div>

        <section className="timeline-section">
          <div className="timeline-heading">
            <div><span className="eyebrow">TIMELINE</span><strong>12 shots</strong></div>
            <span className="timeline-legend"><i className="canon-dot" /> canon <i className="draft-dot" /> draft <i className="planned-dot" /> planned</span>
          </div>
          <div className="timeline">
            {shots.map((shot) => (
              <button key={shot.id} className={`timeline-shot ${shot.status} ${shot.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(shot.id)}>
                <span>{String(shot.id).padStart(2, "0")}</span>
                <div className="mini-frame"><i /></div>
                <strong>{shot.label}</strong>
                <small>{shot.time}</small>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function BibleGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bible-group">
      <span className="eyebrow">{title}</span>
      {items.map((item) => <button key={item}><span className="asset-thumb" />{item}<span className="lock">◆</span></button>)}
    </div>
  );
}
