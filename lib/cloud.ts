import type { AppState } from "@/lib/inventory-types";
import type { CloudAccountResult, CloudActivity, CloudHousehold, CloudHouseholdMember, CloudInvite, CloudJoinRequest, CloudProvider, CloudRole, CloudSnapshot, CloudUser } from "@/lib/cloud-types";
import {
  CLOUD_HOUSEHOLD_KEY,
  cloudMediaPath as supabaseMediaPath,
  createCloudHousehold as createSupabaseHousehold,
  createCloudMediaUrl as createSupabaseMediaUrl,
  currentCloudUser as currentSupabaseUser,
  listCloudHouseholds as listSupabaseHouseholds,
  loadCloudState as loadSupabaseState,
  saveCloudState as saveSupabaseState,
  signInToCloud as signInToSupabase,
  signOutOfCloud as signOutOfSupabase,
  signUpForCloud as signUpForSupabase
} from "@/lib/cloud-sync";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { firebaseConfigurationStatus } from "@/lib/firebase/client";
import {
  createFirebaseHousehold,
  createFirebaseInvite,
  createFirebaseMediaUrl,
  currentFirebaseUser,
  firebaseMediaPath,
  approveFirebaseJoinRequest,
  isFirebaseCloudConfigured,
  listFirebaseHouseholdActivity,
  listFirebaseHouseholdMembers,
  listFirebaseHouseholds,
  listFirebaseInvites,
  listFirebaseJoinRequests,
  loadFirebaseState,
  onFirebaseAuthChange,
  rejectFirebaseJoinRequest,
  removeFirebaseHouseholdMember,
  requestFirebaseHouseholdAccess,
  revokeFirebaseInvite,
  saveFirebaseState,
  sendFirebasePasswordReset,
  signInToFirebase,
  signOutOfFirebase,
  signUpForFirebase,
  updateFirebaseHouseholdMemberRole
} from "@/lib/firebase/cloud-sync";

export { CLOUD_HOUSEHOLD_KEY };
export type { CloudHousehold, CloudHouseholdMember, CloudInvite, CloudJoinRequest, CloudActivity, CloudRole, CloudSnapshot, CloudUser };

function configuredProvider(): CloudProvider {
  const requested = process.env.NEXT_PUBLIC_CLOUD_PROVIDER?.trim().toLowerCase();
  if (requested === "firebase" || requested === "supabase") return requested;
  return isFirebaseCloudConfigured() ? "firebase" : "supabase";
}

export function activeCloudProviderName() {
  return configuredProvider() === "firebase" ? "Firebase" : "Supabase";
}

export function cloudConfigurationStatus() {
  const provider = configuredProvider();
  if (provider === "firebase") {
    return { provider, providerName: "Firebase", ...firebaseConfigurationStatus() };
  }
  return { provider, providerName: "Supabase", configured: isSupabaseConfigured(), missing: isSupabaseConfigured() ? [] : ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] };
}

export function isCloudConfigured() {
  return configuredProvider() === "firebase" ? isFirebaseCloudConfigured() : isSupabaseConfigured();
}

export function supportsCloudHelperAccess() {
  return configuredProvider() === "firebase";
}

function helperAccessUnavailable(): never {
  throw new Error("Shared household access is currently available when Cloud protection uses Firebase.");
}

export async function signUpForCloud(email: string, password: string, displayName: string): Promise<CloudAccountResult> {
  if (configuredProvider() === "firebase") return signUpForFirebase(email, password, displayName);
  const result = await signUpForSupabase(email, password, displayName);
  return { user: result.user, signedIn: Boolean(result.session) };
}

export async function signInToCloud(email: string, password: string): Promise<CloudUser | null> {
  if (configuredProvider() === "firebase") return signInToFirebase(email, password);
  return (await signInToSupabase(email, password)).user;
}

export async function requestCloudPasswordReset(email: string) {
  if (configuredProvider() === "firebase") return sendFirebasePasswordReset(email);
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function signOutOfCloud() {
  return configuredProvider() === "firebase" ? signOutOfFirebase() : signOutOfSupabase();
}

export async function currentCloudUser(): Promise<CloudUser | null> {
  return configuredProvider() === "firebase" ? currentFirebaseUser() : currentSupabaseUser();
}

export function onCloudAuthChange(callback: (user: CloudUser | null) => void) {
  if (configuredProvider() === "firebase") return onFirebaseAuthChange(callback);
  const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function listCloudHouseholds(): Promise<CloudHousehold[]> {
  return configuredProvider() === "firebase" ? listFirebaseHouseholds() : listSupabaseHouseholds();
}

export async function createCloudHousehold(state: AppState, user: CloudUser) {
  return configuredProvider() === "firebase" ? createFirebaseHousehold(state, user) : createSupabaseHousehold(state, user);
}

export async function saveCloudState(householdId: string, state: AppState) {
  return configuredProvider() === "firebase" ? saveFirebaseState(householdId, state) : saveSupabaseState(householdId, state);
}

export async function loadCloudState(householdId: string): Promise<CloudSnapshot | null> {
  return configuredProvider() === "firebase" ? loadFirebaseState(householdId) : loadSupabaseState(householdId);
}

export async function listCloudHouseholdMembers(householdId: string): Promise<CloudHouseholdMember[]> {
  return configuredProvider() === "firebase" ? listFirebaseHouseholdMembers(householdId) : helperAccessUnavailable();
}

export async function listCloudHouseholdActivity(householdId: string): Promise<CloudActivity[]> {
  return configuredProvider() === "firebase" ? listFirebaseHouseholdActivity(householdId) : helperAccessUnavailable();
}

export async function listCloudInvites(householdId: string): Promise<CloudInvite[]> {
  return configuredProvider() === "firebase" ? listFirebaseInvites(householdId) : helperAccessUnavailable();
}

export async function createCloudInvite(householdId: string, role: Exclude<CloudRole, "owner">, label: string): Promise<CloudInvite> {
  return configuredProvider() === "firebase" ? createFirebaseInvite(householdId, role, label) : helperAccessUnavailable();
}

export async function revokeCloudInvite(householdId: string, inviteId: string) {
  return configuredProvider() === "firebase" ? revokeFirebaseInvite(householdId, inviteId) : helperAccessUnavailable();
}

export async function requestCloudHouseholdAccess(code: string, user: CloudUser) {
  return configuredProvider() === "firebase" ? requestFirebaseHouseholdAccess(code, user) : helperAccessUnavailable();
}

export async function listCloudJoinRequests(householdId: string): Promise<CloudJoinRequest[]> {
  return configuredProvider() === "firebase" ? listFirebaseJoinRequests(householdId) : helperAccessUnavailable();
}

export async function approveCloudJoinRequest(householdId: string, request: CloudJoinRequest) {
  return configuredProvider() === "firebase" ? approveFirebaseJoinRequest(householdId, request) : helperAccessUnavailable();
}

export async function rejectCloudJoinRequest(householdId: string, requestId: string) {
  return configuredProvider() === "firebase" ? rejectFirebaseJoinRequest(householdId, requestId) : helperAccessUnavailable();
}

export async function updateCloudHouseholdMemberRole(householdId: string, member: CloudHouseholdMember, role: Exclude<CloudRole, "owner">) {
  return configuredProvider() === "firebase" ? updateFirebaseHouseholdMemberRole(householdId, member, role) : helperAccessUnavailable();
}

export async function removeCloudHouseholdMember(householdId: string, member: CloudHouseholdMember) {
  return configuredProvider() === "firebase" ? removeFirebaseHouseholdMember(householdId, member) : helperAccessUnavailable();
}

export function cloudMediaPath(reference: string) {
  return configuredProvider() === "firebase" ? firebaseMediaPath(reference) : supabaseMediaPath(reference);
}

export async function createCloudMediaUrl(reference: string) {
  return configuredProvider() === "firebase" ? createFirebaseMediaUrl(reference) : createSupabaseMediaUrl(reference);
}
