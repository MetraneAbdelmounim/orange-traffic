import { Language } from './i18n.service';

/**
 * The backend always answers in French (`error`/`reason` strings hardcoded
 * across the Express controllers — there is no server-side i18n). Every
 * place in the UI that surfaces `err?.error?.error` (or a license `reason`)
 * routes it through `translateApiError` first, so an English session doesn't
 * suddenly show a French sentence the moment a request fails.
 *
 * Static messages are looked up verbatim; a few carry a dynamic value
 * (a field name, a count, a device name, a date) and are matched by regex
 * with the value substituted back into the translation.
 */
const STATIC: Record<string, string> = {
  'Données invalides': 'Invalid data',
  'Identifiant invalide': 'Invalid identifier',
  'Une erreur interne est survenue': 'An internal error occurred',
  'Trop de tentatives de connexion. Réessayez dans quelques minutes.': 'Too many login attempts. Try again in a few minutes.',
  'Trop de requêtes. Réessayez dans un instant.': 'Too many requests. Try again shortly.',
  'Trop de tentatives. Réessayez dans quelques minutes.': 'Too many attempts. Try again in a few minutes.',
  'Trop de tests SMTP. Réessayez dans quelques minutes.': 'Too many SMTP tests. Try again in a few minutes.',
  'Route introuvable': 'Route not found',
  'Identifiants invalides': 'Invalid credentials',
  'Utilisateur introuvable': 'User not found',
  "Le nom d'utilisateur est requis": 'Username is required',
  'Utilisateur déjà existant !': 'User already exists',
  'Les mots de passe ne correspondent pas': 'Passwords do not match',
  'Mot de passe actuel incorrect': 'Current password is incorrect',
  'Aucun fichier reçu': 'No file received',
  'Fichier de licence trop volumineux': 'License file is too large',
  'Fichier de licence illisible': 'Unreadable license file',
  'Signature de licence illisible': 'Unreadable license signature',
  'Structure de licence invalide': 'Invalid license structure',
  'Aucune clé publique de licence installée sur ce serveur': 'No license public key installed on this server',
  'Signature de licence invalide ou fichier altéré': 'Invalid license signature or corrupted file',
  'Une licence valide est déjà active': 'A valid license is already active',
  'Projet introuvable': 'Project not found',
  'Contrôleur introuvable': 'Controller not found',
  "Vous devez changer votre mot de passe avant de continuer": 'You must change your password before continuing',
  'Identifiant de projet invalide ou manquant': 'Invalid or missing project identifier',
  "Vous n'êtes pas autorisé à accéder à ce projet": 'You are not authorized to access this project',
  "L'application est déjà configurée": 'The application is already configured',
  'Ce nom d’utilisateur est déjà pris': 'This username is already taken',
  "Adresse e-mail de test manquante (renseignez votre e-mail dans votre profil, ou précisez `to`)":
    'Missing test email address (set your email in your profile, or specify `to`)',
  'Une adresse e-mail est requise pour activer les notifications': 'An email address is required to enable notifications',
  'Une adresse e-mail est requise pour activer les alertes': 'An email address is required to enable alerts',
  'Licence expirée': 'License expired',
  'Aucune licence installée': 'No license installed',
  "Vous n'êtes pas autorisé ! Veuillez contacter votre administrateur": 'You are not authorized! Please contact your administrator',
  'Licence installée avec succès': 'License installed successfully',
  'Licence démo activée': 'Demo license activated',
};

const DYNAMIC: Array<{ re: RegExp; en: (...groups: string[]) => string }> = [
  { re: /^Cette (.+) existe déjà$/, en: (field) => `This ${field} already exists` },
  { re: /^Le mot de passe doit contenir au moins (\d+) caractères$/, en: (n) => `Password must be at least ${n} characters` },
  { re: /^Impossible de sonder (.+)$/, en: (name) => `Unable to poll ${name}` },
  {
    re: /^Cette licence a expiré le (.+)$/,
    en: (date) => `This license expired on ${date}`,
  },
];

export function translateApiError(message: string | undefined | null, lang: Language): string | undefined | null {
  if (!message || lang === 'fr') return message;
  if (STATIC[message]) return STATIC[message];
  for (const { re, en } of DYNAMIC) {
    const match = message.match(re);
    if (match) return en(...match.slice(1));
  }
  return message;
}
