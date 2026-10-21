import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Confidentialité et cookies" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-bold text-ink">Confidentialité et cookies</h1>
        <p className="text-sm text-muted">Comment le Shobukan Dojo traite vos données dans l&apos;espace membres.</p>
      </header>

      <Section title="Responsable du traitement">
        <p>Le Shobukan Dojo, club de kendo, représenté par son bureau.</p>
      </Section>

      <Section title="Données collectées">
        <ul className="list-disc space-y-1 pl-5">
          <li>Identité : nom, prénom, photo si vous en ajoutez une.</li>
          <li>Coordonnées : adresse e-mail, téléphone, adresse postale, personne à prévenir en cas d&apos;urgence.</li>
          <li>Informations pour la licence FFK : date de naissance, sexe, nationalité, numéro de licence.</li>
          <li>
            Certificat médical : le document et sa date de validité, visibles uniquement par vous et les
            administrateurs du dojo.
          </li>
          <li>
            Paiements : réglés chez Stripe. Le dojo reçoit le statut de votre cotisation et l&apos;historique des
            paiements, jamais vos données de carte bancaire.
          </li>
          <li>Messages échangés avec les autres membres via la messagerie.</li>
          <li>Demandes envoyées depuis « Nous rejoindre » : nom, coordonnées et message.</li>
        </ul>
      </Section>

      <Section title="Finalités">
        <p>
          Gérer votre adhésion et votre cotisation, établir votre licence auprès de la FFK, vérifier votre aptitude
          médicale à la pratique, vous contacter, et permettre les échanges entre membres. L&apos;annuaire des membres
          est facultatif : vous n&apos;y apparaissez que si vous l&apos;activez dans votre profil.
        </p>
      </Section>

      <Section title="Durée de conservation">
        <p>Durée de conservation : à préciser par le bureau.</p>
        <p>Les factures restent conservées chez Stripe pendant la durée exigée par la loi.</p>
      </Section>

      <Section title="Vos droits">
        <p>
          Vous pouvez accéder à vos données, les rectifier ou demander leur effacement. La plupart se modifient
          directement depuis « Mon profil ». Pour toute autre demande, contactez le bureau du dojo. Vous pouvez aussi
          adresser une réclamation à la CNIL.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          L&apos;espace membres dépose un seul cookie, <code className="font-mono text-xs">shobukapp_session</code>,
          strictement nécessaire pour vous garder connecté. Il ne sert à rien d&apos;autre et disparaît quand vous
          vous déconnectez ou quand votre session expire.
        </p>
        <p>
          Aucun cookie de mesure d&apos;audience ni de publicité. Lors du paiement, vous êtes redirigé vers Stripe,
          qui dépose ses propres cookies sur son domaine pour sécuriser la transaction.
        </p>
        <p>
          Vos préférences d&apos;affichage (thème clair ou sombre, fermeture de ce bandeau) sont gardées dans votre
          navigateur et ne sont jamais envoyées au dojo.
        </p>
      </Section>

      <p className="text-sm">
        <Link href="/" className="font-medium text-accent hover:underline">
          Retour à l&apos;accueil
        </Link>
      </p>
    </article>
  );
}
