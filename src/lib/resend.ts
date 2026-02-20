import { Resend } from "resend";

let resendClient: Resend | null = null;

const getApiKey = () => process.env.RESEND_API_KEY?.trim();

export function isResendConfigured() {
  return Boolean(getApiKey());
}

export function getResendClient() {
  const resendApiKey = getApiKey();

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }

  return resendClient;
}
