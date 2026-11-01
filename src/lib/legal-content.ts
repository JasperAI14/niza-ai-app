// Shared legal copy for the public Privacy Policy and Terms of Service pages,
// and for the in-app Privacy Policy screen. Public pages must stay readable
// without signing in (Google's verification team reads them logged out).
// Never name internal engines, providers, keys or infrastructure here.

export type LegalSection = { title: string; paragraphs: string[]; bullets?: string[] };

export const PRIVACY_UPDATED = "1 November 2026";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "1. Introduction",
    paragraphs: [
      "Niza Prime AI (\"the app\", \"we\", \"us\") is an AI assistant service that offers conversation, image generation and editing, live web search, video and image discovery, document reading, coding help, and in-chat video editing.",
      "This policy explains what information we collect, why we collect it, how it is protected, and the choices you have. It applies to every visitor and account holder, whether you access the app through a browser or an installed app.",
      "By creating an account or using the app, you agree to this policy. If you do not agree, please do not use the app.",
    ],
  },
  {
    title: "2. Information we collect",
    paragraphs: ["We collect only the information needed to run the service:"],
    bullets: [
      "Account information: the email address linked to your sign-in method, a unique account identifier, and the profile details you choose to add (display name, username, profile picture).",
      "Conversation content: the messages you send and the replies you receive, including pictures, documents, videos and audio you upload or create inside the app.",
      "Connection information: if you choose to connect a cloud storage account (such as Google Drive), we store the authorisation needed to keep that connection working, along with the identity of the account you connected.",
      "Usage information: counts of messages and images used within each billing window, your subscription plan, and technical logs needed to keep the service reliable and secure.",
      "Payment information: handled by our payment processor. We never see or store your full card details.",
    ],
  },
  {
    title: "3. Google user data and Google Drive",
    paragraphs: [
      "If you connect Google Drive, you are asked to grant access to your Google account. That access is used solely to store your own app content — the images, videos, documents and files you create or upload in Niza Prime AI — inside a dedicated folder the app creates in your Drive.",
      "The app only creates, reads, updates and deletes files it placed in that folder. It does not read, list, modify or share any other files in your Drive, and it does not use your Google user data for any other purpose.",
      "Your Google user data is never sold, never shared with third parties except as described in section 6, and never used for advertising of any kind.",
      "You can disconnect Google Drive at any time from the app's Profile screen, or revoke the app's access from your Google account's security settings at any time. Disconnecting stops all access immediately; files already saved remain in your Drive and belong to you.",
    ],
  },
  {
    title: "4. How your information is used",
    paragraphs: ["We use your information to:"],
    bullets: [
      "Create and maintain your account and sign you in securely.",
      "Store your conversations, settings and files so they are available on your account across devices.",
      "Process your requests — answers, images, searches, code, document reading and video edits.",
      "Apply your plan, usage limits and any promo entitlements, and process Premium subscriptions through our payment processor.",
      "Provide support, respond to feedback, and fix problems reported to us.",
      "Keep the service safe: detect abuse, prevent unauthorised access, and comply with the law.",
    ],
  },
  {
    title: "5. Advertising and profiling",
    paragraphs: [
      "We do not sell your personal information. We do not share it for advertising, and we do not use it to build advertising profiles. There is no third-party behavioural advertising in Niza Prime AI.",
    ],
  },
  {
    title: "6. Sharing",
    paragraphs: [
      "Your conversations and files belong to your account and are not visible to other users. We share information only with the categories of service providers needed to run the app, and only for that purpose:",
    ],
    bullets: [
      "Hosting and database providers that store your account data securely.",
      "Our payment processor, which handles Premium subscription payments.",
      "Sign-in providers you choose to use (such as Google), strictly to authenticate you.",
      "Cloud storage you choose to connect (such as Google Drive), strictly to store your own content in your own folder.",
      "Competent authorities, where the law genuinely requires disclosure.",
    ],
  },
  {
    title: "7. Data security",
    paragraphs: [
      "Access to your data is separated per account: no other user can read your conversations or files while signed in. Files you create are kept in private storage and are opened through short-lived, expiring links.",
      "Connections, sign-in sessions and payment flows are protected with industry-standard encryption in transit. We apply security updates to the app and its infrastructure on an ongoing basis.",
      "No method of transmission or storage is perfectly secure, but we design our systems to limit what any incident could expose.",
    ],
  },
  {
    title: "8. Retention and deletion",
    paragraphs: [
      "Your conversations, files and settings are kept for as long as your account is active, so the app can restore them when you sign in again.",
      "You can delete an individual chat at any time by pressing and holding it in the chat list; deleting a chat removes its messages and the media created in it. Files you connected to your own cloud storage stay in your storage until you delete them there.",
      "You can request full deletion of your account and its content by contacting our Support Team from Profile, then Contact Support. We complete verified deletion requests and confirm when they are done, except where the law requires us to retain specific records (for example payment records).",
    ],
  },
  {
    title: "9. Your choices and rights",
    paragraphs: ["You are always in control of your data. You can:"],
    bullets: [
      "Update your profile details at any time from Personal Information.",
      "Connect or disconnect cloud storage at any time from the Profile screen.",
      "Delete individual chats, or request full account deletion through Support.",
      "Contact Support to ask what data we hold about you, to correct it, or to export what you created.",
    ],
  },
  {
    title: "10. Children",
    paragraphs: [
      "Niza Prime AI is intended for people aged 13 and above. We do not knowingly create accounts for children under 13. If you believe a child under 13 has created an account, please contact Support and we will remove it.",
    ],
  },
  {
    title: "11. Changes to this policy",
    paragraphs: [
      "If this policy changes, we will update this page and the date at the top. Continuing to use Niza Prime AI after a change means you accept the updated policy.",
    ],
  },
  {
    title: "12. Contact",
    paragraphs: [
      "Questions about privacy can be sent from Profile, then Contact Support, and our Support Team will respond as soon as possible.",
    ],
  },
];

export const TERMS_UPDATED = "1 November 2026";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "1. Acceptance of terms",
    paragraphs: [
      "These Terms of Service (\"Terms\") govern your use of Niza Prime AI (\"the app\"). By creating an account or using the app, you agree to these Terms and to our Privacy Policy.",
      "If you do not agree with these Terms, do not use the app.",
    ],
  },
  {
    title: "2. Eligibility and accounts",
    paragraphs: [
      "You must be at least 13 years old to use the app. You are responsible for keeping your sign-in credentials safe, for all activity under your account, and for providing accurate information where it is required.",
      "Each account is personal to you. Do not share your account with others or use it to provide a paid service to third parties without our permission.",
    ],
  },
  {
    title: "3. Acceptable use",
    paragraphs: ["When using the app, you agree not to:"],
    bullets: [
      "Break any law or the rights of any person, including intellectual-property and privacy rights.",
      "Create, request or spread unlawful, deceptive, harassing, or sexually explicit content involving minors, or content intended to harm others.",
      "Attempt to disrupt, overload, reverse-engineer, or gain unauthorised access to the app or its systems.",
      "Abuse the service through automated bulk access, credential sharing, or circumventing usage limits and payments.",
    ],
  },
  {
    title: "4. AI-generated content",
    paragraphs: [
      "Answers, images, code, summaries and edits are produced automatically and may be wrong or incomplete. Verify anything important — especially medical, legal, financial or safety-related information — before relying on it.",
      "Search results and cited links come from live sources at the time of your request; content at those links is controlled by its own owners. Videos are played through their official players and cannot be downloaded from the app.",
      "Do not use AI output as the sole basis for decisions that could affect a person's health, safety, livelihood or legal rights.",
    ],
  },
  {
    title: "5. Your content",
    paragraphs: [
      "You keep ownership of the content you create or upload. You give us the limited permission needed to store, process and display it within your account so the app can function — for example, to keep your chat history, apply requested edits, or save files to the cloud storage you connected.",
      "You are responsible for making sure you have the rights to the content you upload.",
    ],
  },
  {
    title: "6. Premium plans and billing",
    paragraphs: [
      "The app offers monthly Premium plans: Total Premium at ₦7,000, Chat Premium at ₦2,500, Images Premium at ₦2,500, and Video Editing Premium at ₦2,000. The plan and its price are shown before you pay, and payment is handled by our payment processor.",
      "A plan applies to the account that paid for it and remains active for the period you paid for. We do not promise a specific outcome from any AI feature; plan entitlements unlock features and limits, not results.",
      "If a payment does not complete, the plan is not activated. If you believe a payment was taken in error, contact Support from Profile, then Contact Support, and we will investigate.",
    ],
  },
  {
    title: "7. Availability and changes",
    paragraphs: [
      "We work to keep the app available and reliable, but we do not guarantee uninterrupted or error-free service. Features may change, be suspended, or be discontinued as the product evolves; we aim to give reasonable notice for changes that remove functionality you paid for.",
    ],
  },
  {
    title: "8. Suspension and termination",
    paragraphs: [
      "We may suspend or close an account that breaks these Terms, abuses the service, or creates legal or security risk for us or others. Where practical, we will explain what happened and what can be done.",
      "You may stop using the app at any time and request deletion of your account and content through Support.",
    ],
  },
  {
    title: "9. Disclaimers and liability",
    paragraphs: [
      "The app is provided \"as is\" and \"as available\". To the fullest extent permitted by law, we are not liable for indirect or consequential loss arising from your use of the app, or from reliance on AI-generated content.",
      "Nothing in these Terms limits liability that cannot be limited by law.",
    ],
  },
  {
    title: "10. Changes to these Terms",
    paragraphs: [
      "We may update these Terms as the product and the law evolve. We will publish the updated version on this page with a new date. Significant changes will be highlighted in the app.",
    ],
  },
  {
    title: "11. Contact",
    paragraphs: [
      "Questions about these Terms can be sent from Profile, then Contact Support.",
    ],
  },
];
