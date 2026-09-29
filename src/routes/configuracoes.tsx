import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Laptop, Lock, Moon, Settings, Sun, UserRound } from "lucide-react";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { useCurrentProfile } from "@/lib/profile";
import { createSupabaseCredentialClient, getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getStoredTheme, saveTheme, type LoomaTheme } from "@/lib/theme";

type SettingsRow = {
  email_connection_notifications: boolean;
  email_proposal_notifications: boolean;
  is_profile_public: boolean;
};
type Tab = "account" | "notifications" | "privacy";

function maskEmailAddress(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "E-mail protegido";

  const visibleLocalPart = localPart.slice(0, Math.min(2, localPart.length));
  const visibleDomain = domain.slice(0, Math.min(2, domain.length));
  return `${visibleLocalPart}${"•".repeat(Math.max(3, localPart.length - visibleLocalPart.length))}@${visibleDomain}${"•".repeat(Math.max(3, domain.length - visibleDomain.length))}`;
}

export const Route = createFileRoute("/configuracoes")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useCurrentProfile();
  const [tab, setTab] = useState<Tab>("account");
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSetting, setSavingSetting] = useState<keyof SettingsRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<LoomaTheme>(getStoredTheme);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordFields, setPasswordFields] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    repeatNewPassword: "",
  });

  const load = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setSettings(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await getSupabaseBrowserClient()
        .from("user_settings")
        .select("email_connection_notifications, email_proposal_notifications, is_profile_public")
        .eq("user_id", userId)
        .maybeSingle();

      if (queryError) {
        setError(queryError.message);
      } else {
        setSettings(
          (data as SettingsRow | null) ?? {
            email_connection_notifications: true,
            email_proposal_notifications: true,
            is_profile_public: true,
          },
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível carregar configurações.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateSetting(key: keyof SettingsRow, value: boolean) {
    if (!user || !settings || savingSetting) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setError(null);
    setSavingSetting(key);
    try {
      const { error: upsertError } = await getSupabaseBrowserClient()
        .from("user_settings")
        .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });

      if (upsertError) {
        setError(upsertError.message);
        await load();
      } else {
        setNotice("Configuração salva.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível salvar a configuração.",
      );
      await load();
    } finally {
      setSavingSetting(null);
    }
  }

  function updateTheme(nextTheme: LoomaTheme) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }

  const usesPasswordLogin =
    user?.identities?.some((identity) => identity.provider === "email") ?? false;

  function updatePasswordField(field: keyof typeof passwordFields, value: string) {
    setPasswordFields((current) => ({ ...current, [field]: value }));
  }

  function closePasswordForm() {
    if (isChangingPassword) return;
    setIsPasswordFormOpen(false);
    setPasswordError(null);
    setPasswordFields({ email: "", currentPassword: "", newPassword: "", repeatNewPassword: "" });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.email || !usesPasswordLogin || isChangingPassword) return;

    const confirmedEmail = passwordFields.email.trim().toLowerCase();
    const accountEmail = user.email.toLowerCase();
    if (confirmedEmail !== accountEmail) {
      setPasswordError("Digite o mesmo e-mail usado nesta conta para confirmar a alteração.");
      return;
    }
    if (!passwordFields.currentPassword) {
      setPasswordError("Informe a sua senha atual.");
      return;
    }
    if (passwordFields.newPassword.length < 8) {
      setPasswordError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (passwordFields.newPassword !== passwordFields.repeatNewPassword) {
      setPasswordError("As novas senhas não coincidem.");
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setNotice(null);
    try {
      const credentialClient = createSupabaseCredentialClient();
      const { error: verificationError } = await credentialClient.auth.signInWithPassword({
        email: accountEmail,
        password: passwordFields.currentPassword,
      });

      await credentialClient.auth.signOut({ scope: "local" });

      if (verificationError) {
        setPasswordError("O e-mail ou a senha atual estão incorretos.");
        return;
      }

      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({
        password: passwordFields.newPassword,
        current_password: passwordFields.currentPassword,
      });

      if (updateError) {
        console.error("Não foi possível alterar a senha da conta:", updateError.message);
        setPasswordError(`Não foi possível alterar a senha: ${updateError.message}`);
        return;
      }

      setNotice("Senha alterada com sucesso.");
      setIsPasswordFormOpen(false);
      setPasswordError(null);
      setPasswordFields({ email: "", currentPassword: "", newPassword: "", repeatNewPassword: "" });
    } catch (caught) {
      console.error("[Looma] Erro inesperado ao alterar a senha.", caught);
      setPasswordError(
        caught instanceof Error ? caught.message : "Não foi possível alterar a senha agora.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  const tabs: Array<[Tab, string, typeof UserRound]> = [
    ["account", "Conta", UserRound],
    ["notifications", "Notificações", Bell],
    ["privacy", "Privacidade", Lock],
  ];

  return (
    <WorkspaceLayout
      title="Configurações"
      description="Controle as preferências da sua conta Looma."
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções de configurações">
          {tabs.map(([value, label, Icon]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <section className="settings-panel">
          {loading ? <WorkspaceSkeleton cards={2} /> : null}
          {error ? (
            <WorkspaceError
              icon={Settings}
              title="Não foi possível carregar configurações"
              description={error}
              onRetry={() => void load()}
            />
          ) : null}
          {!loading && !error && !user ? (
            <WorkspaceEmpty
              icon={UserRound}
              title="Entre com sua conta"
              description="As configurações ficam disponíveis após o login."
            />
          ) : null}
          {!loading && !error && user ? (
            <>
              {notice ? <p className="workspace-notice">{notice}</p> : null}
              {tab === "account" ? (
                <section>
                  <h2>Conta</h2>
                  <label className="settings-field">
                    <span>E-mail</span>
                    <input
                      value={maskEmailAddress(user.email ?? "")}
                      readOnly
                      aria-label="E-mail protegido"
                    />
                  </label>
                  {usesPasswordLogin ? (
                    <div className="settings-password-section">
                      <div>
                        <h2>Senha</h2>
                        <p className="workspace-helper">
                          Confirme o e-mail e a senha atual antes de escolher uma nova senha.
                        </p>
                      </div>
                      {!isPasswordFormOpen ? (
                        <button
                          type="button"
                          className="settings-password-trigger"
                          onClick={() => {
                            setPasswordError(null);
                            setIsPasswordFormOpen(true);
                          }}
                        >
                          Alterar senha
                        </button>
                      ) : (
                        <form className="settings-password-form" onSubmit={changePassword}>
                          <label className="settings-field">
                            <span>Confirme seu e-mail</span>
                            <input
                              type="email"
                              value={passwordFields.email}
                              onChange={(event) => updatePasswordField("email", event.target.value)}
                              autoComplete="email"
                              required
                            />
                          </label>
                          <label className="settings-field">
                            <span>Senha atual</span>
                            <input
                              type="password"
                              value={passwordFields.currentPassword}
                              onChange={(event) =>
                                updatePasswordField("currentPassword", event.target.value)
                              }
                              autoComplete="current-password"
                              required
                            />
                          </label>
                          <label className="settings-field">
                            <span>Nova senha</span>
                            <input
                              type="password"
                              value={passwordFields.newPassword}
                              onChange={(event) =>
                                updatePasswordField("newPassword", event.target.value)
                              }
                              autoComplete="new-password"
                              minLength={8}
                              required
                            />
                          </label>
                          <label className="settings-field">
                            <span>Repita a nova senha</span>
                            <input
                              type="password"
                              value={passwordFields.repeatNewPassword}
                              onChange={(event) =>
                                updatePasswordField("repeatNewPassword", event.target.value)
                              }
                              autoComplete="new-password"
                              minLength={8}
                              required
                            />
                          </label>
                          {passwordError ? (
                            <p className="settings-password-error" role="alert">
                              {passwordError}
                            </p>
                          ) : null}
                          <div className="settings-password-actions">
                            <button
                              type="button"
                              onClick={closePasswordForm}
                              disabled={isChangingPassword}
                            >
                              Cancelar
                            </button>
                            <button type="submit" disabled={isChangingPassword}>
                              {isChangingPassword ? "Alterando…" : "Salvar nova senha"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <p className="workspace-helper settings-password-unavailable">
                      Sua conta usa login com Google. A troca de senha não se aplica a este método
                      de acesso.
                    </p>
                  )}
                  <div className="settings-appearance">
                    <div>
                      <h2>Aparência</h2>
                      <p className="workspace-helper">
                        Escolha como a Looma aparece neste dispositivo.
                      </p>
                    </div>
                    <div
                      className="settings-theme-options"
                      role="radiogroup"
                      aria-label="Tema visual"
                    >
                      <button
                        type="button"
                        className={theme === "light" ? "active" : ""}
                        role="radio"
                        aria-checked={theme === "light"}
                        onClick={() => updateTheme("light")}
                      >
                        <Sun size={16} aria-hidden="true" /> Claro
                      </button>
                      <button
                        type="button"
                        className={theme === "dark" ? "active" : ""}
                        role="radio"
                        aria-checked={theme === "dark"}
                        onClick={() => updateTheme("dark")}
                      >
                        <Moon size={16} aria-hidden="true" /> Escuro
                      </button>
                      <button
                        type="button"
                        className={theme === "system" ? "active" : ""}
                        role="radio"
                        aria-checked={theme === "system"}
                        onClick={() => updateTheme("system")}
                      >
                        <Laptop size={16} aria-hidden="true" /> Sistema
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
              {tab === "notifications" && settings ? (
                <section>
                  <h2>Notificações</h2>
                  <Toggle
                    label="Receber e-mail sobre novas conexões"
                    checked={settings.email_connection_notifications}
                    onChange={(value) =>
                      void updateSetting("email_connection_notifications", value)
                    }
                    disabled={savingSetting !== null}
                  />
                  <Toggle
                    label="Receber e-mail sobre novas propostas"
                    checked={settings.email_proposal_notifications}
                    onChange={(value) => void updateSetting("email_proposal_notifications", value)}
                    disabled={savingSetting !== null}
                  />
                </section>
              ) : null}
              {tab === "privacy" && settings ? (
                <section>
                  <h2>Privacidade</h2>
                  <Toggle
                    label="Manter perfil público"
                    checked={settings.is_profile_public}
                    onChange={(value) => void updateSetting("is_profile_public", value)}
                    disabled={savingSetting !== null}
                  />
                </section>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </WorkspaceLayout>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
