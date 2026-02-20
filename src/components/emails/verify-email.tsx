interface VerifyEmailProps {
  url: string;
}

export function VerifyEmail({ url }: VerifyEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#ffffff",
      }}
    >
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          border: "1px solid #e9ecef",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1
            style={{
              color: "#1a1a1a",
              fontSize: "28px",
              fontWeight: "bold",
              margin: "0 0 10px 0",
              letterSpacing: "-0.5px",
            }}
          >
            Hiéraflow
          </h1>
          <div
            style={{
              width: "60px",
              height: "4px",
              backgroundColor: "#3b82f6",
              margin: "0 auto",
              borderRadius: "2px",
            }}
          ></div>
        </div>

        {/* Main Content */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2
            style={{
              color: "#1a1a1a",
              fontSize: "24px",
              fontWeight: "600",
              margin: "0 0 15px 0",
            }}
          >
            Vérifier votre adresse e-mail
          </h2>

          <p
            style={{
              color: "#4b5563",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 30px 0",
              maxWidth: "500px",
              marginLeft: "auto",
              marginRight: "auto",
              textAlign: "justify",
            }}
          >
            Bonjour, <br />
            Votre compte a été créer avec succès. Afin de pouvoir vous connecter
            à celui-ci, veuillez dans un premier temps vérifier votre adresse
            e-mail. Pour des raisons de sécurité, ce lien expirera dans 24
            heures. Si ce lien ne fonctionne plus, veuillez contacter le
            support.
          </p>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <a
            href={url}
            style={{
              backgroundColor: "#3b82f5",
              color: "#ffffff",
              padding: "16px 32px",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              display: "inline-block",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              transition: "all 0.2s ease",
              border: "2px solid #3b82f5",
            }}
          >
            Vérifier mon adresse e-mail
          </a>
        </div>

        {/* Fallback Link */}
        <div style={{ marginBottom: "30px" }}>
          <p
            style={{
              color: "#6b7280",
              fontSize: "14px",
              lineHeight: "1.6",
              margin: "0 0 10px 0",
              textAlign: "center",
            }}
          >
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre
            navigateur :
          </p>
          <div
            style={{
              backgroundColor: "#f3f4f6",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              wordBreak: "break-all",
              fontSize: "12px",
              color: "#374151",
              fontFamily: "monospace",
            }}
          >
            {url}
          </div>
        </div>

        {/* Security Note */}
        <div
          style={{
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            padding: "16px",
            marginBottom: "30px",
          }}
        >
          <p
            style={{
              color: "#92400e",
              fontSize: "14px",
              lineHeight: "1.6",
              margin: "0",
              fontWeight: "500",
            }}
          >
            ⚠️ Si vous n'avez pas demandé la création d'un compte, ignorez cet
            email.
          </p>
        </div>

        {/* Footer */}
        <hr
          style={{
            border: "none",
            borderTop: "1px solid #e5e7eb",
            margin: "30px 0",
          }}
        />
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
              margin: "0 0 5px 0",
            }}
          >
            Cordialement,
          </p>
          <p
            style={{
              color: "#6b7280",
              fontSize: "16px",
              fontWeight: "600",
              margin: "0",
            }}
          >
            L'équipe Hiéraflow
          </p>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "12px",
              margin: "10px 0 0 0",
            }}
          >
            Cet email a été envoyé automatiquement. Ne pas répondre.
          </p>
        </div>
      </div>
    </div>
  );
}
