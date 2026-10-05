import { useEffect, useId, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Mail, X } from "lucide-react";
import { createSupabaseCredentialClient, getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type AuthButtonProps = {
  variant?: "header" | "sidebar";
};

type EmailStep = "credentials" | "code";
type AuthMode = "login" | "signup";
const EMAIL_OTP_LENGTH = 8;

function translateAuthError(message: string) {
  const securityDelay = message.match(
    /for security purposes, you can only request this after\s+(\d+)\s+seconds?\.?/i,
  );
  if (securityDelay) {
    const seconds = Number(securityDelay[1]);
    return `Por segurança, aguarde ${seconds} ${seconds === 1 ? "segundo" : "segundos"} antes de tentar novamente.`;
  }

  return message;
}

export function AuthButton({ variant = "header" }: AuthButtonProps) {
  const formId = useId();
  const [user, setUser] = useState<User | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<EmailStep>("credentials");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth
        .getUser()
        .then(({ data, error: userError }) => {
          if (userError && userError.name !== "AuthSessionMissingError") {
            setError("Não foi possível verificar a sua sessão.");
          }
          setUser(data.user);
        })
        .catch(() => setError("Não foi possível verificar a sua sessão."));

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser((currentUser) =>
          currentUser?.id === session?.user?.id ? currentUser : (session?.user ?? null),
        );
      });
      unsubscribe = () => subscription.subscription.unsubscribe();
    } catch (caught) {
      console.error("[Looma] Não foi possível iniciar a autenticação.", caught);
      setError("Não foi possível iniciar a autenticação.");
    }

    return () => unsubscribe?.();
  }, []);

  async function signInWithGoogle() {
    setIsWorking(true);
    setError(null);
    try {
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) setError("Não foi possível iniciar o login com Google.");
    } catch (caught) {
      console.error("[Looma] Não foi possível iniciar o login com Google.", caught);
      setError("Não foi possível iniciar o login com Google.");
    } finally {
      setIsWorking(false);
    }
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;
    if (authMode === "signup" && password !== repeatPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsWorking(true);
    setError(null);
    try {
      const credentialClient = createSupabaseCredentialClient();

      if (authMode === "signup") {
        const { data, error: signupError } = await credentialClient.auth.signUp({
          email: normalizedEmail,
          password,
        });

        if (signupError || !data.user || data.user.identities?.length === 0) {
          setError(
            signupError
              ? translateAuthError(signupError.message)
              : "Este e-mail já está associado a uma conta.",
          );
          return;
        }
      } else {
        const { error: passwordError } = await credentialClient.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (passwordError) {
          setError("E-mail ou senha incorretos.");
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
          setError("A senha foi validada, mas não foi possível enviar o código.");
          return;
        }
      }

      setEmail(normalizedEmail);
      setCode("");
      setEmailStep("code");
    } catch (caught) {
      console.error("[Looma] Não foi possível continuar com o login por e-mail.", caught);
      setError("Não foi possível continuar com o login por e-mail.");
    } finally {
      setIsWorking(false);
    }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== EMAIL_OTP_LENGTH) return;

    setIsWorking(true);
    setError(null);
    try {
      const { data, error: verificationError } = await getSupabaseBrowserClient().auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (verificationError || !data.user) {
        setError("O código é inválido ou expirou.");
        return;
      }

      closeEmailModal();
    } catch (caught) {
      console.error("[Looma] Não foi possível verificar o código de acesso.", caught);
      setError("Não foi possível verificar o código agora.");
    } finally {
      setIsWorking(false);
    }
  }

  async function resendEmailCode() {
    setIsWorking(true);
    setError(null);
    try {
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
    } catch (caught) {
      console.error("[Looma] Não foi possível reenviar o código.", caught);
      setError("Não foi possível reenviar o código.");
    } finally {
      setIsWorking(false);
    }
  }

  async function signOut() {
    setIsWorking(true);
    setError(null);
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) setError("Não foi possível encerrar sua sessão.");
    } catch (caught) {
      console.error("[Looma] Não foi possível encerrar a sessão.", caught);
      setError("Não foi possível encerrar sua sessão.");
    } finally {
      setIsWorking(false);
    }
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
    setRepeatPassword("");
    setCode("");
    setError(null);
  }

  const emailModal = (
    <Dialog
      open={isEmailModalOpen}
      onOpenChange={(open) => {
        if (!open && !isWorking) closeEmailModal();
      }}
    >
      <DialogContent
        className={`email-auth-modal email-auth-step-${emailStep}`}
        showClose={false}
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (isWorking) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isWorking) event.preventDefault();
        }}
      >
        <button
          type="button"
          className="email-auth-close"
          onClick={closeEmailModal}
          disabled={isWorking}
          aria-label="Fechar"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <span className="looma-logo-mark email-auth-logo" role="img" aria-label="Looma" />

        {emailStep === "credentials" ? (
          <>
            <header className="email-auth-heading">
              <DialogTitle asChild>
                <h1>{authMode === "login" ? "Entrar na Looma" : "Criar conta"}</h1>
              </DialogTitle>
              <p>
                {authMode === "login"
                  ? "Use o seu e-mail e senha para continuar."
                  : "Crie a sua conta e confirme o e-mail com um código."}
              </p>
            </header>
            <form className="email-auth-form" onSubmit={submitCredentials}>
              <label htmlFor={`modal-auth-email-${formId}`}>E-mail</label>
              <input
                id={`modal-auth-email-${formId}`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@email.com"
                autoComplete="email"
                required
                autoFocus
              />
              <label htmlFor={`modal-auth-password-${formId}`}>Senha</label>
              <input
                id={`modal-auth-password-${formId}`}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="A sua senha"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                minLength={authMode === "login" ? 6 : 8}
                required
              />
              {authMode === "signup" ? (
                <>
                  <label htmlFor={`modal-auth-repeat-password-${formId}`}>Repetir senha</label>
                  <input
                    id={`modal-auth-repeat-password-${formId}`}
                    type="password"
                    value={repeatPassword}
                    onChange={(event) => setRepeatPassword(event.target.value)}
                    placeholder="Repita a sua senha"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </>
              ) : null}
              {error ? (
                <p className="email-auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="email-auth-submit"
                disabled={
                  isWorking ||
                  !email.trim() ||
                  (authMode === "login"
                    ? password.length < 6
                    : password.length < 8 ||
                      repeatPassword.length < 8 ||
                      password !== repeatPassword)
                }
              >
                {isWorking ? "A continuar…" : authMode === "login" ? "Login" : "Criar conta"}
              </button>
            </form>
            <button
              type="button"
              className="email-auth-mode"
              onClick={() => {
                setAuthMode((current) => (current === "login" ? "signup" : "login"));
                setRepeatPassword("");
                setError(null);
              }}
            >
              {authMode === "login"
                ? "Ainda não tem conta? Criar conta"
                : "Já tem conta? Fazer login"}
            </button>
          </>
        ) : (
          <>
            <header className="email-auth-heading">
              <DialogTitle asChild>
                <h1>Confirme o código</h1>
              </DialogTitle>
              <p>
                Enviámos um código de oito dígitos para <strong>{email}</strong>.
              </p>
            </header>
            <form className="email-auth-form" onSubmit={verifyEmailCode}>
              <label htmlFor={`modal-auth-code-${formId}`}>Código de verificação</label>
              <input
                id={`modal-auth-code-${formId}`}
                className="email-auth-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))
                }
                placeholder="Digite o código de 8 dígitos"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{8}"
                required
                autoFocus
              />
              {error ? (
                <p className="email-auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="email-auth-submit"
                disabled={isWorking || code.length !== EMAIL_OTP_LENGTH}
              >
                {isWorking ? "A verificar…" : "Confirmar código"}
              </button>
            </form>
            <button
              type="button"
              className="email-auth-mode"
              onClick={() => void resendEmailCode()}
              disabled={isWorking}
            >
              {isWorking ? "A reenviar…" : "Reenviar código"}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  if (user && !isEmailModalOpen) {
    if (variant === "sidebar") return null;

    return (
      <div className="auth-control">
        <span title={user.email ?? undefined}>
          {user.user_metadata["full_name"] ?? "Sua conta"}
        </span>
        <button type="button" onClick={signOut} disabled={isWorking}>
          Sair
        </button>
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
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt=""
              aria-hidden="true"
            />
            <span>{isWorking ? "Conectando…" : "Entrar com Google"}</span>
          </button>
          <div className="auth-login-divider">
            <span>ou</span>
          </div>
          <button
            type="button"
            className={variant === "sidebar" ? "sidebar-email-login" : "auth-email-login"}
            data-ui-sound="none"
            onClick={openEmailModal}
            disabled={isWorking}
          >
            <Mail size={16} aria-hidden="true" />
            <span>Login com Email</span>
          </button>
        </div>
        {error ? (
          <small className="auth-email-error" role="alert">
            {error}
          </small>
        ) : null}
      </div>
      {emailModal}
    </>
  );
}
