import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms" };

// Plain-language starter terms. Have a Nigerian lawyer review before launch.
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="September 2026"
      sections={[
        [
          "What Kova Studio is",
          [
            "Kova Studio is a browser tool that uses AI to transform your live webcam video into a character you choose. It is made for entertainment, creators and virtual streaming.",
          ],
        ],
        [
          "Your account",
          [
            "You need an account to go live. Keep your password safe. You are responsible for everything done with your account.",
            "You must be old enough to agree to these terms where you live.",
          ],
        ],
        [
          "What you may not do",
          [
            "Do not upload pictures you do not own or have permission to use. Do not transform into a real person without their clear consent.",
            "Do not use Kova Studio for fraud, scams, impersonation, harassment, or to deceive anyone about who you are.",
            "Do not create sexual, violent, hateful or illegal content. Do not try to remove or hide the watermark on free time, or get around time limits.",
            "We can suspend or close accounts that break these rules, without a refund of unused time.",
          ],
        ],
        [
          "Live time and payments",
          [
            "Live time is counted by the second while the AI is running. Free time is a gift and can change. Paid time does not expire unless we say so in writing.",
            "Because AI time is used the moment you go live, used time cannot be refunded.",
          ],
        ],
        [
          "Your content",
          [
            "You own what you create. You give us permission to process your video and pictures only to run the service.",
            "AI output can be imperfect or unexpected. You are responsible for what you broadcast, share or record.",
          ],
        ],
        [
          "No guarantees",
          [
            "Kova Studio depends on third-party AI and network services. We do our best to keep it running but cannot promise it will always be available or error free.",
          ],
        ],
        ["Changes", ["We may update these terms. If the changes are important, we will tell you in the app."]],
      ]}
    />
  );
}
