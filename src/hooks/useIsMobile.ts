"use client";

import { useEffect, useState } from "react";

/**
 * Hook to detect if the user is on a mobile/tablet device.
 * Returns true for screens smaller than 1024px (lg breakpoint).
 * 
 * @returns boolean - true if screen width < 1024px
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Initial check
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    // Check on mount
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}
