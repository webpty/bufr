import { Button, Input, Label, Switch, TextField } from "@heroui/react";
import { ArrowLeft } from "@gravity-ui/icons";
import { useMemo, useRef, useState } from "react";
import { api, ApiError, photoUrl } from "../api";
import { Card, Confirm, Face, Picker, StatusLine } from "../bits";
import { preferences, sample, zones } from "../format";
import { Header } from "../header";
import { useT } from "../i18n";
import { countries, languageName } from "../locale";
import { PhotoCropper } from "../photo";
import { WaitingOverlay } from "../waiting";
import { LANGUAGES, type Language, type StringKey } from "../../shared/strings";
import { DATE_ORDERS, type DateOrder, type Me } from "../../shared/types";

/** Two cards and one Save, with a line beside it saying how it went. */
export default function Settings({
  me,
  onSaved,
  onBack,
  onSignOut,
}: {
  me: Me;
  onSaved: (me: Me) => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const { t, language: pageLanguage } = useT();
  const [name, setName] = useState(me.name);
  const [country, setCountry] = useState(me.country ?? "");
  // Until one is chosen here the browser's stands in, and is not sent, so a
  // default stays a default.
  const [language, setLanguage] = useState<Language>(pageLanguage);
  const [languageTouched, setLanguageTouched] = useState(false);
  const [dateOrder, setDateOrder] = useState<DateOrder>(me.dateOrder);
  const [clock24h, setClock24h] = useState(me.clock24h);
  const [timeZone, setTimeZone] = useState(me.timeZone);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ key: StringKey | null; tone: "muted" | "danger" }>({ key: null, tone: "muted" });
  const [picked, setPicked] = useState<File | null>(null);
  const [asking, setAsking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The samples and the country names are in the language being chosen, so
  // the choice can be judged by looking.
  const how = preferences({ ...me, dateOrder, clock24h, timeZone }, language);
  const countryList = useMemo(() => countries(language), [language]);
  const zoneList = useMemo(() => zones().map((zone) => ({ id: zone, label: zone.replace(/_/g, " ") })), []);

  const changed =
    name !== me.name ||
    country !== (me.country ?? "") ||
    languageTouched ||
    dateOrder !== me.dateOrder ||
    clock24h !== me.clock24h ||
    timeZone !== me.timeZone;

  async function run(job: () => Promise<{ me: Me }>, done: StringKey, failed: StringKey) {
    setBusy(true);
    setSaid({ key: null, tone: "muted" });
    try {
      const { me: fresh } = await job();
      onSaved(fresh);
      setSaid({ key: done, tone: "muted" });
      return fresh;
    } catch (error) {
      setSaid({ key: error instanceof ApiError ? error.key : failed, tone: "danger" });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const fresh = await run(
      () =>
        api.saveSettings({
          name,
          country: country || null,
          ...(languageTouched ? { language } : {}),
          dateOrder,
          clock24h,
          timeZone,
        }),
      "settings.saved",
      "error.couldNotSave",
    );
    if (fresh) setLanguageTouched(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4">
      <Header
        left={
          <>
            <Button isIconOnly variant="secondary" aria-label={t("settings.back")} onPress={onBack}>
              <ArrowLeft />
            </Button>
            <h1 className="truncate text-xl font-semibold">{t("settings.title")}</h1>
          </>
        }
        right={
          <Button variant="secondary" isDisabled={busy} onPress={onSignOut}>
            {t("settings.signOut")}
          </Button>
        }
      />

      <div className="relative flex flex-col gap-4">
        <Card>
          <h2 className="font-semibold">{t("settings.you")}</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Face name={name} email={me.email} url={photoUrl(me)} size={72} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" isDisabled={busy} onPress={() => fileInput.current?.click()}>
                {t("settings.changePhoto")}
              </Button>
              {me.photo && (
                <Button variant="danger-soft" isDisabled={busy} onPress={() => setAsking(true)}>
                  {t("settings.removePhoto")}
                </Button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) setPicked(file);
              }}
            />
          </div>

          <TextField fullWidth name="name" value={name} onChange={setName} isDisabled={busy} variant="secondary">
            <Label>{t("settings.name")}</Label>
            <Input autoComplete="name" />
          </TextField>

          <TextField fullWidth isDisabled name="email" value={me.email} variant="secondary">
            <Label>{t("settings.email")}</Label>
            <Input />
          </TextField>

          <Picker
            label={t("settings.country")}
            value={country}
            isDisabled={busy}
            items={[{ id: "", label: t("settings.notSet") }, ...countryList.map((c) => ({ id: c.code, label: c.name }))]}
            onChange={setCountry}
          />
        </Card>

        <Card>
          <h2 className="font-semibold">{t("settings.languageAndTime")}</h2>
          <Picker
            label={t("settings.language")}
            value={language}
            isDisabled={busy}
            items={LANGUAGES.map((code) => ({ id: code, label: languageName(code) }))}
            onChange={(value) => {
              setLanguage(value as Language);
              setLanguageTouched(true);
            }}
          />
          <Picker
            label={t("settings.dateOrder")}
            value={dateOrder}
            isDisabled={busy}
            items={DATE_ORDERS.map((order) => ({ id: order, label: sample(order, how) }))}
            onChange={(value) => setDateOrder(value as DateOrder)}
          />
          <Picker label={t("settings.timeZone")} value={timeZone} isDisabled={busy} items={zoneList} onChange={setTimeZone} />
          <Switch className="w-full" isSelected={clock24h} isDisabled={busy} onChange={setClock24h}>
            <Switch.Content className="flex w-full items-center justify-between">
              {t("settings.clock24h")}
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </Card>

        <WaitingOverlay on={busy} label={t("settings.save")} ground="page" />
      </div>

      <div className="flex items-center gap-3">
        <Button isDisabled={!changed || busy} onPress={() => void save()}>
          {t("settings.save")}
        </Button>
        <StatusLine text={said.key ? t(said.key) : ""} tone={said.tone} />
      </div>

      {/* The build's own number. */}
      <p className="pt-4 text-right text-xs tabular-nums text-muted">{__VERSION__}</p>

      <Confirm
        isOpen={asking}
        title={t("settings.removePhotoAsk")}
        confirmLabel={t("settings.remove")}
        keepLabel={t("settings.keep")}
        onConfirm={() => {
          setAsking(false);
          void run(() => api.removePhoto(), "settings.photoRemoved", "error.couldNotSave");
        }}
        onClose={() => setAsking(false)}
      />

      {picked && (
        <PhotoCropper
          file={picked}
          onClose={() => setPicked(null)}
          onError={() => {
            setPicked(null);
            setSaid({ key: "error.photoNotRead", tone: "danger" });
          }}
          onCut={(blob) => {
            setPicked(null);
            void run(() => api.savePhoto(blob), "settings.photoChanged", "error.photoNotTaken");
          }}
        />
      )}
    </main>
  );
}
