"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveCloudJoinRequest,
  createCloudInvite,
  listCloudHouseholdActivity,
  listCloudHouseholdMembers,
  listCloudInvites,
  listCloudJoinRequests,
  rejectCloudJoinRequest,
  removeCloudHouseholdMember,
  requestCloudHouseholdAccess,
  revokeCloudInvite,
  updateCloudHouseholdMemberRole,
  type CloudActivity,
  type CloudHouseholdMember,
  type CloudInvite,
  type CloudJoinRequest,
  type CloudRole,
  type CloudUser
} from "@/lib/cloud";

type ShareRole = Exclude<CloudRole, "owner">;

const shareRoles: Array<{ value: ShareRole; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Can manage household data." },
  { value: "helper", label: "Helper", description: "Can update shared household work." },
  { value: "viewer", label: "Viewer", description: "Can view household information only." }
];

function roleLabel(role: CloudRole) {
  return shareRoles.find((entry) => entry.value === role)?.label ?? "Owner";
}

function readableDate(value: string) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Unknown date";
}

function memberName(member: CloudHouseholdMember) {
  return member.displayName || member.email || `Member ${member.userId.slice(0, 8)}`;
}

function activityLabel(activity: CloudActivity) {
  const actor = activity.actorName || activity.actorEmail || "A household member";
  const detail = typeof activity.details.member === "string" ? `: ${activity.details.member}` : "";
  const labels: Record<string, string> = {
    cloud_backup_saved: "saved a cloud backup",
    invite_created: "created an invitation",
    invite_revoked: "revoked an invitation",
    access_approved: "approved access",
    access_declined: "declined an access request",
    member_role_changed: "changed an access level",
    member_removed: "removed a member"
  };
  return `${actor} ${labels[activity.action] ?? "updated cloud access"}${detail}`;
}

async function copyText(value: string) {
  await navigator.clipboard?.writeText(value);
}

type JoinHouseholdFormProps = {
  user: CloudUser;
  onCheckForApprovedAccess: () => void;
};

export function JoinHouseholdForm({ user, onCheckForApprovedAccess }: JoinHouseholdFormProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage("");
    setError("");
    void requestCloudHouseholdAccess(code, user)
      .then(() => {
        setCode("");
        setMessage("Access request sent. The household owner must approve it before anything is shared.");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The access request could not be sent."))
      .finally(() => setBusy(false));
  }

  return (
    <section className="cloud-access-section cloud-join-section">
      <div>
        <h3>Join a shared household</h3>
        <p className="muted">Paste an invitation code from the household owner. Sending a request does not grant access by itself.</p>
      </div>
      <label className="label">
        <span>Invitation code</span>
        <input className="field" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" placeholder="Paste code here" />
      </label>
      <button className="ghost-button" onClick={submit} disabled={busy || !code.trim()}>{busy ? "Sending..." : "Request access"}</button>
      <button className="text-button" onClick={onCheckForApprovedAccess} disabled={busy}>Check for approved access</button>
      {message ? <p className="notice cloud-message">{message}</p> : null}
      {error ? <p className="notice cloud-error">{error}</p> : null}
    </section>
  );
}

type HouseholdAccessManagerProps = {
  householdId: string;
  role: CloudRole;
};

export function HouseholdAccessManager({ householdId, role }: HouseholdAccessManagerProps) {
  const [members, setMembers] = useState<CloudHouseholdMember[]>([]);
  const [activity, setActivity] = useState<CloudActivity[]>([]);
  const [invites, setInvites] = useState<CloudInvite[]>([]);
  const [requests, setRequests] = useState<CloudJoinRequest[]>([]);
  const [inviteRole, setInviteRole] = useState<ShareRole>("helper");
  const [inviteLabel, setInviteLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const owner = role === "owner";

  const refresh = useCallback(async () => {
    const [nextMembers, nextActivity] = await Promise.all([listCloudHouseholdMembers(householdId), listCloudHouseholdActivity(householdId)]);
    setMembers(nextMembers);
    setActivity(nextActivity);
    if (owner) {
      const [nextInvites, nextRequests] = await Promise.all([listCloudInvites(householdId), listCloudJoinRequests(householdId)]);
      setInvites(nextInvites);
      setRequests(nextRequests);
    } else {
      setInvites([]);
      setRequests([]);
    }
  }, [householdId, owner]);

  useEffect(() => {
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Shared access could not be loaded."));
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That shared-access action did not finish.");
    } finally {
      setBusy(false);
    }
  }

  function createInvite() {
    void run(async () => {
      const invite = await createCloudInvite(householdId, inviteRole, inviteLabel);
      setInviteLabel("");
      setNewCode(invite.code);
      setMessage(`${roleLabel(invite.role)} invitation created. It expires in 7 days and still needs your approval after the recipient requests access.`);
    });
  }

  function approve(request: CloudJoinRequest) {
    void run(async () => {
      await approveCloudJoinRequest(householdId, request);
      setMessage(`${request.displayName || request.email || "The requester"} now has ${roleLabel(request.role)} access.`);
    });
  }

  function reject(request: CloudJoinRequest) {
    void run(async () => {
      await rejectCloudJoinRequest(householdId, request.id);
      setMessage("Access request declined.");
    });
  }

  function revokeInvite(invite: CloudInvite) {
    void run(async () => {
      await revokeCloudInvite(householdId, invite.id);
      setMessage("Invitation revoked.");
    });
  }

  function updateRole(member: CloudHouseholdMember, nextRole: ShareRole) {
    void run(async () => {
      await updateCloudHouseholdMemberRole(householdId, member, nextRole);
      setMessage(`${memberName(member)} now has ${roleLabel(nextRole)} access.`);
    });
  }

  function removeMember(member: CloudHouseholdMember) {
    if (!window.confirm(`Remove ${memberName(member)} from this household? They will immediately lose shared access.`)) return;
    void run(async () => {
      await removeCloudHouseholdMember(householdId, member);
      setMessage(`${memberName(member)} no longer has household access.`);
    });
  }

  return (
    <section className="cloud-access-section">
      <div className="section-head">
        <div>
          <h3>Shared access</h3>
          <p className="muted">The owner chooses every role. Private vault records are never shared here.</p>
        </div>
      </div>

      {owner ? (
        <>
          <div className="cloud-invite-form">
            <label className="label">
              <span>Access level</span>
              <select className="field" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as ShareRole)}>
                {shareRoles.map((entry) => <option value={entry.value} key={entry.value}>{entry.label} - {entry.description}</option>)}
              </select>
            </label>
            <label className="label">
              <span>Invitation note (optional)</span>
              <input className="field" value={inviteLabel} onChange={(event) => setInviteLabel(event.target.value)} placeholder="For example: Alex" />
            </label>
            <button className="button" onClick={createInvite} disabled={busy}>{busy ? "Working..." : "Create invitation"}</button>
          </div>

          {newCode ? (
            <div className="cloud-code-box">
              <strong>New invitation code</strong>
              <input className="field" value={newCode} readOnly aria-label="New invitation code" />
              <button className="ghost-button" onClick={() => void copyText(newCode)}>Copy code</button>
            </div>
          ) : null}

          <div className="cloud-access-list">
            <h4>Pending access requests</h4>
            {requests.length ? requests.map((request) => (
              <div className="cloud-access-row" key={request.id}>
                <div>
                  <strong>{request.displayName || request.email || "Unnamed requester"}</strong>
                  <span>{request.email || request.userId} | Requested {roleLabel(request.role)} access</span>
                </div>
                <div className="inline-actions">
                  <button className="small-button" onClick={() => approve(request)} disabled={busy}>Approve</button>
                  <button className="text-button danger" onClick={() => reject(request)} disabled={busy}>Decline</button>
                </div>
              </div>
            )) : <p className="muted">No one is waiting for approval.</p>}
          </div>

          <div className="cloud-access-list">
            <h4>Active invitation codes</h4>
            {invites.filter((invite) => invite.active).length ? invites.filter((invite) => invite.active).map((invite) => (
              <div className="cloud-access-row" key={invite.id}>
                <div>
                  <strong>{roleLabel(invite.role)} invitation{invite.label ? ` for ${invite.label}` : ""}</strong>
                  <span>Expires {readableDate(invite.expiresAt)}</span>
                </div>
                <div className="inline-actions">
                  <button className="small-button" onClick={() => void copyText(invite.code)}>Copy code</button>
                  <button className="text-button danger" onClick={() => revokeInvite(invite)} disabled={busy}>Revoke</button>
                </div>
              </div>
            )) : <p className="muted">No active invitation codes.</p>}
          </div>
        </>
      ) : null}

      <div className="cloud-access-list">
        <h4>People with access</h4>
        {members.map((member) => (
          <div className="cloud-access-row" key={member.userId}>
            <div>
              <strong>{memberName(member)}</strong>
              <span>{member.email || member.userId}</span>
            </div>
            {owner && member.role !== "owner" ? (
              <div className="inline-actions">
                <select className="field compact-field" value={member.role} onChange={(event) => updateRole(member, event.target.value as ShareRole)} disabled={busy}>
                  {shareRoles.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
                </select>
                <button className="text-button danger" onClick={() => removeMember(member)} disabled={busy}>Remove</button>
              </div>
            ) : <span className="cloud-role-badge">{roleLabel(member.role)}</span>}
          </div>
        ))}
      </div>

      <div className="cloud-access-list">
        <h4>Recent household activity</h4>
        {activity.length ? activity.map((entry) => (
          <div className="cloud-access-row" key={entry.id}>
            <div>
              <strong>{activityLabel(entry)}</strong>
              <span>{readableDate(entry.createdAt)}</span>
            </div>
          </div>
        )) : <p className="muted">No shared household activity yet.</p>}
      </div>

      {message ? <p className="notice cloud-message">{message}</p> : null}
      {error ? <p className="notice cloud-error">{error}</p> : null}
    </section>
  );
}
