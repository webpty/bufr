import { ArrowDown, ArrowUp } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { ComposedChart } from "@heroui-pro/react/composed-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { LineChart } from "@heroui-pro/react/line-chart";
import { RadialChart } from "@heroui-pro/react/radial-chart";
import { Segment } from "@heroui-pro/react/segment";
import { TrendChip } from "@heroui-pro/react/trend-chip";
import { Widget } from "@heroui-pro/react/widget";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, photoUrl } from "../api";
import { Face, StatusLine } from "../bits";
import { formatBar, formatCount, formatDuration, formatSize, formatSpeed, formatWhen, preferences } from "../format";
import { Header } from "../header";
import { useT } from "../i18n";
import { WaitingOverlay } from "../waiting";
import { PERIODS, type Me, type Overview as Data, type Period } from "../../shared/types";

const EVERY_MS = 10_000;
const PERIOD_KEY = "bufr.period";

// Five colours that can be told apart at a glance, in both themes.
const UPLOAD = "var(--accent)";
const DOWNLOAD = "var(--success)";
const COPIED = "var(--accent)";
const TOTAL = "var(--warning)";
const WAITING = "var(--warning)";

/** The period last chosen in this browser, remembered as a convenience. */
function savedPeriod(): Period {
  try {
    const saved = localStorage.getItem(PERIOD_KEY);
    if (saved && (PERIODS as string[]).includes(saved)) return saved as Period;
  } catch {
    // Private windows may refuse; the default will do.
  }
  return "day";
}

function savePeriod(period: Period) {
  try {
    localStorage.setItem(PERIOD_KEY, period);
  } catch {
    // Not remembered, which is fine.
  }
}

export default function Overview({ me, onSettings, onSignedOut }: { me: Me; onSettings: () => void; onSignedOut: () => void }) {
  const { t, language } = useT();
  const how = preferences(me, language);
  const [period, setPeriod] = useState<Period>(savedPeriod);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  // The Worker's clock less this device's, so "2 min ago" is right even
  // when the phone's clock is not.
  const skew = useRef(0);
  const [, tick] = useState(0);
  const signedOut = useRef(onSignedOut);
  signedOut.current = onSignedOut;

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const fresh = await api.overview(period, how.timeZone);
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
  }, [period, how.timeZone]);

  const now = new Date(Date.now() + skew.current);
  const shown = data?.period === period ? data : null;

  // The charts' rows: speeds in MB/s and waits in minutes, so the axes read
  // in round numbers; the tooltips put the units back.
  const rows = useMemo(
    () =>
      (shown?.points ?? []).map((p) => ({
        label: formatBar(p.at, shown!.unit, how),
        copied: p.copied,
        total: p.total,
        waiting: p.waiting,
        upload: p.upload === null ? null : p.upload / 1e6,
        download: p.download === null ? null : p.download / 1e6,
        wait: p.wait === null ? null : p.wait / 60,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, how.dateOrder, how.clock24h, how.timeZone, how.language],
  );
  const chartRows = rows as unknown as Record<string, number | string>[];

  const mbps = (v: number | string) => formatSpeed(Number(v) * 1e6, language);
  const speedTick = (v: number) =>
    new Intl.NumberFormat(language, { style: "unit", unit: "megabyte-per-second", unitDisplay: "short", maximumFractionDigits: 1 }).format(v);
  const minutes = (v: number | string) => (Number(v) === 0 ? "0" : formatDuration(Number(v) * 60, language));
  const count = (v: number | string) => formatCount(Number(v), language);

  const choose = (key: Period) => {
    setPeriod(key);
    savePeriod(key);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4">
      <Header
        left={<span className="text-xl font-semibold tracking-tight">bufr</span>}
        right={
          <Button variant="secondary" onPress={onSettings}>
            <Face name={me.name} email={me.email} url={photoUrl(me)} size={24} />
            {t("overview.settings")}
          </Button>
        }
      />

      <div className="-mx-1 overflow-x-auto px-1">
        <Segment aria-label={t("overview.period")} selectedKey={period} onSelectionChange={(key) => choose(key as Period)} className="min-w-max">
          {PERIODS.map((p) => (
            <Segment.Item key={p} id={p}>
              {t(`overview.period.${p}`)}
            </Segment.Item>
          ))}
        </Segment>
      </div>

      <StatusLine text={failed ? t("overview.notReached") : ""} tone="danger" />

      <div className="relative flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPI>
            <KPI.Header>
              <KPI.Title>{t("overview.waitingNow")}</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={shown?.waiting.count ?? 0} locale={language} maximumFractionDigits={0}>
                {(n) => (
                  <>
                    {n}
                    {shown && shown.waiting.bytes > 0 ? <Unit>{formatSize(shown.waiting.bytes, language)}</Unit> : null}
                  </>
                )}
              </KPI.Value>
              {shown && shown.waitingAtStart !== null && shown.waitingAtStart !== shown.waiting.count ? (
                // More waiting is not good news, so the chip stays grey
                // whichever way it went.
                <KPI.Trend trend="neutral">
                  <TrendChip.Indicator>{shown.waiting.count > shown.waitingAtStart ? <ArrowUp /> : <ArrowDown />}</TrendChip.Indicator>
                  {formatCount(Math.abs(shown.waiting.count - shown.waitingAtStart), language)}
                </KPI.Trend>
              ) : null}
            </KPI.Content>
            <KPI.Chart data={chartRows} dataKey="waiting" color={WAITING} height={56} areaProps={{ isAnimationActive: false }} />
          </KPI>

          <KPI>
            <KPI.Header>
              <KPI.Title>{t("overview.lastCheckIn")}</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <dd className="kpi__value tabular-nums">
                {shown ? (shown.lastCheckIn ? t("overview.ago", { time: formatDuration(Math.max(0, (now.getTime() - Date.parse(shown.lastCheckIn)) / 1000), language) }) : t("overview.never")) : ""}
              </dd>
            </KPI.Content>
            {shown?.lastCheckIn ? <p className="text-sm tabular-nums text-muted">{formatWhen(shown.lastCheckIn, how, now)}</p> : null}
          </KPI>

          <KPI>
            <KPI.Header>
              <KPI.Title>{t("overview.copied")}</KPI.Title>
            </KPI.Header>
            <KPI.Content>
              <KPI.Value value={shown?.copied.count ?? 0} locale={language} maximumFractionDigits={0}>
                {(n) => (
                  <>
                    {n}
                    {shown && shown.copied.bytes > 0 ? <Unit>{formatSize(shown.copied.bytes, language)}</Unit> : null}
                  </>
                )}
              </KPI.Value>
              <Change now={shown?.copied.count} before={shown?.copiedBefore?.count} language={language} />
            </KPI.Content>
            <KPI.Chart data={chartRows} dataKey="copied" color={COPIED} height={56} areaProps={{ isAnimationActive: false }} />
          </KPI>
        </dl>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Widget>
            <Widget.Header>
              <Widget.Title>{t("overview.speed")}</Widget.Title>
            </Widget.Header>
            <Widget.Content className="grid grid-cols-2 gap-2">
              <Dial label={t("overview.upload")} speed={shown?.upload.average ?? null} fastest={shown?.upload.fastest ?? null} color={UPLOAD} language={language} none={t("overview.nothingYet")} />
              <Dial label={t("overview.download")} speed={shown?.download.average ?? null} fastest={shown?.download.fastest ?? null} color={DOWNLOAD} language={language} none={t("overview.nothingYet")} />
            </Widget.Content>
          </Widget>

          <Widget>
            <Widget.Header>
              <Widget.Title>{t("overview.timeHere")}</Widget.Title>
            </Widget.Header>
            <Widget.Content className="flex flex-col gap-3">
              <dl className="grid grid-cols-3 gap-2">
                <Figure title={t("overview.average")}>{shown?.wait ? formatDuration(shown.wait.average, language) : t("overview.nothingYet")}</Figure>
                <Figure title={t("overview.shortest")}>{shown?.wait ? formatDuration(shown.wait.shortest, language) : ""}</Figure>
                <Figure title={t("overview.longest")}>{shown?.wait ? formatDuration(shown.wait.longest, language) : ""}</Figure>
              </dl>
              <AreaChart data={chartRows} height={120} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <AreaChart.Grid vertical={false} />
                <AreaChart.XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <AreaChart.YAxis tickLine={false} axisLine={false} width={64} tickFormatter={minutes} />
                <AreaChart.Tooltip content={<AreaChart.TooltipContent valueFormatter={minutes} />} />
                <AreaChart.Area
                  dataKey="wait"
                  name={t("overview.waitOverTime")}
                  type="monotone"
                  stroke={WAITING}
                  fill={WAITING}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                />
              </AreaChart>
            </Widget.Content>
          </Widget>
        </div>

        <Widget>
          <Widget.Header>
            <Widget.Title>{t("overview.speedOverTime")}</Widget.Title>
            <Widget.Legend>
              <Widget.LegendItem color={UPLOAD}>{t("overview.upload")}</Widget.LegendItem>
              <Widget.LegendItem color={DOWNLOAD}>{t("overview.download")}</Widget.LegendItem>
            </Widget.Legend>
          </Widget.Header>
          <Widget.Content>
            <LineChart data={chartRows} height={220}>
              <LineChart.Grid vertical={false} />
              <LineChart.XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <LineChart.YAxis tickLine={false} axisLine={false} width={72} tickFormatter={speedTick} />
              <LineChart.Tooltip content={<LineChart.TooltipContent valueFormatter={mbps} />} />
              <LineChart.Line dataKey="upload" name={t("overview.upload")} type="monotone" stroke={UPLOAD} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              <LineChart.Line dataKey="download" name={t("overview.download")} type="monotone" stroke={DOWNLOAD} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            </LineChart>
          </Widget.Content>
        </Widget>

        <Widget>
          <Widget.Header>
            <Widget.Title>{t("overview.copiedChart")}</Widget.Title>
            <span className="flex items-baseline gap-2 text-sm">
              <span className="text-muted">{t("overview.allTime")}</span>
              <span className="font-semibold tabular-nums">{shown ? formatCount(shown.total.count, language) : ""}</span>
              {shown && shown.total.bytes > 0 ? <span className="tabular-nums text-muted">{formatSize(shown.total.bytes, language)}</span> : null}
            </span>
          </Widget.Header>
          <Widget.Content>
            <ComposedChart data={chartRows} height={220}>
              <ComposedChart.Grid vertical={false} />
              <ComposedChart.XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <ComposedChart.YAxis yAxisId="bars" tickLine={false} axisLine={false} width={40} allowDecimals={false} tickFormatter={count} />
              <ComposedChart.YAxis yAxisId="total" orientation="right" tickLine={false} axisLine={false} width={48} allowDecimals={false} tickFormatter={count} />
              <ComposedChart.Tooltip content={<ComposedChart.TooltipContent valueFormatter={count} />} />
              <ComposedChart.Bar yAxisId="bars" dataKey="copied" name={t("overview.copiedBars")} fill={COPIED} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <ComposedChart.Line yAxisId="total" dataKey="total" name={t("overview.runningTotal")} type="monotone" stroke={TOTAL} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </Widget.Content>
          <Widget.Footer>
            <Widget.Legend>
              <Widget.LegendItem color={COPIED}>{t("overview.copiedBars")}</Widget.LegendItem>
              <Widget.LegendItem color={TOTAL}>{t("overview.runningTotal")}</Widget.LegendItem>
            </Widget.Legend>
          </Widget.Footer>
        </Widget>

        <WaitingOverlay on={!shown && !failed} label={t("overview.loading")} ground="page" />
      </div>
    </main>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-2 text-base font-normal text-muted">{children}</span>;
}

function Figure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-xs text-muted">{title}</dt>
      <dd className="min-h-6 truncate text-base font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** Up or down against the period before, as a share of it. */
function Change({ now, before, language }: { now?: number; before?: number; language: string }) {
  if (now === undefined || before === undefined || before === 0) return null;
  const change = (now - before) / before;
  const text = new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }).format(Math.abs(change));
  return <KPI.Trend trend={Math.abs(change) < 0.005 ? "neutral" : change > 0 ? "up" : "down"}>{text}</KPI.Trend>;
}

/** A speed on a dial whose full turn is the best hour of the last 30 days. */
function Dial({ label, speed, fastest, color, language, none }: { label: string; speed: number | null; fastest: number | null; color: string; language: string; none: string }) {
  const scale = Math.max(fastest ?? 0, speed ?? 0);
  const share = speed && scale ? Math.min(100, (speed / scale) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-col">
      <div className="relative">
        <RadialChart data={[{ value: share, fill: color }]} height={150} startAngle={210} endAngle={-30} innerRadius="80%" outerRadius="100%" barSize={12}>
          <RadialChart.AngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialChart.Bar dataKey="value" background cornerRadius={6} isAnimationActive={false} />
        </RadialChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className={speed ? "text-lg font-semibold tabular-nums" : "text-sm text-muted"}>{speed ? formatSpeed(speed, language) : none}</span>
          <span className="text-sm text-muted">{label}</span>
        </div>
      </div>
      <div className="-mt-6 flex justify-between px-2 text-xs tabular-nums text-muted">
        <span>0</span>
        <span>{scale ? formatSpeed(scale, language) : ""}</span>
      </div>
    </div>
  );
}
