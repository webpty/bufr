// Every word the page and its sign-in mail say, in English (British spelling),
// Spanish and French. Whole sentences are single entries; nothing is put
// together from fragments. The Worker answers with a key, never a sentence,
// so the words live here and nowhere else.

export type Language = "en" | "es" | "fr";

export const LANGUAGES: Language[] = ["en", "es", "fr"];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as string[]).includes(value);
}

/** The browser's language, narrowed to one we have. */
export function nearestLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return "en";
}

const EN = {
  "signIn.email": "E-mail",
  "signIn.sendCode": "Send code",
  "signIn.signIn": "Sign in",
  "signIn.otherAddress": "Use another address",
  "signIn.code": "Code",

  "theme.light": "Light",
  "theme.dark": "Dark",

  "overview.lastCheckIn": "NAS last checked in",
  "overview.never": "Never",
  "overview.ago": "{time} ago",
  "overview.settings": "Settings",
  "overview.notReached": "bufr.cc could not be reached. Trying again.",
  "overview.loading": "Loading",
  "overview.period": "Period",
  "overview.period.day": "24 hours",
  "overview.period.week": "7 days",
  "overview.period.month": "30 days",
  "overview.period.year": "This year",
  "overview.period.all": "Everything",
  "overview.waitingNow": "Waiting now",
  "overview.copied": "Copied to the NAS",
  "overview.speed": "Average speed",
  "overview.upload": "Upload",
  "overview.download": "Download",
  "overview.speedOverTime": "Speed over time",
  "overview.timeHere": "Time on bufr.cc before the NAS",
  "overview.average": "Average",
  "overview.shortest": "Shortest",
  "overview.longest": "Longest",
  "overview.waitOverTime": "Average time",
  "overview.copiedChart": "Photos copied to the NAS",
  "overview.copiedBars": "Copied",
  "overview.runningTotal": "Running total",
  "overview.allTime": "All time",
  "overview.nothingYet": "Nothing yet",

  "settings.title": "Settings",
  "settings.back": "Back",
  "settings.signOut": "Sign out",
  "settings.you": "You",
  "settings.changePhoto": "Change photo",
  "settings.removePhoto": "Remove photo",
  "settings.removePhotoAsk": "Remove your photo?",
  "settings.remove": "Remove",
  "settings.keep": "Keep",
  "settings.name": "Name",
  "settings.email": "E-mail",
  "settings.country": "Country",
  "settings.notSet": "Not set",
  "settings.languageAndTime": "Language and time",
  "settings.language": "Language",
  "settings.dateOrder": "Date order",
  "settings.clock24h": "24-hour clock",
  "settings.timeZone": "Time zone",
  "settings.save": "Save",
  "settings.saved": "Saved",
  "settings.photoChanged": "Photo changed",
  "settings.photoRemoved": "Photo removed",

  "photo.title": "Your photo",
  "photo.zoom": "Zoom",
  "photo.cancel": "Cancel",
  "photo.use": "Use this",

  "error.emailNeeded": "Type your e-mail address first.",
  "error.codeAndEmailNeeded": "The address and the code are both needed.",
  "error.tooManyCodes": "Too many codes asked for. Try again in ten minutes.",
  "error.codeWrong": "That code is wrong or has run out.",
  "error.tooManyTries": "Too many wrong codes. Try again in a quarter of an hour.",
  "error.tooFast": "Too many tries. Wait a minute and try again.",
  "error.couldNotSendCode": "The code could not be sent.",
  "error.couldNotSignIn": "Could not sign in.",
  "error.notSignedIn": "You are signed out.",
  "error.couldNotSave": "That could not be saved.",
  "error.photoNotTaken": "That picture could not be taken.",
  "error.photoTooBig": "That picture is too big.",
  "error.photoNotRead": "That picture could not be read.",
  "error.somethingWentWrong": "Something went wrong at bufr.cc.",
  "error.noConnection": "bufr.cc could not be reached.",

  "mail.codeSubject": "Your bufr.cc code: {code}",
  "mail.codeBody": "{code}\n\nThis code signs you in to bufr.cc for the next {minutes} minutes. If you did not ask for it, ignore this message.",
};

type Key = keyof typeof EN;

const ES: Record<Key, string> = {
  "signIn.email": "Correo electrónico",
  "signIn.sendCode": "Enviar código",
  "signIn.signIn": "Entrar",
  "signIn.otherAddress": "Usar otra dirección",
  "signIn.code": "Código",

  "theme.light": "Claro",
  "theme.dark": "Oscuro",

  "overview.lastCheckIn": "Última conexión del NAS",
  "overview.never": "Nunca",
  "overview.ago": "hace {time}",
  "overview.settings": "Ajustes",
  "overview.notReached": "No se pudo contactar con bufr.cc. Volviendo a intentarlo.",
  "overview.loading": "Cargando",
  "overview.period": "Periodo",
  "overview.period.day": "24 horas",
  "overview.period.week": "7 días",
  "overview.period.month": "30 días",
  "overview.period.year": "Este año",
  "overview.period.all": "Todo",
  "overview.waitingNow": "En espera ahora",
  "overview.copied": "Copiadas al NAS",
  "overview.speed": "Velocidad media",
  "overview.upload": "Subida",
  "overview.download": "Descarga",
  "overview.speedOverTime": "Velocidad en el tiempo",
  "overview.timeHere": "Tiempo en bufr.cc antes del NAS",
  "overview.average": "Media",
  "overview.shortest": "Más corto",
  "overview.longest": "Más largo",
  "overview.waitOverTime": "Tiempo medio",
  "overview.copiedChart": "Fotos copiadas al NAS",
  "overview.copiedBars": "Copiadas",
  "overview.runningTotal": "Total acumulado",
  "overview.allTime": "Desde el principio",
  "overview.nothingYet": "Nada todavía",

  "settings.title": "Ajustes",
  "settings.back": "Atrás",
  "settings.signOut": "Cerrar sesión",
  "settings.you": "Tú",
  "settings.changePhoto": "Cambiar foto",
  "settings.removePhoto": "Quitar foto",
  "settings.removePhotoAsk": "¿Quitar tu foto?",
  "settings.remove": "Quitar",
  "settings.keep": "Conservar",
  "settings.name": "Nombre",
  "settings.email": "Correo electrónico",
  "settings.country": "País",
  "settings.notSet": "Sin indicar",
  "settings.languageAndTime": "Idioma y hora",
  "settings.language": "Idioma",
  "settings.dateOrder": "Orden de la fecha",
  "settings.clock24h": "Reloj de 24 horas",
  "settings.timeZone": "Zona horaria",
  "settings.save": "Guardar",
  "settings.saved": "Guardado",
  "settings.photoChanged": "Foto cambiada",
  "settings.photoRemoved": "Foto quitada",

  "photo.title": "Tu foto",
  "photo.zoom": "Zoom",
  "photo.cancel": "Cancelar",
  "photo.use": "Usar esta",

  "error.emailNeeded": "Escribe primero tu correo electrónico.",
  "error.codeAndEmailNeeded": "Hacen falta la dirección y el código.",
  "error.tooManyCodes": "Se han pedido demasiados códigos. Vuelve a intentarlo dentro de diez minutos.",
  "error.codeWrong": "Ese código no es correcto o ha caducado.",
  "error.tooManyTries": "Demasiados códigos incorrectos. Vuelve a intentarlo dentro de un cuarto de hora.",
  "error.tooFast": "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
  "error.couldNotSendCode": "No se pudo enviar el código.",
  "error.couldNotSignIn": "No se pudo entrar.",
  "error.notSignedIn": "Has cerrado la sesión.",
  "error.couldNotSave": "No se pudo guardar.",
  "error.photoNotTaken": "No se pudo aceptar esa imagen.",
  "error.photoTooBig": "Esa imagen es demasiado grande.",
  "error.photoNotRead": "No se pudo leer esa imagen.",
  "error.somethingWentWrong": "Algo ha fallado en bufr.cc.",
  "error.noConnection": "No se pudo contactar con bufr.cc.",

  "mail.codeSubject": "Tu código de bufr.cc: {code}",
  "mail.codeBody": "{code}\n\nEste código te da acceso a bufr.cc durante los próximos {minutes} minutos. Si no lo has pedido, ignora este mensaje.",
};

const FR: Record<Key, string> = {
  "signIn.email": "E-mail",
  "signIn.sendCode": "Envoyer le code",
  "signIn.signIn": "Se connecter",
  "signIn.otherAddress": "Utiliser une autre adresse",
  "signIn.code": "Code",

  "theme.light": "Clair",
  "theme.dark": "Sombre",

  "overview.lastCheckIn": "Dernier passage du NAS",
  "overview.never": "Jamais",
  "overview.ago": "il y a {time}",
  "overview.settings": "Réglages",
  "overview.notReached": "Impossible de joindre bufr.cc. Nouvel essai en cours.",
  "overview.loading": "Chargement",
  "overview.period": "Période",
  "overview.period.day": "24 heures",
  "overview.period.week": "7 jours",
  "overview.period.month": "30 jours",
  "overview.period.year": "Cette année",
  "overview.period.all": "Tout",
  "overview.waitingNow": "En attente",
  "overview.copied": "Copiées sur le NAS",
  "overview.speed": "Vitesse moyenne",
  "overview.upload": "Envoi",
  "overview.download": "Téléchargement",
  "overview.speedOverTime": "Vitesse dans le temps",
  "overview.timeHere": "Temps sur bufr.cc avant le NAS",
  "overview.average": "Moyenne",
  "overview.shortest": "Le plus court",
  "overview.longest": "Le plus long",
  "overview.waitOverTime": "Temps moyen",
  "overview.copiedChart": "Photos copiées sur le NAS",
  "overview.copiedBars": "Copiées",
  "overview.runningTotal": "Total cumulé",
  "overview.allTime": "Depuis le début",
  "overview.nothingYet": "Rien pour l'instant",

  "settings.title": "Réglages",
  "settings.back": "Retour",
  "settings.signOut": "Se déconnecter",
  "settings.you": "Vous",
  "settings.changePhoto": "Changer de photo",
  "settings.removePhoto": "Retirer la photo",
  "settings.removePhotoAsk": "Retirer votre photo ?",
  "settings.remove": "Retirer",
  "settings.keep": "Garder",
  "settings.name": "Nom",
  "settings.email": "E-mail",
  "settings.country": "Pays",
  "settings.notSet": "Non renseigné",
  "settings.languageAndTime": "Langue et heure",
  "settings.language": "Langue",
  "settings.dateOrder": "Ordre de la date",
  "settings.clock24h": "Horloge sur 24 heures",
  "settings.timeZone": "Fuseau horaire",
  "settings.save": "Enregistrer",
  "settings.saved": "Enregistré",
  "settings.photoChanged": "Photo changée",
  "settings.photoRemoved": "Photo retirée",

  "photo.title": "Votre photo",
  "photo.zoom": "Zoom",
  "photo.cancel": "Annuler",
  "photo.use": "Utiliser celle-ci",

  "error.emailNeeded": "Saisissez d'abord votre adresse e-mail.",
  "error.codeAndEmailNeeded": "L'adresse et le code sont tous deux nécessaires.",
  "error.tooManyCodes": "Trop de codes demandés. Réessayez dans dix minutes.",
  "error.codeWrong": "Ce code est faux ou a expiré.",
  "error.tooManyTries": "Trop de codes faux. Réessayez dans un quart d'heure.",
  "error.tooFast": "Trop d'essais. Attendez une minute et réessayez.",
  "error.couldNotSendCode": "Le code n'a pas pu être envoyé.",
  "error.couldNotSignIn": "Connexion impossible.",
  "error.notSignedIn": "Vous êtes déconnecté.",
  "error.couldNotSave": "Impossible d'enregistrer.",
  "error.photoNotTaken": "Cette image n'a pas pu être acceptée.",
  "error.photoTooBig": "Cette image est trop grande.",
  "error.photoNotRead": "Cette image n'a pas pu être lue.",
  "error.somethingWentWrong": "Un problème est survenu sur bufr.cc.",
  "error.noConnection": "Impossible de joindre bufr.cc.",

  "mail.codeSubject": "Votre code bufr.cc : {code}",
  "mail.codeBody": "{code}\n\nCe code vous connecte à bufr.cc pendant les {minutes} prochaines minutes. Si vous ne l'avez pas demandé, ignorez ce message.",
};

const STRINGS: Record<Language, Record<Key, string>> = { en: EN, es: ES, fr: FR };

export type StringKey = Key;

export function isStringKey(value: unknown): value is StringKey {
  return typeof value === "string" && value in EN;
}

/** One sentence, in the language asked for, with {holes} filled in. */
export function t(language: Language, key: Key, values: Record<string, string | number> = {}): string {
  const line = STRINGS[language]?.[key] ?? EN[key];
  return line.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
