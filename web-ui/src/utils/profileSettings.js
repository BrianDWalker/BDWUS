import { useEffect, useState } from "react";

const PROFILE_STORAGE_KEY = "bdwus.profile";
const PROFILE_EVENT_NAME = "bdwus-profile-settings-changed";

const DEFAULT_PROFILE = {
  name: "Brianna Walker",
  role: "Admin",
  jobTitle: "Platform Administrator",
  email: "brianna.walker@example.com",
  avatarUrl: ""
};

function readStoredProfile() {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  const raw = window.localStorage?.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return DEFAULT_PROFILE;
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function persistProfile(profile) {
  if (typeof window === "undefined") return profile;
  window.localStorage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT_NAME, { detail: profile }));
  return profile;
}

export function getProfileSettings() {
  return readStoredProfile();
}

export function saveProfileSettings(nextProfile) {
  const profile = { ...DEFAULT_PROFILE, ...nextProfile };
  return persistProfile(profile);
}

export function useProfileSettings() {
  const [profile, setProfileState] = useState(() => readStoredProfile());

  useEffect(() => {
    function handleProfileChange() {
      setProfileState(readStoredProfile());
    }

    window.addEventListener(PROFILE_EVENT_NAME, handleProfileChange);
    window.addEventListener("storage", handleProfileChange);
    return () => {
      window.removeEventListener(PROFILE_EVENT_NAME, handleProfileChange);
      window.removeEventListener("storage", handleProfileChange);
    };
  }, []);

  function setProfile(updater) {
    setProfileState(current => {
      const nextValue = typeof updater === "function" ? updater(current) : updater;
      const merged = { ...current, ...nextValue };
      persistProfile(merged);
      return merged;
    });
  }

  return [profile, setProfile];
}
