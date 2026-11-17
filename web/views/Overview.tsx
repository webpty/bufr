import { Button } from "@heroui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, photoUrl } from "../api";
import { Card, Face, StatusLine } from "../bits";
import { formatDuration, formatSize, formatSpeed, formatWhen, preferences } from "../format";
import { Header } from "../header";
import { useT } from "../i18n";
import { WaitingOverlay } from "../waiting";
import type { Me, Overview as Data } from "../../shared/types";

const EVERY_MS = 10_000;

export default function Overview({ me, onSettings, onSignedOut }: { me: Me; onSettings: () => void; onSignedOut: () => void }) {
  const { t, language } = useT();
  const how = preferences(me, language);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  // The Worker's clock less this device's, so "waiting 12 min" is right even
  // when the phone's clock is not.
  const skew = useRef(0);
  const [, tick] = useState(0);
  const signedOut = useRef(onSignedOut);
  signedOut.current = onSignedOut;

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const fresh = await api.overview();
        if (!live) return;
        skew.current = Date.parse(fresh.now) - Date.now();
        setData(fresh);
        setFailed(false);
      } catch (error) {
        if (!live) return;
        if (error instanceof ApiError && error.status === 401) return signedOut.current();
        setFailed(true);
      }
      tick((n) => n + 1);
    }
    void load();
    const timer = setInterval(() => void load(), EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  const now = new Date(Date.now() + skew.current);
  const since = (at: string) => formatDuration(Math.max(0, (now.getTime() - Date.parse(at)) / 1000), language);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4">
      <Header
        left={<span className="text-xl font-semibold tracking-tight">bufr</span>}
        right={
          <Button variant="secondary" onPress={onSettings}>
            <Face name={me.name} email={me.email} url={photoUrl(me)} size={24} />
            {t("overview.settings")}
          </Button>
        }
      />

      <StatusLine text={failed ? t("overview.notReached") : ""} tone="danger" />

      <div className="relative flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Figure title={t("overview.lastCheckIn")}>
            {data?.lastCheckIn ? (
              <>
                {formatWhen(data.lastCheckIn, how, now)}
                <span className="text-base font-normal text-muted"> {t("overview.ago", { time: since(data.lastCheckIn) })}</span>
              </>
            ) : data ? (
              t("overview.never")
            ) : (
              ""
            )}
          </Figure>
          <Figure title={t("overview.speed")}>
            {data ? (data.bytesPerSecond ? formatSpeed(data.bytesPerSecond, language) : t("overview.noSpeed")) : ""}
          </Figure>
        </div>

        <List title={t("overview.waiting")} count={data?.waiting.length} none={t("overview.none")}>
          {data?.waiting.map((w, i) => (
            <Row
              key={`${w.name}-${w.added}-${i}`}
              name={w.name}
              details={[formatSize(w.size, language), t("overview.from", { sender: w.sender }), t("overview.waited", { time: since(w.added) })]}
            />
          ))}
        </List>

        <List title={t("overview.fetched")} count={data?.fetched.length} none={t("overview.none")}>
          {data?.fetched.map((f, i) => (
            <Row
              key={`${f.name}-${f.at}-${i}`}
              name={f.name}
              details={[
                formatWhen(f.at, how, now),
                formatSize(f.size, language),
                ...(f.seconds !== null ? [t("overview.took", { time: formatDuration(f.seconds, language) })] : []),
                t("overview.from", { sender: f.sender }),
              ]}
            />
          ))}
        </List>

        <WaitingOverlay on={!data && !failed} label={t("overview.waiting")} ground="page" />
      </div>
    </main>
  );
}

function Figure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-1">
      <h2 className="text-sm text-muted">{title}</h2>
      <p className="min-h-8 text-2xl font-semibold tabular-nums">{children}</p>
    </Card>
  );
}

function List({ title, count, none, children }: { title: string; count?: number; none: string; children: ReactNode }) {
  return (
    <Card className="gap-0 p-0">
      <h2 className="flex items-baseline justify-between px-4 pt-4 pb-2 font-semibold">
        {title}
        <span className="text-sm font-normal tabular-nums text-muted">{count ?? ""}</span>
      </h2>
      {count === 0 ? <p className="px-4 pb-4 text-muted">{none}</p> : <ul className="divide-y divide-border">{children}</ul>}
    </Card>
  );
}

function Row({ name, details }: { name: string; details: string[] }) {
  return (
    <li className="flex flex-col gap-0.5 px-4 py-3">
      <span className="truncate font-medium">{name}</span>
      <span className="text-sm tabular-nums text-muted">{details.join(" · ")}</span>
    </li>
  );
}
