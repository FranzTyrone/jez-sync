"use client";

import { createContext, useContext, useState } from "react";

type ProfileImageCtx = {
  liveImage: string | null;
  setLiveImage: (url: string | null) => void;
};

const ProfileImageContext = createContext<ProfileImageCtx>({
  liveImage: null,
  setLiveImage: () => {},
});

export function ProfileImageProvider({ children }: { children: React.ReactNode }) {
  const [liveImage, setLiveImage] = useState<string | null>(null);
  return (
    <ProfileImageContext.Provider value={{ liveImage, setLiveImage }}>
      {children}
    </ProfileImageContext.Provider>
  );
}

export function useProfileImage() {
  return useContext(ProfileImageContext);
}
