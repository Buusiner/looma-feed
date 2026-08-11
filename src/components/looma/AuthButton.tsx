import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Mail, X } from "lucide-react";
import { createSupabaseCredentialClient, getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { markWelcomeShown } from "@/lib/splash-state";

type AuthButtonProps = {
  variant?: "header" | "sidebar";
};

type EmailStep = "credentials" | "code" | "welcome";
type AuthMode = "login" | "signup";
const EMAIL_OTP_LENGTH = 8;

export function AuthButton({ variant = "header" }: AuthButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<EmailStep>("credentials");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isEmailModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isWorking) closeEmailModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEmailModalOpen, isWorking]);

  useEffect(() => {
    if (emailStep !== "welcome") return;
    const timer = window.setTimeout(() => closeEmailModal(), 2200);
    return () => window.clearTimeout(timer);
  }, [emailStep]);

  async function signInWithGoogle() {
    setIsWorking(true);
    setError(null);

    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError("Não foi possível iniciar o login com Google.");
      setIsWorking(false);
    }
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setIsWorking(true);
    setError(null);
    const credentialClient = createSupabaseCredentialClient();

    if (authMode === "signup") {
      const { data, error: signupError } = await credentialClient.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (signupError || !data.user || data.user.identities?.length === 0) {
        setError(signupError?.message ?? "Este email já está associado a uma conta.");
        setIsWorking(false);
        return;
      }
    } else {
      const { error: passwordError } = await credentialClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (passwordError) {
        setError("Email ou password incorretos.");
        setIsWorking(false);
        return;
      }

      await credentialClient.auth.signOut({ scope: "local" });

      const { error: codeError } = await getSupabaseBrowserClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (codeError) {
        setError("A password foi validada, mas não foi possível enviar o código.");
        setIsWorking(false);
        return;
      }
    }

    setEmail(normalizedEmail);
    setCode("");
    setEmailStep("code");
    setIsWorking(false);
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== EMAIL_OTP_LENGTH) return;

    setIsWorking(true);
    setError(null);

    const { data, error: verificationError } = await getSupabaseBrowserClient().auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verificationError || !data.user) {
      setError("O código é inválido ou expirou.");
      setIsWorking(false);
      return;
    }

    markWelcomeShown(data.user);
    setEmailStep("welcome");
    setIsWorking(false);
  }

  async function resendEmailCode() {
    setIsWorking(true);
    setError(null);

    const { error: resendError } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (resendError) {
      setError("Não foi possível reenviar o código.");
    } else {
      setCode("");
    }

    setIsWorking(false);
  }

  async function signOut() {
    setIsWorking(true);
    setError(null);

    const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
    if (signOutError) setError("Não foi possível encerrar sua sessão.");
    setIsWorking(false);
  }

  function openEmailModal() {
    setEmailStep("credentials");
    setAuthMode("login");
    setError(null);
    setCode("");
    setIsEmailModalOpen(true);
  }

  function closeEmailModal() {
    setIsEmailModalOpen(false);
    setEmailStep("credentials");
    setPassword("");
    setCode("");
    setError(null);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isWorking) closeEmailModal();
  }

  const emailModal = isEmailModalOpen && typeof document !== "undefined" ? createPortal(
    <div className="email-auth-overlay" onMouseDown={handleBackdropClick}>
      <section className={`email-auth-modal email-auth-${emailStep}`} role="dialog" aria-modal="true" aria-labelledby="email-auth-title">
        {emailStep !== "welcome" ? (
          <button type="button" className="email-auth-close" onClick={closeEmailModal} disabled={isWorking} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
        <span className="looma-logo-mark email-auth-logo" role="img" aria-label="Looma" />

        {emailStep === "credentials" ? (
          <>
            <header className="email-auth-heading">
              <h1 id="email-auth-title">{authMode === "login" ? "Entrar na Looma" : "Criar conta"}</h1>
              <p>{authMode === "login" ? "Use o seu email e password para continuar." : "Crie a sua conta e confirme o email com um código."}</p>
            </header>
            <form className="email-auth-form" onSubmit={submitCredentials}>
              <label htmlFor={`modal-auth-email-${variant}`}>Email</label>
              <input
                id={`modal-auth-email-${variant}`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@email.com"
                autoComplete="email"
                required
                autoFocus
              />
              <label htmlFor={`modal-auth-password-${variant}`}>Password</label>
              <input
                id={`modal-auth-password-${variant}`}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="A sua password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                minLength={authMode === "login" ? 6 : 8}
                required
              />
              {error ? <p className="email-auth-error" role="alert">{error}</p> : null}
              <button type="submit" className="email-auth-submit" disabled={isWorking || !email.trim() || (authMode === "login" ? password.length < 6 : password.length < 8)}>
                {isWorking ? "A continuar…" : authMode === "login" ? "Login" : "Criar conta"}
              </button>
            </form>
            <button
              type="button"
              className="email-auth-mode"
              onClick={() => {
                setAuthMode((current) => current === "login" ? "signup" : "login");
                setError(null);
              }}
            >
              {authMode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Fazer login"}
            </button>
          </>
        ) : emailStep === "code" ? (
          <>
            <button type="button" className="email-auth-back" onClick={() => setEmailStep("credentials")} disabled={isWorking}>
              <ArrowLeft size={15} aria-hidden="true" /> Voltar
            </button>
            <header className="email-auth-heading">
              <h1 id="email-auth-title">Confirme o código</h1>
              <p>Enviámos um código de oito dígitos para <strong>{email}</strong>.</p>
            </header>
            <form className="email-auth-form" onSubmit={verifyEmailCode}>
              <label htmlFor={`modal-auth-code-${variant}`}>Código de verificação</label>
              <input
                id={`modal-auth-code-${variant}`}
                className="email-auth-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))}
                placeholder="00000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{8}"
                required
                autoFocus
              />
              {error ? <p className="email-auth-error" role="alert">{error}</p> : null}
              <button type="submit" className="email-auth-submit" disabled={isWorking || code.length !== EMAIL_OTP_LENGTH}>
                {isWorking ? "A verificar…" : "Confirmar código"}
              </button>
            </form>
            <button type="button" className="email-auth-mode" onClick={() => void resendEmailCode()} disabled={isWorking}>
              {isWorking ? "A reenviar…" : "Reenviar código"}
            </button>
          </>
        ) : (
          <div className="email-auth-welcome">
            <span>Bem-vindo à</span>
            <h1 id="email-auth-title">looma</h1>
            <p>We are building connections.</p>
          </div>
        )}
      </section>
    </div>,
    document.body,
  ) : null;

  if (user && !isEmailModalOpen) {
    if (variant === "sidebar") return null;

    return (
      <div className={`auth-control ${variant === "sidebar" ? "auth-control-sidebar" : ""}`}>
        <span title={user.email ?? undefined}>{user.user_metadata.full_name ?? "Sua conta"}</span>
        <button type="button" onClick={signOut} disabled={isWorking}>Sair</button>
        {error ? <small role="alert">{error}</small> : null}
      </div>
    );
  }

  return (
    <>
      <div className={`auth-control ${variant === "sidebar" ? "auth-control-sidebar" : ""}`}>
        <div className="auth-login-options">
          <button
            type="button"
            className={variant === "sidebar" ? "sidebar-google-login" : "auth-login-button"}
            onClick={signInWithGoogle}
            disabled={isWorking}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" aria-hidden="true" />
            <span>{isWorking ? "Conectando…" : "Entrar com Google"}</span>
          </button>
          <div className="auth-login-divider"><span>ou</span></div>
          <button
            type="button"
            className={variant === "sidebar" ? "sidebar-email-login" : "auth-email-login"}
            onClick={openEmailModal}
            disabled={isWorking}
          >
            <Mail size={16} aria-hidden="true" />
            <span>Login com Email</span>
          </button>
        </div>
        {error ? <small className="auth-email-error" role="alert">{error}</small> : null}
      </div>
      {emailModal}
    </>
  );
}
