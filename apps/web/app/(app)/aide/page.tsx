import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { StartTourButton } from "@/components/tour/start-tour-button";
import { Card } from "@/components/ui/card";
import { DOJO } from "@/lib/dojo";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Aide" };

type Guide = { question: string; steps: ReactNode[] };

const link = (href: string, label: string) => (
  <Link href={href} className="font-medium text-accent underline underline-offset-2">
    {label}
  </Link>
);

/* The words in quotes are the exact labels on screen: change them together. */
const memberGuides: Guide[] = [
  {
    question: "Comment remplir mon profil ?",
    steps: [
      <>Ouvrez {link("/profil", "« Mon profil »")} dans le menu.</>,
      "Remplissez chaque case : nom, téléphone, date de naissance, adresse, personne à prévenir en cas d'accident.",
      "Appuyez sur « Enregistrer mon profil », en bas du cadre. Un message vert confirme l'enregistrement.",
    ],
  },
  {
    question: "Comment payer ma cotisation ?",
    steps: [
      <>Ouvrez {link("/cotisation", "« Ma cotisation »")} dans le menu.</>,
      "Choisissez votre formule et la façon de payer (en une fois ou en plusieurs fois, selon ce qui est proposé).",
      "Appuyez sur « Payer ma cotisation ». Une page de paiement sécurisée s'ouvre : saisissez votre carte bancaire.",
      "À la fin, vous revenez automatiquement sur l'espace du dojo. Votre cotisation apparaît comme « Actif ».",
    ],
  },
  {
    question: "Comment envoyer mon certificat médical ?",
    steps: [
      <>Ouvrez {link("/documents", "« Mes documents »")} dans le menu.</>,
      "Dans « Type de document », choisissez le certificat médical.",
      "Choisissez le fichier. Sur téléphone, vous pouvez prendre directement le certificat en photo : posez-le à plat, bien éclairé.",
      "Indiquez la date jusqu'à laquelle il est valable, puis appuyez sur « Envoyer le document ».",
    ],
  },
  {
    question: "Où trouver ma licence ?",
    steps: [
      <>Ouvrez {link("/licences", "« Mes licences »")} dans le menu.</>,
      "Le dojo y dépose votre licence chaque saison. Vous n'avez rien à faire, sinon garder votre profil complet.",
    ],
  },
  {
    question: "Comment écrire à un autre membre ?",
    steps: [
      <>Ouvrez {link("/annuaire", "« Annuaire »")} et trouvez la personne.</>,
      "Appuyez sur « Envoyer un message », écrivez votre texte dans « Votre message », puis appuyez sur « Envoyer ».",
      <>Les réponses arrivent dans {link("/messagerie", "« Messagerie »")}. Un chiffre à côté indique un nouveau message.</>,
    ],
  },
  {
    question: "Comment apparaître dans l'annuaire ?",
    steps: [
      <>Ouvrez {link("/profil", "« Mon profil »")}.</>,
      "Dans le cadre « Annuaire des membres », cochez « Apparaître dans l'annuaire des membres ». Vous pouvez décocher à tout moment.",
    ],
  },
  {
    question: "Comment changer mon mot de passe ?",
    steps: [
      <>Ouvrez {link("/profil", "« Mon profil »")}, cadre « Mot de passe ».</>,
      "Tapez votre mot de passe actuel, puis le nouveau deux fois. Il doit compter au moins 10 caractères : une petite phrase facile à retenir convient très bien.",
      "Appuyez sur « Changer le mot de passe ».",
      `Mot de passe oublié ? Sur la page de connexion, touchez « Mot de passe oublié ? » : un lien arrive par e-mail. Sans accès à vos e-mails, appelez le bureau au ${DOJO.phone}.`,
    ],
  },
  {
    question: "Le texte est trop petit",
    steps: [
      "Sur ordinateur : maintenez la touche « Ctrl » (« Cmd » sur Mac) et appuyez sur « + » pour agrandir, sur « - » pour réduire.",
      "Sur téléphone : posez deux doigts sur l'écran et écartez-les.",
      "Le bouton en forme de lune ou de soleil, en bas du menu, passe l'écran en fond sombre ou clair.",
    ],
  },
];

const adminGuides: Guide[] = [
  {
    question: "Accueillir une personne qui veut découvrir le dojo",
    steps: [
      <>Ouvrez {link("/admin/demandes", "« Demandes »")} : chaque nouvelle demande y apparaît, avec un chiffre dans le menu.</>,
      "Ouvrez la demande, lisez le message et, si besoin, proposez un cours d'essai.",
      "Appuyez sur « Envoyer un lien d'inscription » : la personne reçoit un e-mail pour créer son compte.",
    ],
  },
  {
    question: "Donner un compte à un pratiquant qui vient déjà au dojo",
    steps: [
      <>Ouvrez {link("/admin/invitations", "« Invitations »")}.</>,
      "Indiquez son prénom, son nom et son adresse e-mail (vérifiez-la avec lui), puis appuyez sur « Créer le code ».",
      "Il reçoit un code par e-mail et l'utilise sur la page « Activer mon compte ». Le code est valable 14 jours.",
      <>S&apos;il ne peut pas le faire seul : {link("/admin/membres", "« Membres »")}, puis « Créer un membre ».</>,
    ],
  },
  {
    question: "Relancer un pratiquant qui n'a pas payé",
    steps: [
      <>Ouvrez {link("/admin/pratiquants", "« Pratiquants »")}.</>,
      "Repérez la ligne du pratiquant et appuyez sur « Relancer ». Ajoutez un mot si vous le souhaitez.",
      "Il reçoit un e-mail avec un lien vers sa cotisation. La relance est notée sur sa fiche.",
    ],
  },
  {
    question: "Demander puis déposer une licence",
    steps: [
      <>Sur la fiche du membre ({link("/admin/membres", "« Membres »")}), cadre des demandes de licence : « Demander la licence ».</>,
      <>Dans {link("/admin/licences", "« Licences »")}, exportez les informations et saisissez-les sur l&apos;extranet de la fédération, puis marquez la demande comme envoyée.</>,
      "Quand la licence arrive, déposez-la sur la fiche du membre avec « Enregistrer la licence » : la demande se clôt toute seule.",
    ],
  },
  {
    question: "Montrer un document du dojo aux membres",
    steps: [
      <>Ouvrez {link("/admin/documents", "« Documents du dojo »")} et ajoutez le document.</>,
      "Il est privé au départ. Choisissez de le publier sur le panneau d'annonces ou dans les documents importants pour que les membres le voient.",
    ],
  },
];

function GuideList({ guides }: { guides: Guide[] }) {
  return (
    <div className="flex flex-col gap-2">
      {guides.map((guide) => (
        <details key={guide.question} className="group rounded-lg border border-line bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent">
            {guide.question}
            <span aria-hidden className="text-lg leading-none text-accent transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <ol className="flex list-decimal flex-col gap-1.5 px-4 pt-0 pb-4 pl-9 text-sm leading-relaxed text-muted">
            {guide.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

async function Help() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Card title="Visite guidée" description="Une présentation de l'espace, une étape à la fois. Elle ne modifie rien.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <StartTourButton variant="member" label="Revoir la visite guidée" />
          {isAdmin && (
            <StartTourButton variant="admin" label="Visite de l'administration" buttonVariant="secondary" />
          )}
        </div>
      </Card>

      <section aria-labelledby="guides-title" className="flex flex-col gap-4">
        <h2 id="guides-title" className="font-serif text-lg font-bold text-ink">
          Pas à pas
        </h2>
        <p className="text-sm text-muted">Appuyez sur une question pour voir les étapes.</p>
        <GuideList guides={memberGuides} />
      </section>

      {isAdmin && (
        <section aria-labelledby="admin-guides-title" className="flex flex-col gap-4">
          <h2 id="admin-guides-title" className="font-serif text-lg font-bold text-ink">
            Administration
          </h2>
          <GuideList guides={adminGuides} />
        </section>
      )}

      <Card title="Besoin d'une personne ?">
        <p className="text-sm leading-relaxed text-ink">
          Le bureau du dojo vous aide volontiers : appelez le{" "}
          <a href={DOJO.phoneHref} className="font-medium text-accent underline underline-offset-2">
            {DOJO.phone}
          </a>{" "}
          ou écrivez à{" "}
          <a href={`mailto:${DOJO.email}`} className="font-medium text-accent underline underline-offset-2">
            {DOJO.email}
          </a>
          .
        </p>
      </Card>
    </div>
  );
}

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Aide" description="Tout ce qu'il faut pour utiliser l'espace du dojo, expliqué simplement." />
      <Suspense fallback={<PageFallback />}>
        <Help />
      </Suspense>
    </>
  );
}
