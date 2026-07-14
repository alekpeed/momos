import type { AppState } from "@/lib/inventory-types";

export type CloudProvider = "firebase" | "supabase";

export type CloudUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
};

export type CloudAccountResult = {
  user: CloudUser | null;
  signedIn: boolean;
};

export type CloudHousehold = {
  id: string;
  name: string;
  role: CloudRole;
  updatedAt: string;
};

export type CloudRole = "owner" | "admin" | "helper" | "viewer";

export type CloudInvite = {
  id: string;
  householdId: string;
  code: string;
  role: Exclude<CloudRole, "owner">;
  label: string;
  active: boolean;
  expiresAt: string;
  createdAt: string;
};

export type CloudJoinRequest = {
  id: string;
  householdId: string;
  userId: string;
  email: string;
  displayName: string;
  role: Exclude<CloudRole, "owner">;
  inviteCode: string;
  requestedAt: string;
};

export type CloudHouseholdMember = {
  userId: string;
  email: string;
  displayName: string;
  role: CloudRole;
};

export type CloudActivity = {
  id: string;
  householdId: string;
  action: string;
  actorName: string;
  actorEmail: string;
  details: Record<string, string | number | boolean>;
  createdAt: string;
};

export type CloudSnapshot = {
  state: unknown;
  revision: number;
  updatedAt: string;
};

export type CloudSyncAdapter = {
  configured: () => boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<CloudAccountResult>;
  signIn: (email: string, password: string) => Promise<CloudUser | null>;
  signOut: () => Promise<void>;
  currentUser: () => Promise<CloudUser | null>;
  onAuthChange: (callback: (user: CloudUser | null) => void) => () => void;
  listHouseholds: () => Promise<CloudHousehold[]>;
  createHousehold: (state: AppState, user: CloudUser) => Promise<string>;
  saveState: (householdId: string, state: AppState) => Promise<{ revision: number; updatedAt: string; uploadedPhotos: number }>;
  loadState: (householdId: string) => Promise<CloudSnapshot | null>;
  mediaPath: (reference: string) => string | null;
  mediaUrl: (reference: string) => Promise<string>;
};
