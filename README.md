# 🎡 Roue de la Fortune — Boutique Bénin

Application marketing complète pour boutique physique : le client scanne un QR code,
tourne la roue, gagne un cadeau, et vous récupérez **son numéro WhatsApp** vérifié
pour vos campagnes.

**Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion ·
Howler.js · canvas-confetti · Neon (Postgres) · Upstash Redis · Recharts · qrcode ·
PWA · Vercel.

---

## 1. Ce que fait l'application

### Parcours client (mobile first)

| Page | Rôle |
|------|------|
| `/jouer` | Arrivée par QR code / lien. Nom + numéro WhatsApp + consentement. Source trackée (`?src=facebook`, `?src=tiktok`, `?src=boutique`…). Code de parrainage possible (`?ref=RX8K2M`). |
| *(OTP)* | Code à 6 chiffres envoyé **par WhatsApp**. Une seule participation par numéro. |
| `/roue` | La roue SVG tourne, ralentit, l'aiguille rebondit à chaque case. **Le résultat est décidé avant l'animation, côté serveur.** |
| `/resultat` | Gagné : cadeau + code unique + QR code + date limite. Perdu : message bienveillant + bon de réduction de consolation. Bouton « partager à un ami = 1 tour en plus ». |
| `/borne` | **Mode borne** : très grand QR code pour la tablette en boutique + bandeau des derniers gagnants. |
| `/hors-ligne` | Page de secours PWA. |

### Espace boutique (protégé par mot de passe)

| Page | Rôle |
|------|------|
| `/admin` | Tableau de bord : joueurs, cadeaux gagnés / récupérés, stock restant, graphiques sur 14 jours, origines du trafic, performance par cadeau. |
| `/admin/cadeaux` | Ajouter / modifier un cadeau : nom, image, stock, probabilité %, couleur, icône, ordre, actif. Ajustement du stock en un clic. |
| `/admin/scan` | La vendeuse scanne le QR du client (caméra du téléphone) ou saisit le code → validation et remise du cadeau. |
| `/admin/joueurs` | Liste des joueurs, recherche, filtre par source, **export CSV** et **export numéros WhatsApp** (prêt à coller, blocs de 20). |
| `/admin/ecran` | Écran géant en direct : derniers gagnants, mise à jour automatique toutes les 8 s. |
| `/admin/qr` | QR codes à imprimer, un par source (comptoir, vitrine, Facebook, TikTok, WhatsApp). |
| `/admin/reglages` | Tours par participant, validité des codes, réduction de consolation, message aux perdants, interrupteur général du jeu, journal d'audit. |

---

## 2. Démarrer en local

### Pré-requis

- **Node.js 20.9 ou plus** (22 recommandé) — `node -v`
- Une base **Neon** gratuite ([console.neon.tech](https://console.neon.tech))
- *(facultatif)* Un compte **Upstash Redis** gratuit pour l'anti-abus

### Étapes

```bash
# 1) Dépendances
npm install

# 2) Variables d'environnement
cp .env.example .env.local
#    puis éditez .env.local (au minimum DATABASE_URL, ADMIN_PASSWORD,
#    ADMIN_SESSION_SECRET, OTP_PEPPER)

# 3) Base de données : schéma + réglages (+ cadeaux de démonstration)
npm run db:setup        # schéma seul
# ou
npm run db:seed         # schéma + 8 cadeaux de démonstration

# 4) (facultatif) données de démonstration : 22 joueurs sur 14 jours
npm run demo

# 5) Lancer l'application
npm run dev             # → http://localhost:3000
```

**Premiers pas** :
- Client : http://localhost:3000/jouer
- Admin : http://localhost:3000/connexion (mot de passe = `ADMIN_PASSWORD`)
- Borne : http://localhost:3000/borne

> 💡 **Sans WhatsApp configuré**, le driver `console` affiche le code OTP dans le
> terminal et sur l'écran de saisie (développement uniquement). Aucun compte
> WhatsApp Business n'est nécessaire pour tester.

### Commandes utiles

```bash
npm run dev        # serveur de développement
npm run build      # build de production (vérifie aussi les types)
npm run start      # serveur de production
npm run lint       # ESLint (0 erreur attendue)
npm run typecheck  # TypeScript seul
npm test           # tests du moteur de jeu (probabilités + géométrie)
npm run db:seed    # schéma + cadeaux de démonstration
npm run demo       # participants et tirages fictifs
npm run apercu     # génère public/apercu-roue.png (contrôle visuel hors navigateur)
```

### Développer sans Neon

Le projet inclut un Postgres complet en WebAssembly (PGlite) pour travailler
hors ligne :

```bash
# Terminal 1 — un vrai serveur Postgres sur le port 5432
node scripts/pg-local.mjs

# Terminal 2 — dans .env.local :
# DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
npm run db:setup && npm run dev
```

Les données sont conservées dans `.pgdata/` (ignoré par git).
⚠️ Outil de **développement** : PGlite est mono-utilisateur, ne l'utilisez pas en production.

---

## 3. Déployer sur Vercel

### a) Créer la base Neon

1. [console.neon.tech](https://console.neon.tech) → **New project** (région la plus
   proche : `eu-central-1` pour le Bénin).
2. Copiez la **connection string « Pooled »** (elle contient `-pooler`).
3. Initialisez la base. **Deux méthodes**, au choix :

   **Depuis votre poste** (si votre réseau autorise le port 5432) :

   ```bash
   DATABASE_URL="postgresql://...neon.tech/roue?sslmode=require" npm run db:seed
   ```

   **Depuis Vercel** (si le port 5432 est bloqué par votre réseau — proxy
   d'entreprise, wifi public…) : déployez d'abord, connectez-vous à
   `/connexion`, puis déclenchez l'initialisation. Elle rejoue le même
   `sql/schema.sql` et insère les 8 cadeaux de démonstration :

   ```bash
   curl -X POST https://votre-domaine.vercel.app/api/admin/init \
        -H "Cookie: roue_admin=<votre cookie de session>"
   ```

   La route est **réservée à une session admin** et refuse d'écraser une base
   déjà peuplée (sauf `?forcer=1`). Elle est idempotente : un second appel ne
   fait rien.

### b) Créer Redis Upstash (anti-abus)

[console.upstash.com](https://console.upstash.com) → **Create database** →
onglet *REST API* → copiez `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.
*(Sans Upstash, l'application fonctionne : la limitation par IP est simplement désactivée.)*

### c) Envoyer le code sur GitHub puis importer dans Vercel

```bash
git add .
git commit -m "Roue de la fortune"
git push
```

Sur [vercel.com/new](https://vercel.com/new) → importez le dépôt. Vercel détecte
Next.js automatiquement (aucun réglage de build à changer).

### d) Variables d'environnement Vercel

*Project → Settings → Environment Variables* — ajoutez **toutes** ces clés
(Production, Preview, Development) :

| Variable | Obligatoire | Exemple |
|----------|:-----------:|---------|
| `DATABASE_URL` | ✅ | `postgresql://…-pooler…neon.tech/roue?sslmode=require` |
| `ADMIN_PASSWORD` | ✅ | mot de passe long et unique de la boutique |
| `ADMIN_SESSION_SECRET` | ✅ | `openssl rand -base64 48` |
| `OTP_PEPPER` | ✅ | un autre `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://roue.maboutique.bj` |
| `NEXT_PUBLIC_BOUTIQUE_NOM` | ✅ | `Élégance Cotonou` |
| `NEXT_PUBLIC_BOUTIQUE_ADRESSE` | ✅ | `Boulevard Saint-Michel, Cotonou` |
| `NEXT_PUBLIC_BOUTIQUE_WHATSAPP` | ✅ | `+22997123456` |
| `UPSTASH_REDIS_REST_URL` | recommandé | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | recommandé | `AX…` |
| `WHATSAPP_DRIVER` | ✅ | `meta` en production |
| `WHATSAPP_META_TOKEN` / `WHATSAPP_META_PHONE_ID` | si driver `meta` | |
| `WHATSAPP_META_TEMPLATE` | si modèle approuvé | `code_connexion` |
| `NEXT_PUBLIC_META_PIXEL_ID` | facultatif | `1234567890` |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | facultatif | `C4XXXX` |

> ⚠️ `NEXT_PUBLIC_*` est visible dans le navigateur : n'y mettez **jamais** de secret.

### e) WhatsApp : envoyer les vrais codes

Deux options, choisies par `WHATSAPP_DRIVER` :

**Meta WhatsApp Cloud API** (recommandé au Bénin)
1. [developers.facebook.com](https://developers.facebook.com) → créez une app
   Business, ajoutez le produit **WhatsApp**.
2. Récupérez le *Phone number ID* et un *token permanent* (System User).
3. Créez un **modèle (template) d'authentification** nommé `code_connexion`
   (langue `fr`) avec le code en variable `{{1}}`, faites-le approuver, puis
   renseignez `WHATSAPP_META_TEMPLATE=code_connexion`.
4. Testez avec votre propre numéro avant la mise en service.

**Twilio WhatsApp** : `WHATSAPP_DRIVER=twilio` + `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`.

> Oubliez de configurer WhatsApp en production ? Le jeu échoue proprement avec un
> message clair, et aucun code n'est affiché au client.

### f) Après le déploiement

1. Ouvrez `https://votre-domaine/connexion` → l'espace boutique.
2. `/admin/reglages` → ajustez les tours, la validité des codes, le jeu.
3. `/admin/cadeaux` → remplacez les lots de démonstration par vos vrais cadeaux.
4. `/admin/qr` → **imprimez les QR codes** (une source par affiche).
5. `/borne` sur la tablette de la boutique → bouton **Plein écran**.
   Les compteurs et le bandeau des gagnants sont lus **côté serveur** : les
   vrais chiffres apparaissent dès l'ouverture, sans attendre le réseau. La
   page se rafraîchit ensuite toutes les 15 s (et reste lisible hors ligne).

---

## 4. Structure du projet

```
.
├── sql/
│   ├── schema.sql              # Schéma complet : tables, index, RLS, fonctions
│   └── seed.sql                # Cadeaux de démonstration
├── scripts/
│   ├── db-setup.mjs            # Applique le schéma (+ seed)
│   ├── demo.mjs                # Données de démonstration (14 jours d'activité)
│   ├── pg-local.mjs            # Postgres local (PGlite) pour développer hors ligne
│   ├── generer-icones.mjs      # Icônes PWA (PNG générés sans dépendance)
│   ├── generer-sons.mjs        # Sons du jeu (WAV synthétisés)
│   └── check-sql.mjs           # Vérifie le SQL sur un vrai Postgres
├── src/
│   ├── app/
│   │   ├── (client)/           # Parcours public
│   │   │   ├── jouer/          # Inscription + OTP
│   │   │   ├── roue/           # La roue
│   │   │   ├── resultat/       # Résultat + QR
│   │   │   └── hors-ligne/
│   │   ├── borne/              # Mode borne (tablette boutique)
│   │   ├── admin/              # Espace boutique protégé
│   │   │   ├── cadeaux/        # CRUD cadeaux
│   │   │   ├── scan/           # Scan QR vendeuse
│   │   │   ├── joueurs/        # Liste + exports
│   │   │   ├── ecran/          # Écran géant
│   │   │   ├── qr/             # QR à imprimer
│   │   │   └── reglages/       # Paramètres + journal
│   │   ├── connexion/          # Connexion admin
│   │   ├── api/                # Route Handlers (tirage, OTP, exports…)
│   │   ├── globals.css         # Design system « casino de luxe »
│   │   ├── layout.tsx          # Layout racine (PWA, pixels)
│   │   └── manifest.ts         # Manifeste PWA
│   ├── components/
│   │   ├── roue/Roue.tsx       # La roue SVG animée
│   │   ├── client/             # Écrans client
│   │   ├── admin/              # Écrans admin
│   │   ├── marketing/Pixels.tsx
│   │   ├── pwa/ServiceWorker.tsx
│   │   └── ui/Base.tsx         # Boutons, cartes, titres
│   ├── lib/                    # Client + serveur partagé
│   │   ├── db.ts               # Neon HTTP / pg (deux pilotes, une syntaxe)
│   │   ├── roue.ts             # Géométrie de la roue (sans hasard)
│   │   ├── tirage-serveur.ts   # Sélection crypto.randomInt
│   │   ├── session.ts          # Cookies signés (jeu + admin)
│   │   ├── rate-limit.ts       # Upstash Redis
│   │   ├── otp.ts / whatsapp.ts
│   │   ├── sons.ts / confettis.ts / pixel.ts
│   │   └── format.ts / types.ts / env.ts / cn.ts / appareil.ts
│   └── server/                 # Strictement serveur ("server-only")
│       ├── tirage.ts           # Moteur de tirage
│       ├── data.ts             # Requêtes SQL
│       ├── params.ts           # Réglages
│       ├── contexte.ts         # IP / appareil hachés
│       └── audit.ts
├── tests/roue.test.ts          # Probabilités + géométrie
├── public/
│   ├── sw.js                   # Service worker
│   ├── icones/                 # Icônes PWA
│   └── sons/                   # Sons (WAV synthétisés)
├── .env.example
└── README.md
```

---

## 5. Comment le jeu est sécurisé

| Risque | Mesure |
|--------|--------|
| **Triche côté navigateur** | Le tirage est fait uniquement dans `POST /api/tirage`, avec `crypto.randomInt` (jamais `Math.random`). Le navigateur reçoit seulement l'**index de la case** où s'arrêter. |
| **Double participation** | Contrainte `UNIQUE` sur `participants.telephone` + limite de tours calculée en base. |
| **Spam / robots** | Upstash Redis : 5 inscriptions / 10 min / IP, 5 envois OTP / 15 min, 12 tirages / 10 min, 20 essais de connexion admin. Verrou anti double-clic de 15 s par participant. |
| **Deux joueurs sur le dernier lot** | Fonction SQL `enregistrer_tirage` : `SELECT … FOR UPDATE` puis décrément de stock. Testé : 8 tirages simultanés sur 3 stocks → exactement 3 succès, stock final 0, jamais négatif. |
| **Code cadeau réutilisé** | `UPDATE … WHERE recupere = false` : la seconde validation est refusée. Code expirant automatiquement. |
| **OTP deviné** | 6 chiffres, hachés (SHA-256 + poivre), 5 essais max, validité 10 min, comparaison en temps constant. |
| **Accès admin** | Cookie `httpOnly` signé (JWT HS256), contrôle serveur dans `src/app/admin/layout.tsx` **et** dans chaque Server Action (`exigerAdmin()`). |
| **Fuite de données** | RLS activé sur toutes les tables sans politique publique. Aucune clé base côté navigateur. Les numéros ne sont jamais exposés par les API publiques (`/api/borne` n'envoie que « Adjoa S. »). |
| **Injection SQL** | 100 % de requêtes paramétrées (`sql\`… ${valeur} …\``). |
| **Export CSV piégé** | Les cellules commençant par `=`, `+`, `-`, `@` sont neutralisées (injection de formules Excel). |

### Détails d'architecture utiles

- **Un seul accès base** (`src/lib/db.ts`) : pilote HTTP Neon en production, pool
  `pg` pour tout autre Postgres. Le reste du code écrit la même chose.
- **La roue ne décide rien** : `src/lib/roue.ts` ne contient que la géométrie, ce
  qui la rend testable et impossible à biaiser.
- **Cache Components (Next 16)** : les pages client servent une coquille statique
  immédiate (essentiel en 3G), les données arrivent en flux. L'admin est
  volontairement dynamique (`instant = false`) car il ne doit jamais afficher de
  chiffres périmés.
- **Bundle maîtrisé** : ZXing (scan) et canvas-confetti ne sont chargés qu'à la
  demande ; les polices sont auto-hébergées (aucun appel à Google Fonts).

---

## 6. Marketing : pixels et sources

- **Pixels** : `NEXT_PUBLIC_META_PIXEL_ID` et `NEXT_PUBLIC_TIKTOK_PIXEL_ID`
  (facultatifs). Événements envoyés :
  `joue_debut` → ViewContent · `joue_inscription` → CompleteRegistration ·
  `joue_victoire` → Purchase · `joue_partage` → Contact.
- **Sources** : chaque QR code porte son `?src=`. Le tableau de bord affiche la
  répartition (boutique, vitrine, Facebook, TikTok, WhatsApp, direct).
- **Campagnes WhatsApp** : `/admin/joueurs` → « Numéros WhatsApp » (un numéro par
  ligne) ou « blocs de 20 » (pratique pour un statut / un groupe diffusé).

> ⚠️ Le consentement est demandé explicitement à l'inscription et stocké
> (`participants.consentement`). N'exportez que les clients consentants, et
> proposez toujours une sortie (« répondez STOP »).

---

## 7. Personnalisation rapide

| Je veux… | Où |
|----------|-----|
| Changer le nom / l'adresse / le WhatsApp de la boutique | `.env.local` (`NEXT_PUBLIC_BOUTIQUE_*`) |
| Changer les cadeaux et les chances | `/admin/cadeaux` |
| Changer le nombre de tours, la durée des codes | `/admin/reglages` |
| Modifier les couleurs or / bordeaux / nuit | `src/app/globals.css` (`@theme`) |
| Changer la vitesse de la roue | `/roue` → composant `<Roue duree={6.4} tours={8} />` |
| Remplacer les sons | `scripts/generer-sons.mjs` ou déposez vos WAV dans `public/sons/` |
| Traduire / reformuler les textes client | `src/app/(client)/*` et `src/components/client/*` |

---

## 8. Aller plus loin (hors périmètre livré)

- **Temps réel poussé** : l'écran `/admin/ecran` et la borne utilisent un polling
  de 8–15 s (robuste en réseau mobile). Pour du push, branchez un service
  Realtime (Supabase Realtime, Ably, Pusher) : seul `src/components/admin/EcranBoutique.tsx`
  est à modifier.
- **Notifications WhatsApp de rappel** (« votre cadeau expire dans 3 jours ») :
  utilisez `src/lib/whatsapp.ts` + un Cron Vercel.
- **Multi-boutiques** : ajoutez une colonne `boutique_id` — l'architecture
  (`src/server/*`) est déjà centralisée.

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `Variable d'environnement manquante : …` | `.env.local` incomplet | copiez `.env.example` et remplissez |
| `DATABASE_URL absente` au démarrage | pas de `.env.local` | idem |
| Le code OTP n'arrive pas | driver `console` ou template non approuvé | `WHATSAPP_DRIVER=meta` + modèle approuvé |
| « Trop de tentatives depuis cet appareil » | limite Upstash atteinte | attendez 10–15 min, ou videz la base Redis Upstash |
| La page admin renvoie vers `/connexion` | cookie expiré (12 h) | reconnectez-vous |
| `ECONNRESET` en local avec PGlite | plus d'une connexion TCP | relancez `scripts/pg-local.mjs` (maxConnections = 16) |
| La caméra du scan ne s'ouvre pas | page en HTTP | HTTPS obligatoire (Vercel l'impose) ; la saisie manuelle reste possible |
| Les images de cadeaux ne s'affichent pas | domaine non autorisé | ajoutez le domaine dans `next.config.ts` → `images.remotePatterns` |

---

## 10. Licence et crédits

Code fourni pour votre boutique — adaptez-le librement.

Sons : synthétisés par `scripts/generer-sons.mjs` (aucun droit tiers).
Polices : Cinzel et Manrope (SIL Open Font License), auto-hébergées via Fontsource.
Icônes : [Lucide](https://lucide.dev) (ISC).
