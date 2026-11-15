import Link from "next/link";

export const metadata = { title: "Confidentialité — AFTERIMAGE" };

export default function Privacy() {
  return (
    <main className="page prose">
      <h1>Confidentialité</h1>
      <p>AFTERIMAGE est une fiction. Jeanne et Malik sont des personnages fictifs animés par IA.</p>
      <h2>Ce que nous conservons</h2>
      <ul>
        <li>L’état de votre partie (découvertes, progression) et la phrase que vous choisissez de laisser dans le jeu.</li>
        <li>Une session de connexion (cookie sécurisé) et, pour un compte, votre email et un mot de passe chiffré.</li>
        <li>Des journaux techniques minimaux (codes d’erreur, durées, identifiants pseudonymes), sans contenu de conversation.</li>
      </ul>
      <h2>Ce que nous ne conservons pas</h2>
      <ul>
        <li>Votre voix et votre caméra ne sont pas enregistrées par le jeu. La caméra n’est jamais demandée.</li>
        <li>Les transcriptions intégrales des conversations ne sont pas stockées par le jeu.</li>
      </ul>
      <h2>Conversation en direct</h2>
      <p>Les conversations vidéo passent par le service Napster. Votre micro est transmis à Napster pendant la conversation. Napster associe une mémoire à un identifiant pseudonyme propre à chaque partie et à chaque personnage ; il ne reçoit ni votre email ni votre nom. Les conditions de conservation de Napster sont celles du fournisseur ; nous ne pouvons pas garantir leur effacement total.</p>
      <h2>Durées prévues</h2>
      <ul>
        <li>Parties invitées : supprimées après 7 jours d’inactivité ; parties de compte : 30 jours.</li>
        <li>Journaux techniques : 14 jours.</li>
      </ul>
      <p>Vous pouvez supprimer une partie à tout moment depuis le jeu (« Supprimer ma partie ») : cela ferme les conversations en cours et efface l’état de la partie chez nous.</p>
      <p><Link href="/">Retour</Link></p>
    </main>
  );
}
