export function getFirestoreErrorMessage(error, fallbackMessage) {
  const code = String(error?.code || "").toLowerCase();

  if (code.includes("permission-denied")) {
    return "Cloud sync blocked by Firestore rules. Allow read/write for wealthtrackerUsers/{uid} where request.auth.uid == uid.";
  }

  if (code.includes("failed-precondition")) {
    return "Firestore is not initialized. Create a Firestore database in Firebase Console.";
  }

  if (code.includes("unavailable")) {
    return "Cloud sync unavailable. Check your internet connection and retry.";
  }

  return fallbackMessage;
}
