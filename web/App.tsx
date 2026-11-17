import { useEffect, useState } from "react";
import { Toast } from "@heroui/react";
import { api, ApiError } from "./api";
import { LanguageContext, languageFor } from "./i18n";
import Overview from "./views/Overview";
import Settings from "./views/Settings";
import SignIn from "./views/SignIn";
import type { Me } from "../shared/types";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  // The address bar is the truth, so the back gesture works.
  const [path, setPath] = useState(window.location.pathname);

  const language = languageFor(me);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function go(to: string) {
    window.history.pushState(null, "", to);
    setPath(to);
  }

  useEffect(() => {
    let live = true;
    api
      .me()
      .then(({ me }) => live && setMe(me))
      .catch((error) => {
        // Signed out is the sign-in page; anything else is said, not hidden.
        if (live && !(error instanceof ApiError && error.status === 401)) setUnreachable(true);
      })
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  function signedOut() {
    setMe(null);
    go("/");
  }

  function page() {
    if (!ready) return null;
    if (!me) {
      return (
        <SignIn
          unreachable={unreachable}
          onSignedIn={(person) => {
            setUnreachable(false);
            setMe(person);
            go("/");
          }}
        />
      );
    }
    if (path === "/settings") {
      return (
        <Settings
          me={me}
          onSaved={setMe}
          onBack={() => go("/")}
          onSignOut={() => void api.signOut().finally(signedOut)}
        />
      );
    }
    return <Overview me={me} onSettings={() => go("/settings")} onSignedOut={signedOut} />;
  }

  return (
    <LanguageContext.Provider value={language}>
      <Toast.Provider placement="top" />
      {page()}
    </LanguageContext.Provider>
  );
}
