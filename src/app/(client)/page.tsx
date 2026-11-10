import { permanentRedirect } from "next/navigation";

/**
 * Racine du site : le jeu n'a plus d'accueil séparé.
 *
 * Depuis que le jeu tourne sur le poste de la boutique, il n'y a plus
 * d'inscription à présenter : la roue est LE point d'entrée. On redirige donc
 * directement vers /roue.
 *
 * Redirection PERMANENTE (308) : l'adresse est définitive, autant l'annoncer
 * aux navigateurs et aux moteurs de recherche plutôt que de les faire repasser
 * par ici à chaque visite.
 */
export default function Accueil(): never {
  permanentRedirect("/roue");
}
