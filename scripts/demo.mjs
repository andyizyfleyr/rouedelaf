/**
 * Jeu de données de démonstration (captures, présentation client).
 *
 *   node scripts/demo.mjs
 *
 * Crée des participants réalistes, des tirages répartis sur 14 jours, des
 * cadeaux remis et quelques codes expirés. À lancer UNIQUEMENT sur une base
 * de démonstration : les données sont fictives.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL manquante");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const prenoms = [
  ["Adjoa", "Sossou"], ["Kofi", "Mensah"], ["Awa", "Diallo"], ["Fatou", "Bio"],
  ["Rodrigue", "Houngbédji"], ["Mireille", "Dossou"], ["Ibrahim", "Sanni"],
  ["Grâce", "Agossou"], ["Serge", "Tchibozo"], ["Nadège", "Kouassi"],
  ["Boris", "Ahouandjinou"], ["Céline", "Adjovi"], ["Yao", "Kpodar"],
  ["Sylvie", "Hounkpatin"], ["Moussa", "Bello"], ["Léa", "Zinsou"],
  ["Cédric", "Dègboé"], ["Aminata", "Traoré"], ["Josué", "Vodounou"],
  ["Prisca", "Gbaguidi"], ["Diane", "Sèdjro"], ["Aris", "Kpadonou"],
];
const sources = ["boutique", "boutique", "boutique", "facebook", "tiktok", "whatsapp", "vitrine"];
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeAleatoire = () =>
  "ROUE-" +
  Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("") +
  "-" +
  Array.from({ length: 2 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

try {
  const { rows: cadeaux } = await client.query(
    "SELECT id, nom, stock FROM cadeaux WHERE actif ORDER BY ordre",
  );
  if (cadeaux.length === 0) throw new Error("Aucun cadeau : lancez npm run db:seed");

  let joueurs = 0;
  let gains = 0;

  for (let i = 0; i < prenoms.length; i += 1) {
    const [prenom, nomFamille] = prenoms[i];
    const telephone = `22996${String(100000 + i * 137).slice(0, 6)}`;
    const joursEnArriere = Math.floor(Math.random() * 13);
    const date = new Date(Date.now() - joursEnArriere * 86_400_000 - Math.random() * 8 * 3_600_000);
    const source = sources[i % sources.length];

    const { rows: [participant] } = await client.query(
      `INSERT INTO participants (nom, telephone, telephone_aff, source, code_parrain, consentement, created_at)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (telephone) DO NOTHING
       RETURNING id`,
      [
        `${prenom} ${nomFamille}`,
        telephone,
        `+229 ${telephone.slice(3, 5)} ${telephone.slice(5, 7)} ${telephone.slice(7, 9)} ${telephone.slice(9, 11)}`,
        source,
        `R${alphabet[i % 32]}${alphabet[(i * 7) % 32]}${alphabet[(i * 13) % 32]}${alphabet[(i * 3) % 32]}${alphabet[(i * 11) % 32]}`,
        date.toISOString(),
      ],
    );
    if (!participant) continue;
    joueurs += 1;

    // 78 % de gagnants, répartis sur les lots disponibles.
    const gagne = Math.random() < 0.78;
    const cadeau = gagne ? cadeaux[Math.floor(Math.random() * cadeaux.length)] : null;
    const expire = new Date(date.getTime() + 14 * 86_400_000);
    const recupere = gagne && Math.random() < 0.45;

    await client.query(
      `INSERT INTO tirages
        (participant_id, cadeau_id, code_unique, statut, recupere, recupere_le, expire_le, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        participant.id,
        cadeau?.id ?? null,
        cadeau ? codeAleatoire() : null,
        cadeau ? "gagne" : "perdu",
        recupere,
        recupere ? new Date(date.getTime() + 86_400_000).toISOString() : null,
        expire.toISOString(),
        date.toISOString(),
      ],
    );
    if (cadeau) gains += 1;
  }

  console.log(`✅ ${joueurs} participants, ${gains} gains`);
} catch (e) {
  console.error("❌", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
