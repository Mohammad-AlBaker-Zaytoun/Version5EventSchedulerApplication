import { getAdminDb } from '@/lib/firebase/admin';
import type { UserProfile } from '@/lib/types';
import { normalizeEmail, nowIso } from '@/lib/events/utils';

const USERS_COLLECTION = 'users';
const INVITATIONS_COLLECTION = 'eventInvitations';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getAdminDb().collection(USERS_COLLECTION).doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

async function linkPendingInvitations(profile: UserProfile): Promise<void> {
  const pendingSnapshot = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('normalizedInviteeEmail', '==', profile.normalizedEmail)
    .get();

  if (pendingSnapshot.empty) {
    return;
  }

  const batch = getAdminDb().batch();
  const now = nowIso();

  for (const doc of pendingSnapshot.docs) {
    const invitation = doc.data() as { inviteeUid?: string };
    if (invitation.inviteeUid) {
      continue;
    }

    batch.set(
      doc.ref,
      {
        inviteeUid: profile.uid,
        inviteeName: profile.displayName,
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  await batch.commit();
}

export async function upsertUserProfile(input: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}): Promise<UserProfile> {
  const now = nowIso();
  const normalizedEmail = normalizeEmail(input.email);
  const docRef = getAdminDb().collection(USERS_COLLECTION).doc(input.uid);
  const snapshot = await docRef.get();

  const nextProfile: UserProfile = snapshot.exists
    ? {
        ...(snapshot.data() as UserProfile),
        email: input.email,
        normalizedEmail,
        displayName: input.displayName,
        photoURL: input.photoURL,
        updatedAt: now,
        lastLoginAt: now,
      }
    : {
        uid: input.uid,
        email: input.email,
        normalizedEmail,
        displayName: input.displayName,
        photoURL: input.photoURL,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };

  await docRef.set(nextProfile, { merge: true });
  await linkPendingInvitations(nextProfile);

  return nextProfile;
}
