import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured } from "../firebase";
import { getFirestoreErrorMessage } from "../services/firestoreErrors";

export function useTrackerCloudSync({
  phase,
  assets,
  liabilities,
  incomes,
  expenses,
  goals,
  snapshots,
  activeNav,
  setPhase,
  setAssets,
  setLiabilities,
  setIncomes,
  setExpenses,
  setGoals,
  setSnapshots,
  setActiveNav,
  resetTrackerState,
}) {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const saveTimeoutRef = useRef(null);

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError("Firebase is not configured. Add values in .env.local (see .env.example).");
      return;
    }

    try {
      setSignInBusy(true);
      setAuthError("");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError("Google sign-in failed. Please try again.");
    } finally {
      setSignInBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      resetTrackerState();
    } catch (error) {
      setAuthError("Unable to sign out right now. Please retry.");
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      setAuthError("");

      if (!user) {
        setCloudHydrated(false);
        setCloudLoading(false);
        resetTrackerState();
        return;
      }

      setCloudLoading(true);
      try {
        const userDocRef = doc(db, "wealthtrackerUsers", user.uid);
        const snapshot = await getDoc(userDocRef);

        if (snapshot.exists()) {
          const cloud = snapshot.data();
          setPhase(cloud.phase === "app" ? "app" : "onboarding");
          setAssets(Array.isArray(cloud.assets) ? cloud.assets : []);
          setLiabilities(Array.isArray(cloud.liabilities) ? cloud.liabilities : []);
          setIncomes(Array.isArray(cloud.incomes) ? cloud.incomes : []);
          setExpenses(Array.isArray(cloud.expenses) ? cloud.expenses : []);
          setGoals(Array.isArray(cloud.goals) ? cloud.goals : []);
          setSnapshots(Array.isArray(cloud.snapshots) ? cloud.snapshots : []);
          setActiveNav(typeof cloud.activeNav === "string" ? cloud.activeNav : "dashboard");
        } else {
          resetTrackerState();
          await setDoc(
            userDocRef,
            {
              phase: "onboarding",
              assets: [],
              liabilities: [],
              incomes: [],
              expenses: [],
              goals: [],
              snapshots: [],
              activeNav: "dashboard",
              darkMode: true,
              profile: {
                email: user.email || null,
                displayName: user.displayName || null,
              },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Firestore load failed:", error);
        setAuthError(getFirestoreErrorMessage(error, "Cloud read/write failed. Check Firestore setup and rules."));
        resetTrackerState();
      } finally {
        setCloudLoading(false);
        setCloudHydrated(true);
      }
    });

    return () => unsubscribe();
  }, [resetTrackerState, setPhase, setAssets, setLiabilities, setIncomes, setExpenses, setGoals, setSnapshots, setActiveNav]);

  useEffect(() => {
    if (!authUser || !cloudHydrated || !db) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    let active = true;

    saveTimeoutRef.current = setTimeout(() => {
      const sync = async () => {
        try {
          const userDocRef = doc(db, "wealthtrackerUsers", authUser.uid);
          await setDoc(
            userDocRef,
            {
              phase,
              assets,
              liabilities,
              incomes,
              expenses,
              goals,
              snapshots,
              activeNav,
              darkMode: true,
              profile: {
                email: authUser.email || null,
                displayName: authUser.displayName || null,
              },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          if (active) {
            setAuthError("");
          }
        } catch (error) {
          console.error("Firestore sync failed:", error);
          if (active) {
            setAuthError(getFirestoreErrorMessage(error, "Cloud sync failed. Check Firestore rules or internet connection."));
          }
        }
      };

      sync();
    }, 300);

    return () => {
      active = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [authUser, cloudHydrated, phase, assets, liabilities, incomes, expenses, goals, snapshots, activeNav]);

  return {
    authUser,
    authLoading,
    cloudLoading,
    cloudHydrated,
    signInBusy,
    authError,
    handleGoogleSignIn,
    handleSignOut,
  };
}
