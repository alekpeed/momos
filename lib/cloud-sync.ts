import type { User } from "@supabase/supabase-js";
import type { AppState } from "@/lib/inventory-types";
import { getSupabaseClient } from "@/lib/supabase/client";

export const CLOUD_HOUSEHOLD_KEY = "mom-home-cloud-household-v1";
export const CLOUD_MEDIA_PREFIX = "supabase-private://household-media/";

export type CloudHousehold = {
  id: string;
  name: string;
  role: "owner" | "admin" | "helper" | "viewer";
  updatedAt: string;
};

export type CloudSnapshot = {
  state: unknown;
  revision: number;
  updatedAt: string;
};

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
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

async function uploadDataUrl(
  dataUrl: string | undefined,
  householdId: string,
  group: string,
  recordId: string,
  field: string
) {
  if (!dataUrl?.startsWith("data:")) return dataUrl;

  const client = getSupabaseClient();
  const blob = dataUrlToBlob(dataUrl);
  const path = [
    householdId,
    safePathPart(group),
    safePathPart(recordId),
    `${safePathPart(field)}.${extensionForMimeType(blob.type)}`
  ].join("/");
  const { error } = await client.storage.from("household-media").upload(path, blob, {
    contentType: blob.type,
    upsert: true
  });
  if (error) throw error;
  return `${CLOUD_MEDIA_PREFIX}${path}`;
}

async function prepareStateForCloud(input: AppState, cloudHouseholdId: string) {
  const state = JSON.parse(JSON.stringify(input)) as AppState;
  let uploadedPhotos = 0;

  async function replace(
    current: string | undefined,
    group: string,
    recordId: string,
    field: string,
    apply: (value: string | undefined) => void
  ) {
    const next = await uploadDataUrl(current, cloudHouseholdId, group, recordId, field);
    if (current?.startsWith("data:") && next !== current) uploadedPhotos += 1;
    apply(next);
  }

  for (const item of state.items) {
    await replace(item.photoUrl, "items", item.id, "photo", (value) => { item.photoUrl = value; });
  }
  for (const location of state.locations) {
    await replace(location.photoUrl, "locations", location.id, "photo", (value) => { location.photoUrl = value; });
  }
  for (const container of state.containers) {
    await replace(container.outsidePhotoUrl, "containers", container.id, "outside", (value) => { container.outsidePhotoUrl = value; });
    await replace(container.insidePhotoUrl, "containers", container.id, "inside", (value) => { container.insidePhotoUrl = value; });
  }
  for (const purchase of state.purchaseRecords) {
    await replace(purchase.receiptPhotoUrl, "receipts", purchase.id, "receipt", (value) => { purchase.receiptPhotoUrl = value; });
  }
  for (const supplement of state.supplementItems) {
    await replace(supplement.bottlePhotoUrl, "supplements", supplement.id, "bottle", (value) => { supplement.bottlePhotoUrl = value; });
  }

  return { state, uploadedPhotos };
}

export async function signUpForCloud(email: string, password: string, displayName: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) throw error;
  return data;
}

export async function signInToCloud(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutOfCloud() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function currentCloudUser(): Promise<User | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function listCloudHouseholds(): Promise<CloudHousehold[]> {
  const { data, error } = await getSupabaseClient()
    .from("household_members")
    .select("household_id, role, households!inner(id, name, updated_at)")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((membership) => {
    const household = membership.households as unknown as { id: string; name: string; updated_at: string };
    return {
      id: household.id,
      name: household.name,
      role: membership.role as CloudHousehold["role"],
      updatedAt: household.updated_at
    };
  });
}

export async function createCloudHousehold(state: AppState, user: Pick<User, "id">) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("households")
    .insert({ name: state.household.name, owner_user_id: user.id })
    .select("id, name, updated_at")
    .single();
  if (error) throw error;

  await saveCloudState(data.id, state);
  return data.id as string;
}

export async function saveCloudState(cloudHouseholdId: string, state: AppState) {
  const client = getSupabaseClient();
  const user = await currentCloudUser();
  if (!user) throw new Error("Sign in before saving to the cloud.");

  const prepared = await prepareStateForCloud(state, cloudHouseholdId);
  const { data, error } = await client.rpc("save_household_snapshot", {
    target_household_id: cloudHouseholdId,
    target_state: prepared.state,
    target_schema_version: 1
  });
  if (error) throw error;

  await client.from("household_activity").insert({
    household_id: cloudHouseholdId,
    actor_user_id: user.id,
    action: "cloud_backup_saved",
    details: { uploaded_photos: prepared.uploadedPhotos }
  });

  const snapshot = (Array.isArray(data) ? data[0] : data) as { revision: number; updated_at: string } | null;
  return {
    revision: snapshot?.revision ?? 1,
    updatedAt: snapshot?.updated_at ?? new Date().toISOString(),
    uploadedPhotos: prepared.uploadedPhotos
  };
}

export async function loadCloudState(cloudHouseholdId: string): Promise<CloudSnapshot | null> {
  const { data, error } = await getSupabaseClient()
    .from("household_snapshots")
    .select("state, revision, updated_at")
    .eq("household_id", cloudHouseholdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { state: data.state, revision: data.revision, updatedAt: data.updated_at };
}

export function cloudMediaPath(reference: string) {
  return reference.startsWith(CLOUD_MEDIA_PREFIX) ? reference.slice(CLOUD_MEDIA_PREFIX.length) : null;
}

export async function createCloudMediaUrl(reference: string) {
  const path = cloudMediaPath(reference);
  if (!path) return reference;
  const { data, error } = await getSupabaseClient().storage.from("household-media").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
