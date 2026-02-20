import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { admin } from "better-auth/plugins";
import { getResendClient } from "./resend";
import { ResetPasswordEmail } from "../components/emails/resetPassword-email";
import { VerifyEmail } from "../components/emails/verify-email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,

    requireEmailVerification:
      process.env.RESEND_SEND_VERIFICATION !== undefined
        ? process.env.RESEND_SEND_VERIFICATION === "true"
        : false,

    sendResetPassword: async ({ user, url }) => {
      try {
        const resend = getResendClient();

        const { error } = await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL || "Hiéraflow <no-reply@contact.fr>",
          to: user.email,
          subject: "Hiéraflow - Réinitialisation de votre mot de passe",
          react: ResetPasswordEmail({ url }),
        });

        if (error) {
          console.error("❌ Erreur Resend:", error);
          throw error;
        }
      } catch (error) {
        console.error(
          "❌ Erreur lors de l'envoi de l'email de réinitialisation:",
          error,
        );
        throw error;
      }
    },
  },
  emailVerification: {
    sendOnSignUp:
      process.env.RESEND_SEND_VERIFICATION !== undefined
        ? process.env.RESEND_SEND_VERIFICATION === "true"
        : false,

    sendVerificationEmail: async ({ user, url }) => {
      try {
        const resend = getResendClient();

        await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL || "Hiéraflow <no-reply@contact.fr>",
          to: user.email,
          subject: "Hiéraflow - Vérification de votre adresse e-mail",
          react: VerifyEmail({ url }),
        });
      } catch (error) {
        console.error(
          "Erreur lors de l'envoi de l'email de vérification :",
          error,
        );
      }
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,

      // sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
      //   await resend.emails.send({
      //     from:
      //       process.env.RESEND_FROM_EMAIL || "Hiéraflow <no-reply@contact.fr>",
      //     to: user.email,
      //     subject: "Hiéraflow - Confirmez le changement d'adresse email",
      //     react: ChangeEmailRequestEmail({
      //       url,
      //       currentEmail: user.email,
      //       newEmail,
      //     }),
      //   });
      // },
    },
  },
  plugins: [
    admin({
      defaultRole: "user",
      defaultBanReason: "ACCOUNT_DISABLED",
    }),
  ],
});
