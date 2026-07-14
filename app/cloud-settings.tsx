"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { HouseholdAccessManager, JoinHouseholdForm } from "@/app/cloud-access";
import type { AppState } from "@/lib/inventory-types";
import {
  CLOUD_HOUSEHOLD_KEY,
  activeCloudProviderName,
  createCloudHousehold,
  currentCloudUser,
  isCloudConfigured,
  listCloudHouseholds,
  loadCloudState,
  onCloudAuthChange,
  requestCloudPasswordReset,
  saveCloudState,
  signInToCloud,
  signOutOfCloud,
  signUpForCloud,
  supportsCloudHelperAccess,
  type CloudHousehold,
  type CloudSnapshot,
  type CloudUser
} from "@/lib/cloud";

type CloudSettingsProps = {
  state: AppState;
  onRestore: (state: unknown) => void;
};

function readableDate(value?: string) {
  if (!value) return "No cloud backup yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function CloudSettings({ state, onRestore }: CloudSettingsProps) {
  const configured = isCloudConfigured();
  const providerName = activeCloudProviderName();
  const helperAccessSupported = supportsCloudHelperAccess();
  const [user, setUser] = useState<CloudUser | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(configured);
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [households, setHouseholds] = useState<CloudHousehold[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [snapshot, setSnapshot] = useState<CloudSnapshot | null>(null);
  const [pendingRestore, setPendingRestore] = useState<CloudSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedHousehold = useMemo(
    () => households.find((household) => household.id === selectedHouseholdId),
    [households, selectedHouseholdId]
  );
  const canEditSelectedHousehold = selectedHousehold?.role !== "viewer";

  const refreshHouseholds = useCallback(async (preferredId?: string) => {
    const available = await listCloudHouseholds();
    setHouseholds(available);
    const savedId = preferredId || localStorage.getItem(CLOUD_HOUSEHOLD_KEY) || "";
    const nextId = available.some((household) => household.id === savedId) ? savedId : available[0]?.id ?? "";
    setSelectedHouseholdId(nextId);
    if (nextId) localStorage.setItem(CLOUD_HOUSEHOLD_KEY, nextId);
    const latest = nextId ? await loadCloudState(nextId) : null;
    setSnapshot(latest);
  }, []);

  useEffect(() => {
    if (!configured) return;
    currentCloudUser()
      .then(async (current) => {
        setUser(current);
        if (current) await refreshHouseholds();
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Cloud account check failed."))
      .finally(() => setCheckingAccount(false));

    return onCloudAuthChange((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setHouseholds([]);
        setSelectedHouseholdId("");
        setSnapshot(null);
        return;
      }

      // Firebase restores persistent sign-in after the initial render. Reload
      // the member households when that restoration completes.
      void refreshHouseholds().catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Cloud households could not be loaded.");
      });
    });
  }, [configured, refreshHouseholds]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The cloud request did not finish.");
    } finally {
      setBusy(false);
    }
  }

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (mode === "create") {
        const result = await signUpForCloud(email.trim(), password, displayName.trim());
        setPassword("");
        if (!result.signedIn) {
          setMessage("Account created. Check email to confirm it, then sign in here.");
          setMode("sign-in");
          return;
        }
        setUser(result.user);
        await refreshHouseholds();
        setMessage("Account created and signed in.");
        return;
      }

      const signedInUser = await signInToCloud(email.trim(), password);
      setPassword("");
      setUser(signedInUser);
      await refreshHouseholds();
      setMessage("Signed in. Local data has not been changed.");
    });
  }

  function requestPasswordReset() {
    if (!email.trim()) {
      setError("Enter the email address first, then choose Forgot password.");
      return;
    }
    void run(async () => {
      await requestCloudPasswordReset(email.trim());
      setMessage("Password-reset instructions were sent. Check that email inbox, including spam or junk mail.");
    });
  }

  function createHousehold() {
    if (!user) return;
    void run(async () => {
      const householdId = await createCloudHousehold(state, user);
      await refreshHouseholds(householdId);
      setMessage("Secure household created and this device was backed up.");
    });
  }

  function checkForApprovedAccess() {
    void run(async () => {
      await refreshHouseholds();
      setMessage("Checked for approved household access.");
    });
  }

  function backUpNow() {
    if (!selectedHouseholdId) return;
    void run(async () => {
      const result = await saveCloudState(selectedHouseholdId, state);
      const latest = await loadCloudState(selectedHouseholdId);
      setSnapshot(latest);
      const photoNote = result.uploadedPhotos
        ? ` ${result.uploadedPhotos} ${result.uploadedPhotos === 1 ? "photo was" : "photos were"} moved to private storage.`
        : "";
      setMessage(`Cloud backup saved as revision ${result.revision}.${photoNote}`);
    });
  }

  function inspectRestore() {
    if (!selectedHouseholdId) return;
    void run(async () => {
      const latest = await loadCloudState(selectedHouseholdId);
      setSnapshot(latest);
      setPendingRestore(latest);
      setMessage(latest ? "Cloud backup checked. Review it below before restoring." : "This household has no cloud backup yet.");
    });
  }

  function applyRestore() {
    if (!pendingRestore) return;
    const approved = window.confirm(
      "Replace the data currently shown on this device with the selected cloud backup? Your downloaded backup files will not be affected."
    );
    if (!approved) return;
    onRestore(pendingRestore.state);
    setSnapshot(pendingRestore);
    setPendingRestore(null);
    setMessage("Cloud backup restored to this device.");
  }

  function selectHousehold(householdId: string) {
    setSelectedHouseholdId(householdId);
    setPendingRestore(null);
    localStorage.setItem(CLOUD_HOUSEHOLD_KEY, householdId);
    void run(async () => setSnapshot(await loadCloudState(householdId)));
  }

  function signOut() {
    void run(async () => {
      await signOutOfCloud();
      setUser(null);
      setMessage("Signed out. The local app and its data still work normally.");
    });
  }

  if (!configured) {
    return (
      <div className="panel cloud-panel cloud-panel-offline">
        <div className="section-head">
          <div>
            <span className="cloud-kicker">Local mode</span>
            <h2>Cloud protection</h2>
            <p className="muted">The app remains fully usable on this device. No cloud account is connected yet.</p>
          </div>
          <span className="cloud-state">Not connected</span>
        </div>
        <div className="cloud-setup-note">
          <strong>Ready when the cloud project is created</strong>
          <span>Add the {providerName} web configuration, then restart the app. The account and backup controls will appear here.</span>
        </div>
      </div>
    );
  }

  if (checkingAccount) {
    return <div className="panel cloud-panel"><p className="muted">Checking cloud account...</p></div>;
  }

  if (!user) {
    return (
      <div className="panel cloud-panel">
        <div className="section-head">
          <div>
            <span className="cloud-kicker">Optional account</span>
            <h2>Cloud protection</h2>
            <p className="muted">Sign in to protect household data and prepare sharing across devices.</p>
          </div>
          <span className="cloud-state">Signed out</span>
        </div>
        <div className="segmented cloud-auth-modes" role="group" aria-label="Account action">
          <button className={mode === "sign-in" ? "active" : ""} onClick={() => setMode("sign-in")}>Sign in</button>
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Create account</button>
        </div>
        <form className="cloud-auth-form" onSubmit={submitAccount}>
          {mode === "create" ? (
            <label className="label"><span>Name</span><input className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>
          ) : null}
          <label className="label"><span>Email</span><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label className="label"><span>Password</span><input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} required /></label>
          <button className="button" type="submit" disabled={busy}>{busy ? "Working..." : mode === "create" ? "Create secure account" : "Sign in"}</button>
          {mode === "sign-in" ? <button className="text-button cloud-password-reset" type="button" onClick={requestPasswordReset} disabled={busy}>Forgot password?</button> : null}
        </form>
        {message ? <p className="notice cloud-message">{message}</p> : null}
        {error ? <p className="notice cloud-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="panel cloud-panel">
      <div className="section-head">
        <div>
          <span className="cloud-kicker">Protected account</span>
          <h2>Cloud protection</h2>
          <p className="muted">Local saving stays on. Cloud transfer happens only when you choose it.</p>
        </div>
        <span className="cloud-state connected">Connected</span>
      </div>

      <div className="cloud-account-line">
        <span>{user.email}</span>
        <button className="text-button" onClick={signOut} disabled={busy}>Sign out</button>
      </div>

      {!households.length ? (
        <div className="cloud-empty cloud-empty-stack">
          <div>
            <strong>No cloud household yet</strong>
            <span>Create one from the household already on this device. Nothing local will be removed.</span>
            <button className="button" onClick={createHousehold} disabled={busy}>{busy ? "Creating..." : `Create ${state.household.name}`}</button>
          </div>
          {helperAccessSupported ? <JoinHouseholdForm user={user} onCheckForApprovedAccess={checkForApprovedAccess} /> : null}
        </div>
      ) : (
        <>
          <label className="label cloud-household-select">
            <span>Cloud household</span>
            <select className="field" value={selectedHouseholdId} onChange={(event) => selectHousehold(event.target.value)}>
              {households.map((household) => <option value={household.id} key={household.id}>{household.name} - {household.role}</option>)}
            </select>
          </label>

          <div className="cloud-summary">
            <div><span>Access</span><strong>{selectedHousehold?.role ?? "member"}</strong></div>
            <div><span>Cloud revision</span><strong>{snapshot?.revision ?? "None"}</strong></div>
            <div><span>Last protected</span><strong>{readableDate(snapshot?.updatedAt)}</strong></div>
          </div>

          <div className="cloud-actions">
            <button className="button" onClick={backUpNow} disabled={busy || !canEditSelectedHousehold}>{busy ? "Working..." : canEditSelectedHousehold ? "Back up this device" : "Read-only access"}</button>
            <button className="ghost-button" onClick={inspectRestore} disabled={busy}>Check cloud backup</button>
          </div>

          {pendingRestore ? (
            <div className="cloud-restore-review">
              <div>
                <strong>Revision {pendingRestore.revision}</strong>
                <span>Saved {readableDate(pendingRestore.updatedAt)}</span>
              </div>
              <button className="ghost-button" onClick={applyRestore}>Restore to this device</button>
              <button className="text-button" onClick={() => setPendingRestore(null)}>Cancel</button>
            </div>
          ) : null}

          <div className="cloud-permissions">
            <span><strong>Owner</strong> controls access</span>
            <span><strong>Admin</strong> manages household data</span>
            <span><strong>Helper</strong> can update shared work</span>
            <span><strong>Viewer</strong> can only read</span>
            <small>The private vault is never included in helper access.</small>
          </div>

          {helperAccessSupported && selectedHouseholdId && selectedHousehold ? (
            <HouseholdAccessManager householdId={selectedHouseholdId} role={selectedHousehold.role} />
          ) : null}
        </>
      )}

      {message ? <p className="notice cloud-message">{message}</p> : null}
      {error ? <p className="notice cloud-error">{error}</p> : null}
    </div>
  );
}
