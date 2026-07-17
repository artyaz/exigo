"use client";
/* /settings — AI provider preferences. Choose the default Google Gemini key
   or a custom OpenAI-compatible endpoint (base URL + model + key). The key is
   sent to a server action that encrypts it before it touches Convex; the UI
   only ever learns whether a key is set, never its value. */
import React from "react";
import { getAiSettings, saveAiSettings, type AiSettingsView } from "../actions/aiSettings";

const CSS = `
.st{ min-height:100vh; background:var(--neutral-950); color:var(--white-80); font-family:var(--font-sans); }
.st__head{ display:flex; align-items:baseline; gap:14px; padding:24px 28px 14px; border-bottom:1px solid var(--border-faint); }
.st__title{ font-size:18px; font-weight:600; color:#fff; letter-spacing:var(--tracking-snug); }
.st__sub{ font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.st__body{ max-width:560px; padding:26px 28px; display:flex; flex-direction:column; gap:20px; }
.st__group{ display:flex; flex-direction:column; gap:7px; }
.st__label{ font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--white-40); }
.st__hint{ font-size:12px; color:var(--white-40); line-height:1.5; }
.st__radio{ display:flex; gap:10px; }
.st__opt{ flex:1; padding:12px 14px; border-radius:var(--radius-lg); background:var(--white-03); border:1px solid var(--border); cursor:pointer; transition:all 180ms var(--ease-spring); }
.st__opt--on{ background:rgb(52 211 153 / .1); border-color:rgb(52 211 153 / .4); }
.st__opt-t{ font-size:13.5px; color:#fff; font-weight:500; }
.st__opt-d{ font-size:11.5px; color:var(--white-40); margin-top:3px; line-height:1.45; }
.st__input{ font-family:var(--font-mono); font-size:13px; color:var(--white-85); background:var(--surface-sunken); border:1px solid var(--border); border-radius:var(--radius-lg); padding:10px 13px; outline:none; }
.st__input:focus{ border-color:rgb(52 211 153 / .4); box-shadow:0 0 0 2px rgb(52 211 153 / .15); }
.st__row{ display:flex; align-items:center; gap:10px; }
.st__btn{ align-self:flex-start; font-family:var(--font-mono); font-size:12px; letter-spacing:.08em; padding:9px 18px; border-radius:99px; background:rgb(52 211 153 / .14); border:1px solid rgb(52 211 153 / .4); color:var(--emerald-400); cursor:pointer; transition:all 180ms var(--ease-spring); }
.st__btn:hover{ background:rgb(52 211 153 / .22); }
.st__btn:disabled{ opacity:.5; cursor:default; }
.st__badge{ font-family:var(--font-mono); font-size:11px; color:var(--emerald-400); }
.st__msg{ font-family:var(--font-mono); font-size:11.5px; letter-spacing:.04em; }
.st__msg--ok{ color:var(--emerald-400); }
.st__msg--no{ color:var(--rose-400); }
`;

type Provider = "gemini" | "openai";

export default function SettingsPage(): React.JSX.Element {
  const [provider, setProvider] = React.useState<Provider>("gemini");
  const [model, setModel] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [hasCustomKey, setHasCustomKey] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "ok" | "no"; text: string } | null>(null);

  React.useEffect(() => {
    const el = document.createElement("style");
    el.id = "exg-st-styles";
    el.textContent = CSS;
    if (!document.getElementById("exg-st-styles")) document.head.appendChild(el);
    return () => document.getElementById("exg-st-styles")?.remove();
  }, []);

  React.useEffect(() => {
    let alive = true;
    getAiSettings()
      .then((s: AiSettingsView) => {
        if (!alive || !s) return;
        setProvider(s.provider);
        setModel(s.model ?? "");
        setBaseUrl(s.baseUrl ?? "");
        setHasCustomKey(s.hasCustomKey);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const onSave = async (): Promise<void> => {
    setSaving(true);
    setMsg(null);
    try {
      await saveAiSettings({
        provider,
        model: model || undefined,
        baseUrl: provider === "openai" ? baseUrl || undefined : undefined,
        apiKey: provider === "openai" && apiKey ? apiKey : undefined,
        clearKey: provider === "gemini",
      });
      if (apiKey) setHasCustomKey(true);
      setApiKey("");
      setMsg({ kind: "ok", text: "saved" });
    } catch (e) {
      setMsg({ kind: "no", text: e instanceof Error ? e.message : "save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="st">
      <div className="st__head">
        <span className="st__title">Settings</span>
        <span className="st__sub">AI provider</span>
      </div>
      <div className="st__body">
        {loading ? (
          <div className="st__hint">Loading…</div>
        ) : (
          <>
            <div className="st__group">
              <span className="st__label">Provider</span>
              <div className="st__radio" role="radiogroup" aria-label="Provider">
                <div
                  className={`st__opt${provider === "gemini" ? " st__opt--on" : ""}`}
                  role="radio"
                  tabIndex={0}
                  aria-checked={provider === "gemini"}
                  onClick={() => setProvider("gemini")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setProvider("gemini");
                    }
                  }}
                >
                  <div className="st__opt-t">Default (Gemini)</div>
                  <div className="st__opt-d">Uses the app&apos;s Google key. No setup.</div>
                </div>
                <div
                  className={`st__opt${provider === "openai" ? " st__opt--on" : ""}`}
                  role="radio"
                  tabIndex={0}
                  aria-checked={provider === "openai"}
                  onClick={() => setProvider("openai")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setProvider("openai");
                    }
                  }}
                >
                  <div className="st__opt-t">Custom endpoint</div>
                  <div className="st__opt-d">Any OpenAI-compatible API (OpenAI, Together, Groq, local…).</div>
                </div>
              </div>
            </div>

            {provider === "openai" && (
              <>
                <div className="st__group">
                  <span className="st__label">Base URL</span>
                  <input
                    className="st__input"
                    placeholder="https://api.openai.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
                <div className="st__group">
                  <span className="st__label">API key</span>
                  <div className="st__row">
                    <input
                      className="st__input"
                      style={{ flex: 1 }}
                      type="password"
                      placeholder={hasCustomKey ? "•••••• (leave blank to keep)" : "sk-…"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    {hasCustomKey && <span className="st__badge">key set ✓</span>}
                  </div>
                  <span className="st__hint">Encrypted before storage — never shown again.</span>
                </div>
              </>
            )}

            <div className="st__group">
              <span className="st__label">Model</span>
              <input
                className="st__input"
                placeholder={provider === "gemini" ? "gemini-2.0-flash (default)" : "gpt-4o-mini"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="st__row">
              <button className="st__btn" type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
              {msg && <span className={`st__msg st__msg--${msg.kind}`}>{msg.text}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
