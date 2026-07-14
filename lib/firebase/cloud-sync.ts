import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { AppState } from "@/lib/inventory-types";
import type { CloudAccountResult, CloudActivity, CloudHousehold, CloudHouseholdMember, CloudInvite, CloudJoinRequest, CloudRole, CloudSnapshot, CloudUser } from "@/lib/cloud-types";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase/client";

export const FIREBASE_MEDIA_PREFIX = "firebase-private://household-media/";

type ShareRole = Exclude<CloudRole, "owner">;

type InviteDocument = {
  role: ShareRole;
  label?: string;
  active: boolean;
  expiresAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
};

type JoinRequestDocument = {
  userId: string;
  email?: string;
  displayName?: string;
  role: ShareRole;
  inviteCode: string;
  requestedAt?: { toDate?: () => Date };
};

type HouseholdDocument = {
  name?: string;
  ownerUserId?: string;
  memberIds?: string[];
  editorIds?: string[];
  memberRoles?: Record<string, CloudRole>;
  memberProfiles?: Record<string, { email?: string; displayName?: string }>;
  updatedAt?: { toDate?: () => Date };
};

type ActivityDocument = {
  action?: string;
  actorName?: string;
  actorEmail?: string;
  details?: Record<string, string | number | boolean>;
  createdAt?: { toDate?: () => Date };
};

function toCloudUser(user: User | null): CloudUser | null {
  return user ? { id: user.uid, email: user.email, displayName: user.displayName } : null;
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  return new Blob([Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))], { type: mimeType });
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  if (mimeType === "application/pdf") return "pdf";
  return "jpg";
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function toIso(value: { toDate?: () => Date } | undefined) {
  return value?.toDate?.().toISOString() ?? "";
}

function inviteCode(householdId: string, inviteId: string) {
  return `${householdId}.${inviteId}`;
}

function parseInviteCode(value: string) {
  const [householdId, inviteId, ...extra] = value.trim().split(".");
  if (!householdId || !inviteId || extra.length) throw new Error("That invitation code is not valid.");
  return { householdId, inviteId };
}

function editorRole(role: ShareRole) {
  return role === "admin" || role === "helper";
}

function randomInviteId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function recordFirebaseActivity(householdId: string, action: string, details: Record<string, string | number | boolean> = {}) {
  const user = await currentFirebaseUser();
  if (!user) return;
  try {
    await addDoc(collection(getFirebaseServices().db, "households", householdId, "activity"), {
      action,
      actorUserId: user.id,
      actorName: user.displayName ?? "",
      actorEmail: user.email ?? "",
      details,
      createdAt: serverTimestamp()
    });
  } catch {
    // Access changes must not be reported as failed merely because the optional
    // historical record could not be written.
  }
}

function removeUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => removeUndefinedValues(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, removeUndefinedValues(entry)])
    );
  }

  return value;
}

async function uploadDataUrl(dataUrl: string | undefined, householdId: string, group: string, recordId: string, field: string) {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  const { storage } = getFirebaseServices();
  const blob = dataUrlToBlob(dataUrl);
  const path = [householdId, safePathPart(group), safePathPart(recordId), `${safePathPart(field)}.${extensionForMimeType(blob.type)}`].join("/");
  await uploadBytes(ref(storage, `household-media/${path}`), blob, { contentType: blob.type });
  return `${FIREBASE_MEDIA_PREFIX}${path}`;
}

async function prepareStateForCloud(input: AppState, householdId: string) {
  const state = JSON.parse(JSON.stringify(input)) as AppState;
  let uploadedPhotos = 0;
  async function replace(current: string | undefined, group: string, recordId: string, field: string, apply: (value: string | undefined) => void) {
    const next = await uploadDataUrl(current, householdId, group, recordId, field);
    if (current?.startsWith("data:") && next !== current) uploadedPhotos += 1;
    apply(next);
  }
  for (const item of state.items) await replace(item.photoUrl, "items", item.id, "photo", (value) => { item.photoUrl = value; });
  for (const location of state.locations) await replace(location.photoUrl, "locations", location.id, "photo", (value) => { location.photoUrl = value; });
  for (const container of state.containers) {
    await replace(container.outsidePhotoUrl, "containers", container.id, "outside", (value) => { container.outsidePhotoUrl = value; });
    await replace(container.insidePhotoUrl, "containers", container.id, "inside", (value) => { container.insidePhotoUrl = value; });
  }
  for (const purchase of state.purchaseRecords) await replace(purchase.receiptPhotoUrl, "receipts", purchase.id, "receipt", (value) => { purchase.receiptPhotoUrl = value; });
  for (const supplement of state.supplementItems) await replace(supplement.bottlePhotoUrl, "supplements", supplement.id, "bottle", (value) => { supplement.bottlePhotoUrl = value; });
  return { state, uploadedPhotos };
}

export function isFirebaseCloudConfigured() {
  return isFirebaseConfigured();
}

export async function signUpForFirebase(email: string, password: string, displayName: string): Promise<CloudAccountResult> {
  const result = await createUserWithEmailAndPassword(getFirebaseServices().auth, email, password);
  if (displayName) await updateProfile(result.user, { displayName });
  return { user: toCloudUser(result.user), signedIn: true };
}

export async function signInToFirebase(email: string, password: string) {
  return toCloudUser((await signInWithEmailAndPassword(getFirebaseServices().auth, email, password)).user);
}

export async function sendFirebasePasswordReset(email: string) {
  await sendPasswordResetEmail(getFirebaseServices().auth, email);
}

export async function signOutOfFirebase() {
  await signOut(getFirebaseServices().auth);
}

export async function currentFirebaseUser() {
  return toCloudUser(getFirebaseServices().auth.currentUser);
}

export function onFirebaseAuthChange(callback: (user: CloudUser | null) => void) {
  return onAuthStateChanged(getFirebaseServices().auth, (user) => callback(toCloudUser(user)));
}

export async function listFirebaseHouseholds(): Promise<CloudHousehold[]> {
  const user = await currentFirebaseUser();
  if (!user) return [];
  const { db } = getFirebaseServices();
  const snapshot = await getDocs(query(collection(db, "households"), where("memberIds", "array-contains", user.id)));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as HouseholdDocument;
    return { id: entry.id, name: data.name ?? "Household", role: data.memberRoles?.[user.id] ?? "viewer", updatedAt: toIso(data.updatedAt) };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export async function createFirebaseHousehold(state: AppState, user: CloudUser) {
  const { db } = getFirebaseServices();
  const household = doc(collection(db, "households"));
  const batch = writeBatch(db);
  batch.set(household, {
    name: state.household.name,
    ownerUserId: user.id,
    memberIds: [user.id],
    editorIds: [user.id],
    memberRoles: { [user.id]: "owner" },
    memberProfiles: { [user.id]: { email: user.email ?? "", displayName: user.displayName ?? "" } },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  await saveFirebaseState(household.id, state);
  return household.id;
}

export async function listFirebaseHouseholdMembers(householdId: string): Promise<CloudHouseholdMember[]> {
  const entry = await getDoc(doc(getFirebaseServices().db, "households", householdId));
  if (!entry.exists()) return [];
  const data = entry.data() as HouseholdDocument;
  return Object.entries(data.memberRoles ?? {}).map(([userId, role]) => ({
    userId,
    role,
    email: data.memberProfiles?.[userId]?.email ?? "",
    displayName: data.memberProfiles?.[userId]?.displayName ?? ""
  })).sort((left, right) => (left.role === "owner" ? -1 : right.role === "owner" ? 1 : left.displayName.localeCompare(right.displayName)));
}

export async function listFirebaseHouseholdActivity(householdId: string): Promise<CloudActivity[]> {
  const snapshot = await getDocs(collection(getFirebaseServices().db, "households", householdId, "activity"));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as ActivityDocument;
    return {
      id: entry.id,
      householdId,
      action: data.action ?? "cloud_activity",
      actorName: data.actorName ?? "",
      actorEmail: data.actorEmail ?? "",
      details: data.details ?? {},
      createdAt: toIso(data.createdAt)
    };
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 12);
}

export async function listFirebaseInvites(householdId: string): Promise<CloudInvite[]> {
  const snapshot = await getDocs(collection(getFirebaseServices().db, "households", householdId, "invites"));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as InviteDocument;
    return {
      id: entry.id,
      householdId,
      code: inviteCode(householdId, entry.id),
      role: data.role,
      label: data.label ?? "",
      active: Boolean(data.active),
      expiresAt: toIso(data.expiresAt),
      createdAt: toIso(data.createdAt)
    };
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createFirebaseInvite(householdId: string, role: ShareRole, label: string): Promise<CloudInvite> {
  const { db } = getFirebaseServices();
  const user = await currentFirebaseUser();
  if (!user) throw new Error("Sign in before creating an invitation.");
  const id = randomInviteId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await setDoc(doc(db, "households", householdId, "invites", id), {
    role,
    label: label.trim(),
    active: true,
    createdBy: user.id,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt)
  });
  void recordFirebaseActivity(householdId, "invite_created", { role, label: label.trim() || "No note" });
  return { id, householdId, code: inviteCode(householdId, id), role, label: label.trim(), active: true, expiresAt: expiresAt.toISOString(), createdAt: new Date().toISOString() };
}

export async function revokeFirebaseInvite(householdId: string, inviteId: string) {
  await updateDoc(doc(getFirebaseServices().db, "households", householdId, "invites", inviteId), { active: false });
  void recordFirebaseActivity(householdId, "invite_revoked", {});
}

export async function listFirebaseJoinRequests(householdId: string): Promise<CloudJoinRequest[]> {
  const snapshot = await getDocs(collection(getFirebaseServices().db, "households", householdId, "joinRequests"));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as JoinRequestDocument;
    return {
      id: entry.id,
      householdId,
      userId: data.userId,
      email: data.email ?? "",
      displayName: data.displayName ?? "",
      role: data.role,
      inviteCode: data.inviteCode,
      requestedAt: toIso(data.requestedAt)
    };
  }).sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
}

export async function requestFirebaseHouseholdAccess(code: string, user: CloudUser) {
  const { householdId, inviteId } = parseInviteCode(code);
  const { db } = getFirebaseServices();
  const inviteRef = doc(db, "households", householdId, "invites", inviteId);
  const invite = await getDoc(inviteRef);
  if (!invite.exists()) throw new Error("That invitation was not found.");
  const inviteData = invite.data() as InviteDocument;
  if (!inviteData.active || !inviteData.expiresAt?.toDate || inviteData.expiresAt.toDate() <= new Date()) {
    throw new Error("That invitation has expired or was revoked.");
  }
  await setDoc(doc(db, "households", householdId, "joinRequests", user.id), {
    userId: user.id,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role: inviteData.role,
    inviteCode: inviteId,
    status: "pending",
    requestedAt: serverTimestamp()
  });
  return { householdId, role: inviteData.role };
}

export async function approveFirebaseJoinRequest(householdId: string, request: CloudJoinRequest) {
  const { db } = getFirebaseServices();
  const householdRef = doc(db, "households", householdId);
  const requestRef = doc(db, "households", householdId, "joinRequests", request.id);
  const inviteRef = doc(db, "households", householdId, "invites", request.inviteCode);
  await runTransaction(db, async (transaction) => {
    const [household, pendingRequest, invite] = await Promise.all([transaction.get(householdRef), transaction.get(requestRef), transaction.get(inviteRef)]);
    if (!household.exists() || !pendingRequest.exists() || !invite.exists()) throw new Error("The access request is no longer available.");
    const inviteData = invite.data() as InviteDocument;
    const requestData = pendingRequest.data() as JoinRequestDocument;
    if (!inviteData.active || inviteData.role !== requestData.role) throw new Error("The invitation is no longer valid.");
    transaction.update(householdRef, {
      memberIds: arrayUnion(requestData.userId),
      editorIds: editorRole(requestData.role) ? arrayUnion(requestData.userId) : arrayRemove(requestData.userId),
      [`memberRoles.${requestData.userId}`]: requestData.role,
      [`memberProfiles.${requestData.userId}`]: { email: requestData.email ?? "", displayName: requestData.displayName ?? "" },
      updatedAt: serverTimestamp()
    });
    transaction.update(inviteRef, { active: false, acceptedBy: requestData.userId, acceptedAt: serverTimestamp() });
    transaction.delete(requestRef);
  });
  void recordFirebaseActivity(householdId, "access_approved", { role: request.role, member: request.displayName || request.email || request.userId });
}

export async function rejectFirebaseJoinRequest(householdId: string, requestId: string) {
  await deleteDoc(doc(getFirebaseServices().db, "households", householdId, "joinRequests", requestId));
  void recordFirebaseActivity(householdId, "access_declined", {});
}

export async function updateFirebaseHouseholdMemberRole(householdId: string, member: CloudHouseholdMember, role: ShareRole) {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, "households", householdId), {
    editorIds: editorRole(role) ? arrayUnion(member.userId) : arrayRemove(member.userId),
    [`memberRoles.${member.userId}`]: role,
    updatedAt: serverTimestamp()
  });
  void recordFirebaseActivity(householdId, "member_role_changed", { role, member: member.displayName || member.email || member.userId });
}

export async function removeFirebaseHouseholdMember(householdId: string, member: CloudHouseholdMember) {
  if (member.role === "owner") throw new Error("The household owner cannot be removed here.");
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, "households", householdId), {
    memberIds: arrayRemove(member.userId),
    editorIds: arrayRemove(member.userId),
    [`memberRoles.${member.userId}`]: deleteField(),
    [`memberProfiles.${member.userId}`]: deleteField(),
    updatedAt: serverTimestamp()
  });
  void recordFirebaseActivity(householdId, "member_removed", { member: member.displayName || member.email || member.userId });
}

export async function saveFirebaseState(householdId: string, state: AppState) {
  const { db } = getFirebaseServices();
  const snapshotRef = doc(db, "households", householdId, "metadata", "snapshot");
  const existing = await getDoc(snapshotRef);
  const prepared = await prepareStateForCloud(state, householdId);
  const revision = Number(existing.data()?.revision ?? 0) + 1;
  const updatedAt = new Date().toISOString();
  await setDoc(snapshotRef, {
    state: removeUndefinedValues(prepared.state),
    revision,
    schemaVersion: 1,
    updatedAt: serverTimestamp()
  });
  await updateDoc(doc(db, "households", householdId), { updatedAt: serverTimestamp() });
  void recordFirebaseActivity(householdId, "cloud_backup_saved", { uploadedPhotos: prepared.uploadedPhotos, revision });
  return { revision, updatedAt, uploadedPhotos: prepared.uploadedPhotos };
}

export async function loadFirebaseState(householdId: string): Promise<CloudSnapshot | null> {
  const snapshot = await getDoc(doc(getFirebaseServices().db, "households", householdId, "metadata", "snapshot"));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as { state: unknown; revision?: number; updatedAt?: { toDate?: () => Date } };
  return { state: data.state, revision: Number(data.revision ?? 1), updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "" };
}

export function firebaseMediaPath(reference: string) {
  return reference.startsWith(FIREBASE_MEDIA_PREFIX) ? reference.slice(FIREBASE_MEDIA_PREFIX.length) : null;
}

export async function createFirebaseMediaUrl(reference: string) {
  const path = firebaseMediaPath(reference);
  if (!path) return reference;
  return getDownloadURL(ref(getFirebaseServices().storage, `household-media/${path}`));
}
