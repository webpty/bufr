// What a person may change about themselves, and their photo.

import { isLanguage } from "../../shared/strings";
import { DATE_ORDERS, type Me, type SettingsPatch } from "../../shared/types";
import { Refused, type User } from "./model";
import type { AvatarStore, Random, UserStore } from "./ports";
import { toBase64Url } from "./secrets";

/** Already square and small: the browser cuts and shrinks it first. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_LIMIT = 1_000_000;
/** Apart from the waiting photos, in the same bucket. */
const AVATARS = "media/avatars/";

export function toMe(user: User): Me {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    photo: user.photoKey ? user.photoKey.slice(user.photoKey.lastIndexOf("/") + 1) : null,
    country: user.country,
    language: user.language,
    languageChosen: user.languageChosen,
    dateOrder: user.dateOrder,
    clock24h: user.clock24h,
    timeZone: user.timeZone,
  };
}

function isZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Only the fields the settings page owns. A language set here also sets the
    flag that stops the browser's language overriding it. */
export function cleanPatch(patch: SettingsPatch): Partial<User> {
  const out: Partial<User> = {};
  if (typeof patch.name === "string") out.name = patch.name.trim().slice(0, 80);
  if (patch.country === null || (typeof patch.country === "string" && /^[A-Z]{2}$/.test(patch.country))) out.country = patch.country;
  if (isLanguage(patch.language)) {
    out.language = patch.language;
    out.languageChosen = true;
  }
  if (DATE_ORDERS.includes(patch.dateOrder as never)) out.dateOrder = patch.dateOrder;
  if (typeof patch.clock24h === "boolean") out.clock24h = patch.clock24h;
  if (typeof patch.timeZone === "string" && isZone(patch.timeZone)) out.timeZone = patch.timeZone;
  return out;
}

export class Settings {
  constructor(
    private users: UserStore,
    private avatars: AvatarStore,
    private random: Random,
  ) {}

  async save(user: User, patch: SettingsPatch): Promise<User> {
    await this.users.update(user.id, cleanPatch(patch));
    return (await this.users.byId(user.id)) ?? user;
  }

  async setPhoto(user: User, type: string, bytes: ArrayBuffer): Promise<User> {
    if (!PHOTO_TYPES.includes(type)) throw new Refused(415, "error.photoNotTaken");
    if (!bytes.byteLength) throw new Refused(400, "error.photoNotTaken");
    if (bytes.byteLength > PHOTO_LIMIT) throw new Refused(413, "error.photoTooBig");
    const key = `${AVATARS}${user.id}/${toBase64Url(this.random.bytes(12))}`;
    await this.avatars.put(key, bytes, type);
    await this.users.update(user.id, { photoKey: key });
    // The one before is deleted, not left behind.
    if (user.photoKey) await this.avatars.remove(user.photoKey).catch(() => {});
    return (await this.users.byId(user.id)) ?? user;
  }

  async removePhoto(user: User): Promise<User> {
    await this.users.update(user.id, { photoKey: null });
    if (user.photoKey) await this.avatars.remove(user.photoKey).catch(() => {});
    return (await this.users.byId(user.id)) ?? user;
  }

  photo(user: User) {
    return user.photoKey ? this.avatars.get(user.photoKey) : Promise.resolve(null);
  }
}
