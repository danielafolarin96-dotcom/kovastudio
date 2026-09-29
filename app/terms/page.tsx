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
            "Do not use Kova Studio for fraud, scams, impersonation, harassment, or to deceive anyone about who you are, or automate the service with bots, scripts or modified apps.",
            "Do not create sexual, violent, hateful or illegal content. Do not try to remove or hide the watermark on free time, or get around time limits.",
            "We can suspend or close accounts that break these rules, without a refund of unused time.",
          ],
        ],
        [
          "Backgrounds and prompts",
          [
            "You can type a background or extra details to change how your video looks. You are responsible for what you type and for the video you create with it.",
            "Do not use prompts to create sexual, violent, hateful, illegal or deceptive content, or to show a real person without their consent.",
            "We may block certain words, and we may suspend accounts that misuse prompts, with no refund of unused time.",
            "Results vary. The AI may change your background or character in unexpected ways, and we can't promise a specific look.",
          ],
        ],
        [
          "Live time and payments",
          [
            "Live time is counted by the second while the AI is running. It is reserved from your balance when you go live. Unused reserved time is returned when you stop.",
            "You can only use the time you have paid for. Trying to get around time limits, balances or the watermark is a breach of these terms.",
            "Prices are in naira and payments go through Paystack. We don't see or store your card details.",
            "Paid time does not expire unless we say so in writing.",
            "Refunds: if you haven't used any of a purchase, you can ask for a refund within 7 days of paying. Time already used can't be refunded.",
            "If a payment goes through but credits don't show up, contact us with your Paystack reference and we'll fix it.",
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
