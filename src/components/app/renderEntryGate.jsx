import LoadingScreen from "../auth/LoadingScreen";
import LoginScreen from "../auth/LoginScreen";
import OnboardingScreen from "../onboarding/OnboardingScreen";

export function renderEntryGate({
  authLoading,
  isFirebaseConfigured,
  handleGoogleSignIn,
  signInBusy,
  authError,
  authUser,
  cloudLoading,
  cloudHydrated,
  phase,
  isMobile,
  syncMessage,
  onStart,
}) {
  if (authLoading) {
    return <LoadingScreen title="Checking login..." detail="Verifying your Google session." />;
  }

  if (!isFirebaseConfigured) {
    return (
      <LoginScreen
        onLogin={handleGoogleSignIn}
        busy={signInBusy}
        error={authError}
        configError="Firebase config is missing. Create .env.local from .env.example and restart the app."
      />
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={handleGoogleSignIn} busy={signInBusy} error={authError} />;
  }

  if (cloudLoading && !cloudHydrated) {
    return <LoadingScreen title="Loading your data..." detail="Fetching your profile from cloud storage." />;
  }

  if (phase === "onboarding") {
    return (
      <OnboardingScreen
        isMobile={isMobile}
        hasSyncMessage={Boolean(syncMessage)}
        syncStatusText={syncMessage?.text || ""}
        syncStatusColor={syncMessage?.color || "#dc2626"}
        syncStatusBg={syncMessage?.background || "rgba(220, 38, 38, 0.12)"}
        syncStatusBorder={syncMessage?.border || "rgba(220, 38, 38, 0.35)"}
        onStart={onStart}
      />
    );
  }

  return null;
}
