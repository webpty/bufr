import { Button, Input, InputOTP, Label, TextField } from "@heroui/react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { StatusLine } from "../bits";
import { Header } from "../header";
import { browserLanguage, useT } from "../i18n";
import { WaitingOverlay } from "../waiting";
import type { Me } from "../../shared/types";
import type { StringKey } from "../../shared/strings";

/** Two steps: an address, then the six digits sent to it. Nothing here says
    what the site is; anybody who lands on it learns nothing. */
export default function SignIn({ unreachable, onSignedIn }: { unreachable: boolean; onSignedIn: (me: Me) => void }) {
  const { t } = useT();
  const [step, setStep] = useState<"address" | "code">("address");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<StringKey | null>(unreachable ? "error.noConnection" : null);

  useEffect(() => setSaid(unreachable ? "error.noConnection" : null), [unreachable]);

  const complain = (error: unknown, fallback: StringKey) => setSaid(error instanceof ApiError ? error.key : fallback);
  const canSend = /\S+@\S+\.\S+/.test(email.trim()) && !busy;

  async function askForCode() {
    if (!canSend) return;
    setBusy(true);
    setSaid(null);
    try {
      await api.askForCode(email.trim(), browserLanguage());
      setCode("");
      setStep("code");
    } catch (error) {
      complain(error, "error.couldNotSendCode");
    } finally {
      setBusy(false);
    }
  }

  async function signIn(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      onSignedIn((await api.signIn(email.trim(), value)).me);
    } catch (error) {
      setCode("");
      complain(error, "error.couldNotSignIn");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col">
      <Header />
      <div className="flex flex-1 flex-col justify-center pb-24">
        <div className="relative flex flex-col gap-4 rounded-[var(--radius)]">
          {step === "address" ? (
            <>
              <TextField fullWidth name="email" type="email" value={email} onChange={setEmail} isDisabled={busy} variant="secondary">
                <Label>{t("signIn.email")}</Label>
                <Input
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void askForCode();
                  }}
                />
              </TextField>
              <Button fullWidth isDisabled={!canSend} onPress={() => void askForCode()}>
                {t("signIn.sendCode")}
              </Button>
            </>
          ) : (
            <>
              {/* A code, not a password: no saved password is offered here. */}
              <InputOTP
                aria-label={t("signIn.code")}
                autoFocus
                maxLength={6}
                name="one-time-code"
                value={code}
                autoComplete="one-time-code"
                inputMode="numeric"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-form-type="other"
                isDisabled={busy}
                onChange={setCode}
                onComplete={(value) => void signIn(value)}
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group>
                  <InputOTP.Slot index={3} />
                  <InputOTP.Slot index={4} />
                  <InputOTP.Slot index={5} />
                </InputOTP.Group>
              </InputOTP>
              <Button fullWidth isDisabled={code.length !== 6 || busy} onPress={() => void signIn(code)}>
                {t("signIn.signIn")}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                isDisabled={busy}
                onPress={() => {
                  setStep("address");
                  setCode("");
                  setSaid(null);
                }}
              >
                {t("signIn.otherAddress")}
              </Button>
            </>
          )}
          <StatusLine text={said ? t(said) : ""} tone="danger" />
          <WaitingOverlay on={busy} label={t(step === "address" ? "signIn.sendCode" : "signIn.signIn")} ground="page" />
        </div>
      </div>
    </main>
  );
}
