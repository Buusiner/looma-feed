import { ChangeEvent, FormEvent, MouseEvent, useEffect, useState } from "react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { Camera, ChevronLeft, LoaderCircle } from "lucide-react";
import { AuthButton } from "@/components/looma/AuthButton";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { getProfileName, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/perfil/editar")({
  head: () => ({ meta: [{ title: "Editar perfil — Looma" }] }),
  component: EditProfilePage,
});

const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
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
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_SIZE) {
      event.target.value = "";
      setAvatarFile(null);
      setError("Escolha uma imagem JPG, PNG, WebP ou GIF de até 2 MB.");
      return;
    }
    setAvatarFile(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const normalizedName = fullName.trim();
    const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
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
      const supabase = getSupabaseBrowserClient();
      let avatarUrl = profile?.avatar_url ?? null;

      if (avatarFile) {
        const bucketResponse = await fetch("/api/storage/ensure-avatars", { method: "POST" });
        if (!bucketResponse.ok) {
          const body = (await bucketResponse.json().catch(() => null)) as { error?: string } | null;
          console.error("[Looma] Falha ao preparar o bucket de avatar.", {
            status: bucketResponse.status,
            serverError: body?.error ?? null,
          });
          if (body?.error === "storage_admin_not_configured") {
            throw new Error("O upload de avatar ainda não está configurado no servidor.");
          }
          throw new Error("Não foi possível preparar o armazenamento de avatar.");
        }

        const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, avatarFile, {
          cacheControl: "3600",
          contentType: avatarFile.type,
          upsert: false,
        });
        if (uploadError) {
          console.error("[Looma] Falha no upload do avatar.", uploadError);
          throw new Error("Não foi possível enviar a sua foto. Tente novamente.");
        }

        const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = publicUrl.publicUrl;
      }

      console.info("[Looma] Salvando perfil.", {
        userId: user.id,
        username: normalizedUsername,
        hasNewAvatar: Boolean(avatarFile),
      });
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: normalizedName,
          username: normalizedUsername,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id)
        .select("id, username, full_name, avatar_url, bio, created_at")
        .single();

      if (updateError) {
        console.error("[Looma] Falha ao atualizar profiles.", {
          userId: user.id,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        });
        if (updateError.code === "23505") {
          throw new Error("Esse username já está em uso. Escolha outro.");
        }
        throw new Error("Não foi possível salvar seu perfil. Tente novamente.");
      }

      console.info("[Looma] Perfil salvo pelo Supabase.", {
        userId: updatedProfile.id,
        username: updatedProfile.username,
      });
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
