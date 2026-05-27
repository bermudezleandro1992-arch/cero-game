import { useEffect } from "react";

export function useLeaveOnTabClose(code: string, uid: string | undefined, leaveFn: (code: string, uid: string) => Promise<void>) {
  useEffect(() => {
    if (!uid || !code) return;

    const handleUnload = () => {
      void leaveFn(code, uid);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [code, uid, leaveFn]);
}
