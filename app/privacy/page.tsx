import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

// Plain-language starter policy. Have it reviewed against the Nigeria Data Protection Act before launch.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="September 2026"
      sections={[
        [
          "What we collect",
          [
            "Your email, creator name and password (stored securely by our login provider, Supabase).",
            "Your live time balance and a record of your sessions: when they started, how long they ran and the character name.",
            "When you buy credits: the date, the pack, the amount you paid, how you paid (for example bank transfer or Paystack) and any payment reference. We never see or store your card details.",
          ],
        ],
        [
          "Your camera and pictures",
          [
            "Your webcam video and the character picture you pick are sent to our AI provider (Decart, the maker of the Lucy model, reached directly or through fal.ai) only while you are live, to create the transformed video.",
            "We do not store your webcam video. Pictures you upload in the studio are not saved to our servers. Recordings are saved only on your own computer.",
          ],
        ],
        [
          "Your channel",
          [
            "If you turn on your channel, anyone with your watch link can see your transformed video while you are live. You can turn it off or reset the link at any time.",
          ],
        ],
        [
          "Who we share with",
          [
            "Supabase (accounts and database), Decart and fal.ai (AI video), and Vercel (hosting). We do not sell your data.",
          ],
        ],
        [
          "Your choices",
          [
            "You can ask us to see, correct or delete your data. Deleting your account removes your profile and session history.",
          ],
        ],
      ]}
    />
  );
}
