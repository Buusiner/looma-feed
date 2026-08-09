import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Lock, LogOut, Settings, UserRound } from "lucide-react";
import { WorkspaceEmpty, WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type SettingsRow = { email_connection_notifications: boolean; email_proposal_notifications: boolean; is_profile_public: boolean };
type Tab = "account" | "notifications" | "privacy" | "session";
export const Route = createFileRoute("/configuracoes")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useCurrentProfile();
  const [tab, setTab] = useState<Tab>("account");
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function load() {
    if (!user) { setSettings(null); setLoading(false); return; }
    setLoading(true); setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: queryError } = await supabase.from("user_settings").select("email_connection_notifications, email_proposal_notifications, is_profile_public").eq("user_id", user.id).maybeSingle();
    if (queryError) setError(queryError.message); else setSettings((data as SettingsRow | null) ?? { email_connection_notifications: true, email_proposal_notifications: true, is_profile_public: true });
    setLoading(false);
  }
  useEffect(() => { void load(); }, [user?.id]);
  async function updateSetting(key: keyof SettingsRow, value: boolean) {
    if (!user || !settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next); setError(null);
    const { error: upsertError } = await getSupabaseBrowserClient().from("user_settings").upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
    if (upsertError) { setError(upsertError.message); await load(); } else setNotice("Configuração salva.");
  }
  async function signOut() { const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut(); if (signOutError) setError(signOutError.message); }
  const tabs: Array<[Tab, string, typeof UserRound]> = [["account", "Conta", UserRound], ["notifications", "Notificações", Bell], ["privacy", "Privacidade", Lock], ["session", "Sessão", LogOut]];
  return <WorkspaceLayout title="Configurações" description="Controle as preferências da sua conta Looma.">
    <div className="settings-layout"><nav className="settings-nav">{tabs.map(([value, label, Icon]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon size={16} /> {label}</button>)}</nav><section className="settings-panel">{loading ? <WorkspaceSkeleton cards={2} /> : error ? <WorkspaceError icon={Settings} title="Não foi possível carregar configurações" description={error} onRetry={() => void load()} /> : !user ? <WorkspaceEmpty icon={UserRound} title="Entre com sua conta" description="As configurações ficam disponíveis após o login." /> : <>{notice ? <p className="workspace-notice">{notice}</p> : null}{tab === "account" ? <section><h2>Conta</h2><label className="settings-field"><span>E-mail</span><input value={user.email ?? ""} readOnly /></label><p className="workspace-helper">Sua conta usa login com Google. A troca de senha não se aplica a este método de acesso.</p></section> : null}{tab === "notifications" && settings ? <section><h2>Notificações</h2><Toggle label="Receber e-mail sobre novas conexões" checked={settings.email_connection_notifications} onChange={(value) => void updateSetting("email_connection_notifications", value)} /><Toggle label="Receber e-mail sobre novas propostas" checked={settings.email_proposal_notifications} onChange={(value) => void updateSetting("email_proposal_notifications", value)} /></section> : null}{tab === "privacy" && settings ? <section><h2>Privacidade</h2><Toggle label="Manter perfil público" checked={settings.is_profile_public} onChange={(value) => void updateSetting("is_profile_public", value)} /></section> : null}{tab === "session" ? <section><h2>Sessão</h2><button className="workspace-primary-action" onClick={() => void signOut()}><LogOut size={16} /> Sair</button><p className="workspace-helper">A exclusão de conta depende de uma função segura no servidor e ainda não está disponível.</p><button className="workspace-danger-action" disabled>Excluir conta</button></section> : null}</>}</section></div>
  </WorkspaceLayout>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}
