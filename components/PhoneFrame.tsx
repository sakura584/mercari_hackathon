"use client";

import { useEffect, useState, type ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 480px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  if (isMobile) {
    return <div className="phone-inner phone-inner--fullscreen">{children}</div>;
  }

  return (
    <div className="stage-bg">
      <div className="phone-frame">
        <div className="phone-inner">{children}</div>
      </div>
    </div>
  );
}
