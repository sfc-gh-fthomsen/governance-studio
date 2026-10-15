"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ConnectionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/connection/status")
      .then((res) => res.json())
      .then((data) => {
        if (!data.configured) {
          router.replace("/setup");
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        router.replace("/setup");
      });
  }, [router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        Checking connection...
      </div>
    );
  }

  return <>{children}</>;
}
