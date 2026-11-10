# Audit — Roue de la Fortune « Élégance Cotonou »

Audit complet du jeu (parcours client, roue, popup, parrainage, admin) : lecture
du code **et** tests réels dans un navigateur (Chromium), sur téléphone
390 × 844, petit téléphone 320 × 568, paysage 667 × 375, tablette 1024 × 768 et
ordinateur 1440 × 810. Sur les 26 points contrôlés, **4 bugs critiques**,
**6 bugs fonctionnels** et **9 défauts visuels / d'expérience** ont été trouvés.

Chaque bug a été reproduit ; la colonne « preuve » indique ce qui a été observé.

---

## 1. Bugs critiques — à corriger en premier

### C1. Un rechargement pendant la rotation fait perdre le tour

**Symptôme** : le joueur appuie sur « Tourner la roue », la roue démarre, il
recharge la page (réflexe courant en 3G quand l'écran semble figé) : le tirage
est **déjà enregistré** mais la roue revient à l'état initial. Le tour est
consommé, le cadeau n'est jamais montré en animation, et la popup ne s'ouvre
pas d'elle-même.
**Cause** : `POST /api/tirage` enregistre le tirage puis renvoie le résultat ;
`/roue` ne renvoie `tirageInitial` que si `toursRestants <= 0`. Au rechargement,
`toursRestants` vaut 0 → la page charge bien le dernier tirage, mais le
composant client (`EcranRoue`) démarre avec `arretee = false` et `popup = false`,
donc rien ne s'affiche.
**Observé** : après rechargement, le bouton affiche « Revoir mon cadeau » mais
la popup reste fermée ; aucun message n'explique au joueur ce qui s'est passé.
**Correctif** : ouvrir la popup d'emblée quand `tirageInitial` existe, et
réafficher l'angle d'arrêt sur la bonne case (`caseCible`/rotation initiale)
pour que l'aiguille montre le résultat au lieu de la roue à zéro.

### C2. Deux onglets = deux tirages pour un seul joueur

**Symptôme** : avec le même cookie de session, deux onglets ouverts en
parallèle peuvent chacun obtenir un tirage (`200 + 200`).
**Preuve** : deux `POST /api/tirage` simultanés → **2 tirages enregistrés en
base** pour le même participant, alors que le jeu promet « un seul tour par
personne ».
**Cause** : le verrou anti-double-clic (`prendreVerrou`) est un no-op quand
Upstash n'est pas configuré (`limiteurs` désactivés → `verrou` toujours accordé).
Surtout, il est relâché dès la réponse (`finally`) : rien n'empêche deux
requêtes séquentielles de passer si `tours_max > 1` sans bonus.
**Correctif** : rendre la consommation de tour atomique en base plutôt que de
compter sur Redis — vérifier `tours restants` **et** insérer dans la même
transaction verrouillée (le `SELECT ... FOR UPDATE` du participant manque dans
`enregistrer_tirage`).

### C3. Au-delà d'un cadeau, les précédents deviennent inaccessibles

**Symptôme** : un joueur qui gagne deux cadeaux (parrainage, ou `tours_max > 1`)
ne peut plus revoir le premier. `/resultat` sans paramètre affiche **uniquement
le dernier tirage**, et le lien « Plein écran » ne pointe que sur le dernier.
**Preuve** : 1ᵉʳ tour → `ROUE-9F17-HG`, 2ᵉ tour → `ROUE-4D95-BH` ;
`/resultat` n'affiche plus que `ROUE-4D95-BH`. Le bon `ROUE-9F17-HG` reste
valide en base mais le joueur n'a plus aucun moyen de l'afficher.
Conséquence concrète en boutique : le client ne peut pas présenter son premier
bon, alors que le stock a été décrémenté.

### C4. Aucun lot disponible : le joueur perd son tour en silence

**Symptôme** : si tous les lots sont en rupture ou désactivés, la roue
s'affiche avec 8 cases « PERDU » et le badge **« CADEAU GARANTI »**. Le joueur
tourne, perd, et un tour est consommé.
**Preuve** : avec tous les lots `actif = false`, la roue se charge normalement
(8 secteurs « Perdu ») et le tirage aboutit à « PAS DE CHANCE ».
Un client qui a vu « 100 % gagnant » sur l'affiche vit cela comme une arnaque.
**Correctif** : message explicite (« les cadeaux sont épuisés, repassez
demain ») et ne pas consommer de tour.

---

## 2. Bugs fonctionnels

### F1. Le téléphone accepte 10 chiffres et crée un numéro invalide

Sur `+229`, la saisie `12 34 56 78 90` est acceptée telle quelle : l'aide
affiche « Vérifiez : +229 12 34 56 78 90 » et l'inscription réussit avec un
numéro à 13 chiffres inexistant. La validation client teste seulement
`chiffres.length >= 8`, sans vérifier le format du pays.
**Effet** : fichiers clients pollués, et un vrai client peut être bloqué plus
tard par un doublon si le numéro est tronqué différemment.

### F2. Le jeu fermé n'est signalé qu'après le clic

`active_jeu = false` : la page s'affiche normalement avec « CADEAU GARANTI »
et un bouton actif ; l'erreur « Le jeu est momentanément fermé » n'apparaît
qu'après avoir appuyé. Rien n'indique en amont que le jeu est en pause.

### F3. Message d'erreur peu visible

L'erreur de tirage est rendue dans un petit encart de 10,5 px, sous le texte
d'accroche, **au-dessus** de la roue sur mobile : facile à manquer, alors que
le bouton redevient cliquable immédiatement.

### F4. La popup n'est pas un vrai dialogue modal (accessibilité)

`role="dialog" aria-modal="true"` est posé, mais au moment de l'ouverture le
focus reste sur `<body>` (`focusDansDialog: false`) et il n'y a pas de piège à
focus. Un utilisateur au clavier ou avec un lecteur d'écran n'est pas emmené
dans la popup ; la touche Tab continue de circuler derrière.

### F5. Le parrain ne voit pas qu'il a gagné un tour

Après l'inscription d'un filleul, le tour bonus est bien crédité
(`toursBonus: 1`, vérifié), mais aucune notification, aucun message : le
parrain ne le découvre qu'en revenant sur `/roue` et en voyant le bouton
« Tourner la roue » au lieu de « Voir mon cadeau ». L'argument marketing
« +1 tour » n'est jamais confirmé à l'écran.

### F6. Deux réponses du botteur pour le même cadeau

La popup affiche « Valable jusqu'au … » et le compte à rebours pour un cadeau
**gagné**, mais si le joueur rouvre ce même bon après expiration, la mention
« Ce code a expiré » n'apparaît qu'après le calcul client ; le serveur, lui,
garde le bon affiché comme valide dans `/resultat` (le statut n'est pas testé
à l'affichage, seule la date est comparée côté client). Un bon expiré peut donc
être présenté avec une date passée sans avertissement visible immédiat.

---

## 3. Défauts visuels et d'expérience

### V1. Sur la roue, les cases « Perdu » se collent

Les cases perdantes sont insérées par `repartitionPerdue()` et finissent
**adjacentes** dès qu'il y a moins de 7 lots. Vérifié : 6 lots → **5 paires de
cases « Perdu » consécutives**, 1 lot → 6 paires sur 8 cases. Résultat : de
grands blocs bordeaux uniformes qui donnent l'impression d'une roue cassée.
(Visible sur les captures 320 px et paysage : 7 secteurs « PERDU » d'affilée.)

### V2. L'icône des cases « Perdu » est trompeuse

`IconeCadeau` associe `/perdu|rien|dommage/` à `Sparkles` : chaque case perdante
affiche donc… une **étincelle dorée**, le même pictogramme que le badge
« 1 tour offert ». Sur la roue, cela ressemble à un cadeau.

### V3. Le bouton est tronqué en paysage et sur petit écran

À 667 × 375 et à 320 px de large, le libellé du bouton devient
« Tourner la … » (ellipse due à `truncate`). Au moment clé, l'action perd son
sens.

### V4. Le badge est tronqué sur les écrans étroits

« 1 TOUR OFFERT · CADEAU GARA… » en paysage : le texte est coupé en plein mot.

### V5. Le titre déborde du cadre

Un nom long (« Aboubakar Siddiq Ouedraogo de Souza ») occupe **3 lignes** dans
un `h1` sans limite, pousse la roue vers le bas et casse la composition. Le
titre n'est jamais tronqué ni réduit automatiquement.

### V6. La roue reste minuscule sur les écrans très larges

Le carré est plafonné par `56vw` et par la hauteur : sur un écran 2560 × 1440,
la roue garde la même taille relative et laisse de larges marges noires. Le
deux-colonnes n'exploite pas la largeur disponible.

### V7. Le badge « CADEAU GARANTI » ment quand tous les lots sont épuisés

Même défaut que C4, mais c'est aussi un problème visuel : l'accroche reste
« CADEAU GARANTI » / « 100 % gagnant » alors que la roue n'a que des cases
perdantes.

### V8. Écran « Vous avez déjà participé » sans le résultat

Sur `/jouer`, un joueur déjà inscrit voit une carte « Vous avez déjà participé »
et un bouton « Revoir mon résultat », mais **aucun aperçu** (ni le nom du
cadeau, ni la date limite). Il doit naviguer pour savoir ce qu'il a gagné.

### V9. La popup déborde sur les petits écrans

À 320 × 568, la feuille de résultat (`max-h-[88dvh]` + contenu complet : cadeau,
code, QR, dates, partage, deux boutons) demande plus de place que l'écran ; le
QR et les boutons du bas sortent de la zone visible et il faut faire défiler
**dans** la popup, ce qui n'est pas évident (aucun indicateur de défilement).

---

## 4. Points vérifiés qui fonctionnent correctement

- La roue tourne réellement et s'arrête sur la case décidée par le serveur
  (angle et case identiques, vérifié à chaque essai).
- Aucune redirection automatique : l'URL reste `/roue` à la fin du tour.
- La popup s'ouvre à l'arrêt de la roue et se ferme par la croix, le voile ou
  Échap ; le fond ne défile plus quand elle est ouverte.
- Le QR code est présent dans la popup (renvoyé par l'API) et le code copiable.
- Aucun débordement de page (pas de défilement parasite) sur 390 × 844,
  1024 × 768 et 1440 × 810 ; le texte agrandi à 200 % ne casse pas la page.
- Le parrainage crédite bien +1 tour au parrain (vérifié en base).
- Un tirage ne peut pas être volé par un autre joueur : `/resultat?t=<id>`
  renvoie vers `/jouer` si le tirage n'appartient pas à la session.
- Le stock ne passe jamais en négatif (verrou `FOR UPDATE`).
- Les codes cadeaux sont uniques (aucun doublon en base).
- Aucune ressource 404, aucune erreur JavaScript en console sur le parcours.

---

## 5. Ordre de correction conseillé

1. **C2** (double tour) et **C1** (rechargement) — ils faussent le jeu et
   l'inventaire des cadeaux.
2. **C3** (bons précédents inaccessibles) — impact direct en boutique.
3. **C4 / V7** (rupture de stock silencieuse) — promesse commerciale.
4. **V1 / V2** (cases « Perdu ») — c'est ce que le client voit en premier.
5. **F1** (téléphone), **V3 / V4 / V5** (troncatures) — qualité perçue.
6. **F4** (accessibilité), **F5**, **F6**, **V8**, **V9** — finitions.
