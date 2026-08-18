import { ChangeEvent, FormEvent, MouseEvent, useEffect, useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { Camera, ChevronLeft, LoaderCircle } from "lucide-react";
import { AuthButton } from "@/components/looma/AuthButton";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { getProfileName, useCurrentProfile } from "@/lib/profile";
import { ACCEPTED_AVATAR_TYPES, getAvatarFileValidationError, normalizeUsername, saveProfileDetails } from "@/lib/profile-editor";

export const Route = createFileRoute("/perfil/editar")({
  head: () => ({ meta: [{ title: "Editar perfil — Looma" }] }),
  component: EditProfilePage,
});

const PROFILE_ROUTE_FADE_MS = 1000;

function EditProfilePage() {
  const router = useRouter();
  const { user, profile, profileError, isLoading, refresh } = useCurrentProfile();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("looma-route-leaving");
    let playFrame: number | undefined;
    const initialFrame = window.requestAnimationFrame(() => {
      playFrame = window.requestAnimationFrame(() => setIsPageVisible(true));
    });

    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (playFrame) window.cancelAnimationFrame(playFrame);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setFullName(profile?.full_name ?? user.user_metadata.full_name ?? user.user_metadata.name ?? "");
    setUsername(profile?.username ?? user.user_metadata.user_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile, user]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) return setAvatarFile(null);
    const validationError = getAvatarFileValidationError(file);
    if (validationError) {
      event.target.value = "";
      setAvatarFile(null);
      setError(validationError);
      return;
    }
    setAvatarFile(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const normalizedName = fullName.trim();
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedName) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setError("O username deve ter de 3 a 24 caracteres: letras, números ou _.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updatedProfile = await saveProfileDetails({
        user,
        profile,
        fullName: normalizedName,
        username: normalizedUsername,
        bio,
        avatarFile,
      });

      console.info("[Looma] Perfil salvo pelo Supabase.", { userId: updatedProfile.id, username: updatedProfile.username });
      await refresh(user);
      setAvatarFile(null);
      setNotice("Perfil salvo com sucesso.");
    } catch (caught) {
      console.error("[Looma] Erro ao salvar perfil.", caught);
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar seu perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  const displayName = getProfileName(profile, user);

  function returnToLooma(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => router.navigate({ to: "/" }), PROFILE_ROUTE_FADE_MS);
  }

  return (
    <main className={`profile-edit-page ${isPageVisible ? "is-route-visible" : ""} ${isLeaving ? "is-route-leaving" : ""}`}>
      <div className="profile-edit-shell">
        <Link to="/" className="profile-back-link" onClick={returnToLooma}>
          <ChevronLeft size={17} /> Voltar para a <span className="profile-back-brand">Looma</span>
        </Link>
        <section className="profile-edit-card">
          <header>
            <p>Conta</p>
            <h1>Editar perfil</h1>
            <span>Deixe seu perfil pronto para as suas próximas conexões.</span>
          </header>

          {isLoading ? (
            <div className="profile-loading"><LoaderCircle size={20} /> Carregando perfil…</div>
          ) : !user ? (
            <div className="profile-auth-prompt">
              <p>Entre com sua conta para editar as informações do perfil.</p>
              <AuthButton />
            </div>
          ) : (
            <form onSubmit={saveProfile} className="profile-edit-form">
              {profileError ? (
                <p className="profile-form-message error" role="alert">
                  Não foi possível carregar o perfil: {profileError}
                </p>
              ) : null}
              <div className="avatar-upload-row">
                <ProfileAvatar
                  className="profile-edit-avatar"
                  fullName={displayName}
                  avatarUrl={profile?.avatar_url}
                />
                <div>
                  <strong>Foto de perfil</strong>
                  <span>JPG, PNG, WebP ou GIF, até 2 MB.</span>
                  <label className="avatar-upload-button">
                    <Camera size={16} /> {avatarFile ? "Trocar imagem" : "Enviar imagem"}
                    <input type="file" accept={ACCEPTED_AVATAR_TYPES.join(",")} onChange={chooseAvatar} />
                  </label>
                  {avatarFile ? <small className="selected-avatar-file">{avatarFile.name}</small> : null}
                </div>
              </div>

              <label className="profile-field">
                <span>Nome de exibição</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} />
              </label>
              <label className="profile-field">
                <span>Username</span>
                <div className="username-input"><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={24} /></div>
                <small>Será usado para encontrarem seu perfil.</small>
              </label>
              <label className="profile-field">
                <span>Bio</span>
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} placeholder="Conte um pouco sobre o seu trabalho." />
                <small>{bio.length}/160</small>
              </label>

              {error ? <p className="profile-form-message error" role="alert">{error}</p> : null}
              {notice ? <p className="profile-form-message success">{notice}</p> : null}
              <div className="profile-form-actions">
                <Link to="/" onClick={returnToLooma}>Cancelar</Link>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? <><LoaderCircle size={16} /> Salvando…</> : "Salvar alterações"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
