import { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useBlocker, useRouter } from "@tanstack/react-router";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  Instagram,
  Link2,
  LoaderCircle,
  Music2,
  Youtube,
} from "lucide-react";
import { AuthButton } from "@/components/looma/AuthButton";
import { AvatarCropDialog } from "@/components/looma/AvatarCropDialog";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getProfileName, useCurrentProfile } from "@/lib/profile";
import {
  ACCEPTED_AVATAR_TYPES,
  getAvatarFileValidationError,
  getValidHttpUrl,
  normalizeUsername,
  replaceProfileLinks,
  saveProfileDetails,
  saveUserSkillExperienceLevels,
  type EditableProfileLink,
  type UserSkillExperienceLevel,
} from "@/lib/profile-editor";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/perfil/editar")({
  head: () => ({ meta: [{ title: "Editar perfil — Looma" }] }),
  component: EditProfilePage,
});

const PROFILE_ROUTE_FADE_MS = 1000;

const EXPERIENCE_LEVELS: Array<{ value: UserSkillExperienceLevel; label: string }> = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "experiente", label: "Experiente" },
];

const SOCIAL_LINK_FIELDS = [
  {
    type: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/@seuperfil",
    Icon: Instagram,
  },
  {
    type: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@seucanal",
    Icon: Youtube,
  },
  { type: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@seuperfil", Icon: Music2 },
] as const;

type SocialLinkType = (typeof SOCIAL_LINK_FIELDS)[number]["type"];

type ProfileSkill = {
  id: string;
  name: string;
  experienceLevel: UserSkillExperienceLevel | null;
};

type UserSkillRow = {
  id: string;
  skill_tag_id: string | null;
  custom_label: string | null;
  experience_level: UserSkillExperienceLevel | null;
};

type SkillTagRow = {
  id: string;
  name: string;
};

type ProfileLinkRow = {
  type: SocialLinkType | "outro";
  label: string | null;
  url: string;
};

type SocialLinksForm = Record<SocialLinkType, string> & {
  otherLabel: string;
  otherUrl: string;
};

type ProfileEditorSnapshot = {
  fullName: string;
  username: string;
  bio: string;
  avatarFileKey: string | null;
  skills: Array<Pick<ProfileSkill, "id" | "name" | "experienceLevel">>;
  socialLinks: SocialLinksForm;
};

type CropSource = {
  file: File;
  previewUrl: string;
};

const EMPTY_SOCIAL_LINKS: SocialLinksForm = {
  instagram: "",
  youtube: "",
  tiktok: "",
  otherLabel: "",
  otherUrl: "",
};

function getAvatarFileKey(file: File | null): string | null {
  return file ? `${file.name}:${file.size}:${file.lastModified}:${file.type}` : null;
}

function createProfileEditorSnapshot({
  fullName,
  username,
  bio,
  avatarFile,
  skills,
  socialLinks,
}: {
  fullName: string;
  username: string;
  bio: string;
  avatarFile: File | null;
  skills: ProfileSkill[];
  socialLinks: SocialLinksForm;
}): ProfileEditorSnapshot {
  return {
    fullName,
    username,
    bio,
    avatarFileKey: getAvatarFileKey(avatarFile),
    skills: skills
      .map(({ id, name, experienceLevel }) => ({ id, name, experienceLevel }))
      .sort((first, second) => first.id.localeCompare(second.id)),
    socialLinks: {
      instagram: socialLinks.instagram,
      youtube: socialLinks.youtube,
      tiktok: socialLinks.tiktok,
      otherLabel: socialLinks.otherLabel,
      otherUrl: socialLinks.otherUrl,
    },
  };
}

function areProfileEditorSnapshotsEqual(
  first: ProfileEditorSnapshot,
  second: ProfileEditorSnapshot,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function EditProfilePage() {
  const router = useRouter();
  const { user, profile, profileError, isLoading, refresh } = useCurrentProfile();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinksForm>(EMPTY_SOCIAL_LINKS);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [hasLoadedEditorDetails, setHasLoadedEditorDetails] = useState(false);
  const [initialProfileSnapshot, setInitialProfileSnapshot] =
    useState<ProfileEditorSnapshot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const avatarPreviewRef = useRef<string | null>(null);
  const cropSourceRef = useRef<CropSource | null>(null);

  useEffect(() => {
    avatarPreviewRef.current = avatarPreviewUrl;
  }, [avatarPreviewUrl]);

  useEffect(() => {
    cropSourceRef.current = cropSource;
  }, [cropSource]);

  useEffect(
    () => () => {
      if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
      if (cropSourceRef.current) URL.revokeObjectURL(cropSourceRef.current.previewUrl);
    },
    [],
  );

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
    setFullName(
      profile?.full_name ?? user.user_metadata["full_name"] ?? user.user_metadata["name"] ?? "",
    );
    setUsername(profile?.username ?? user.user_metadata["user_name"] ?? "");
    setBio(profile?.bio ?? "");
  }, [profile, user]);

  useEffect(() => {
    if (!user) {
      setSkills([]);
      setSocialLinks(EMPTY_SOCIAL_LINKS);
      setHasLoadedEditorDetails(false);
      setInitialProfileSnapshot(null);
      return;
    }

    const profileId = user.id;
    let isCurrent = true;
    setIsLoadingDetails(true);
    setHasLoadedEditorDetails(false);

    async function loadEditorDetails() {
      try {
        const supabase = getSupabaseBrowserClient();
        const [
          { data: skillRows, error: skillRowsError },
          { data: tagRows, error: tagRowsError },
          { data: linkRows, error: linkRowsError },
        ] = await Promise.all([
          supabase
            .from("user_skills")
            .select("id, skill_tag_id, custom_label, experience_level")
            .eq("profile_id", profileId),
          supabase.from("skill_tags").select("id, name"),
          supabase.from("profile_links").select("type, label, url").eq("profile_id", profileId),
        ]);

        if (skillRowsError) throw skillRowsError;
        if (tagRowsError) throw tagRowsError;
        if (linkRowsError) throw linkRowsError;
        if (!isCurrent) return;

        const tagsById = new Map(
          ((tagRows as SkillTagRow[] | null) ?? []).map((tag) => [tag.id, tag.name]),
        );
        const loadedSkills = ((skillRows as UserSkillRow[] | null) ?? []).flatMap((skill) => {
          const name = skill.skill_tag_id ? tagsById.get(skill.skill_tag_id) : skill.custom_label;
          return name ? [{ id: skill.id, name, experienceLevel: skill.experience_level }] : [];
        });
        const loadedLinks: SocialLinksForm = { ...EMPTY_SOCIAL_LINKS };
        for (const link of (linkRows as ProfileLinkRow[] | null) ?? []) {
          if (link.type === "outro") {
            loadedLinks.otherLabel = link.label ?? "";
            loadedLinks.otherUrl = link.url;
          } else {
            loadedLinks[link.type] = link.url;
          }
        }

        setSkills(loadedSkills);
        setSocialLinks(loadedLinks);
      } catch (caught) {
        console.error("[Looma] Falha ao carregar detalhes editáveis do perfil.", caught);
        if (isCurrent)
          setError(
            "Não foi possível carregar suas áreas e links. Atualize a página e tente novamente.",
          );
      } finally {
        if (isCurrent) {
          setIsLoadingDetails(false);
          setHasLoadedEditorDetails(true);
        }
      }
    }

    void loadEditorDetails();
    return () => {
      isCurrent = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profile || isLoading || !hasLoadedEditorDetails || initialProfileSnapshot) return;

    setInitialProfileSnapshot(
      createProfileEditorSnapshot({
        fullName:
          profile.full_name ?? user.user_metadata["full_name"] ?? user.user_metadata["name"] ?? "",
        username: profile.username ?? user.user_metadata["user_name"] ?? "",
        bio: profile.bio ?? "",
        avatarFile: null,
        skills,
        socialLinks,
      }),
    );
  }, [
    hasLoadedEditorDetails,
    initialProfileSnapshot,
    isLoading,
    profile,
    skills,
    socialLinks,
    user,
  ]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError(null);
    if (!file) return;

    const validationError = getAvatarFileValidationError(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (cropSource?.previewUrl) URL.revokeObjectURL(cropSource.previewUrl);
    setCropSource({ file, previewUrl: URL.createObjectURL(file) });
  }

  function cancelCrop() {
    if (cropSource?.previewUrl) URL.revokeObjectURL(cropSource.previewUrl);
    setCropSource(null);
  }

  function confirmCrop(croppedFile: File) {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    if (cropSource?.previewUrl) URL.revokeObjectURL(cropSource.previewUrl);
    setAvatarFile(croppedFile);
    setAvatarPreviewUrl(URL.createObjectURL(croppedFile));
    setCropSource(null);
  }

  function updateSkillExperience(
    skillId: string,
    experienceLevel: UserSkillExperienceLevel | null,
  ) {
    setSkills((current) =>
      current.map((skill) => (skill.id === skillId ? { ...skill, experienceLevel } : skill)),
    );
  }

  function updateSocialLink(field: keyof SocialLinksForm, value: string) {
    setSocialLinks((current) => ({ ...current, [field]: value }));
  }

  function getLinksToSave(): EditableProfileLink[] {
    const links: EditableProfileLink[] = [];
    for (const field of SOCIAL_LINK_FIELDS) {
      const rawValue = socialLinks[field.type].trim();
      if (!rawValue) continue;
      const url = getValidHttpUrl(rawValue);
      if (!url)
        throw new Error(
          `Informe uma URL válida para ${field.label}, começando com http:// ou https://.`,
        );
      links.push({ type: field.type, label: field.label, url });
    }

    const otherLabel = socialLinks.otherLabel.trim();
    const otherUrl = socialLinks.otherUrl.trim();
    if (otherLabel && !otherUrl) throw new Error("Informe o link correspondente ao campo Outro.");
    if (!otherLabel && otherUrl) throw new Error("Dê um nome ao link em Outro.");
    if (otherLabel && otherUrl) {
      const url = getValidHttpUrl(otherUrl);
      if (!url)
        throw new Error("Informe uma URL válida para Outro, começando com http:// ou https://.");
      links.push({ type: "outro", label: otherLabel, url });
    }

    return links;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const normalizedName = fullName.trim();
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedName) {
      setError("Informe seu nome de exibição.");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setError("O username deve ter de 3 a 24 caracteres: letras, números ou _.");
      return;
    }

    let linksToSave: EditableProfileLink[];
    try {
      linksToSave = getLinksToSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verifique os links preenchidos.");
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

      await Promise.all([
        saveUserSkillExperienceLevels(
          user,
          skills.map((skill) => ({ id: skill.id, experienceLevel: skill.experienceLevel })),
        ),
        replaceProfileLinks(user, linksToSave),
      ]);

      console.info("[Looma] Perfil salvo pelo Supabase.", {
        userId: updatedProfile.id,
        username: updatedProfile.username,
      });
      await refresh(user);
      setAvatarFile(null);
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
      setFullName(normalizedName);
      setUsername(normalizedUsername);
      setBio(bio.trim());
      setInitialProfileSnapshot(
        createProfileEditorSnapshot({
          fullName: normalizedName,
          username: normalizedUsername,
          bio: bio.trim(),
          avatarFile: null,
          skills,
          socialLinks,
        }),
      );
      setNotice("Perfil salvo com sucesso.");
    } catch (caught) {
      console.error("[Looma] Erro ao salvar perfil.", caught);
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar seu perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  const displayName = getProfileName(profile, user);
  const displayedAvatarUrl = avatarPreviewUrl ?? profile?.avatar_url;
  const currentProfileSnapshot = createProfileEditorSnapshot({
    fullName,
    username,
    bio,
    avatarFile,
    skills,
    socialLinks,
  });
  const hasUnsavedChanges = Boolean(
    initialProfileSnapshot &&
    !areProfileEditorSnapshotsEqual(initialProfileSnapshot, currentProfileSnapshot),
  );
  const navigationBlocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

  function discardLocalChanges() {
    if (!initialProfileSnapshot) return;

    setFullName(initialProfileSnapshot.fullName);
    setUsername(initialProfileSnapshot.username);
    setBio(initialProfileSnapshot.bio);
    setSkills(initialProfileSnapshot.skills.map((skill) => ({ ...skill })));
    setSocialLinks({ ...initialProfileSnapshot.socialLinks });
    setExpandedSkillId(null);
    setError(null);
    setNotice(null);

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    if (cropSource?.previewUrl) URL.revokeObjectURL(cropSource.previewUrl);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setCropSource(null);
  }

  function continueEditing() {
    navigationBlocker.reset?.();
  }

  function discardAndLeave() {
    const proceed = navigationBlocker.proceed;
    if (!proceed) return;

    discardLocalChanges();
    setIsLeaving(true);
    window.setTimeout(proceed, PROFILE_ROUTE_FADE_MS);
  }

  function returnToLooma(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    if (hasUnsavedChanges) return;
    event.preventDefault();
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => router.navigate({ to: "/" }), PROFILE_ROUTE_FADE_MS);
  }

  return (
    <main
      className={`profile-edit-page ${isPageVisible ? "is-route-visible" : ""} ${isLeaving ? "is-route-leaving" : ""}`}
    >
      <div className="profile-edit-shell">
        <Link to="/" className="profile-back-link" onClick={returnToLooma}>
          <ChevronLeft size={17} /> Voltar para a <span className="profile-back-brand">Looma</span>
        </Link>
        <section className="profile-edit-card">
          <header>
            <p>Conta</p>
            <h1>Editar perfil</h1>
            <span>Atualize como você aparece para suas próximas conexões.</span>
          </header>

          {isLoading ? (
            <div className="profile-loading">
              <LoaderCircle size={20} /> Carregando perfil…
            </div>
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
                  avatarUrl={displayedAvatarUrl ?? null}
                />
                <div>
                  <strong>Foto de perfil</strong>
                  <span>JPG, PNG, WebP ou GIF, até 2 MB.</span>
                  <label className="avatar-upload-button">
                    <Camera size={16} /> {avatarFile ? "Ajustar outra imagem" : "Enviar imagem"}
                    <input
                      type="file"
                      accept={ACCEPTED_AVATAR_TYPES.join(",")}
                      onChange={chooseAvatar}
                    />
                  </label>
                  {avatarFile ? (
                    <small className="selected-avatar-file">
                      Imagem ajustada e pronta para salvar.
                    </small>
                  ) : null}
                </div>
              </div>

              <label className="profile-field">
                <span>Nome de exibição</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={80}
                />
              </label>
              <label className="profile-field">
                <span>Username</span>
                <div className="username-input">
                  <span>@</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    maxLength={24}
                  />
                </div>
                <small>Será usado para encontrarem seu perfil.</small>
              </label>
              <label className="profile-field">
                <span>Bio</span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={160}
                  placeholder="Conte um pouco sobre o seu trabalho."
                />
                <small>{bio.length}/160</small>
              </label>

              <section className="profile-edit-section" aria-labelledby="profile-skills-title">
                <div className="profile-edit-section-heading">
                  <div>
                    <h2 id="profile-skills-title">Áreas selecionadas</h2>
                    <p>Defina seu nível em cada área que você adicionou.</p>
                  </div>
                  {isLoadingDetails ? (
                    <LoaderCircle className="profile-section-spinner" size={17} />
                  ) : null}
                </div>
                {skills.length ? (
                  <div className="profile-skill-list">
                    {skills.map((skill) => {
                      const isExpanded = expandedSkillId === skill.id;
                      return (
                        <article
                          key={skill.id}
                          className={`profile-skill-editor ${isExpanded ? "is-expanded" : ""}`}
                        >
                          <div className="profile-skill-summary">
                            <strong>{skill.name}</strong>
                            <button
                              type="button"
                              onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                              aria-expanded={isExpanded}
                            >
                              Editar <ChevronDown size={16} />
                            </button>
                          </div>
                          {isExpanded ? (
                            <label className="profile-skill-level">
                              <span>Há quanto tempo você faz isso?</span>
                              <select
                                value={skill.experienceLevel ?? ""}
                                onChange={(event) =>
                                  updateSkillExperience(
                                    skill.id,
                                    (event.target.value || null) as UserSkillExperienceLevel | null,
                                  )
                                }
                              >
                                <option value="">Selecione seu nível</option>
                                {EXPERIENCE_LEVELS.map((level) => (
                                  <option key={level.value} value={level.value}>
                                    {level.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="profile-section-empty">
                    Você ainda não selecionou áreas. Elas podem ser adicionadas durante o
                    onboarding.
                  </p>
                )}
              </section>

              <section className="profile-edit-section" aria-labelledby="profile-links-title">
                <div className="profile-edit-section-heading">
                  <div>
                    <h2 id="profile-links-title">Links profissionais</h2>
                    <p>Opcional: compartilhe onde mais podem encontrar você.</p>
                  </div>
                </div>
                <div className="profile-social-links">
                  {SOCIAL_LINK_FIELDS.map(({ type, label, placeholder, Icon }) => (
                    <label key={type} className="profile-social-field">
                      <span>
                        <Icon size={18} aria-hidden="true" /> {label}
                      </span>
                      <input
                        type="url"
                        inputMode="url"
                        value={socialLinks[type]}
                        onChange={(event) => updateSocialLink(type, event.target.value)}
                        placeholder={placeholder}
                      />
                    </label>
                  ))}
                  <div className="profile-other-link">
                    <label className="profile-social-field">
                      <span>
                        <Link2 size={18} aria-hidden="true" /> Outro
                      </span>
                      <input
                        value={socialLinks.otherLabel}
                        onChange={(event) => updateSocialLink("otherLabel", event.target.value)}
                        placeholder="Ex.: Meu site"
                        maxLength={40}
                      />
                    </label>
                    <label className="profile-social-field">
                      <span>Link</span>
                      <input
                        type="url"
                        inputMode="url"
                        value={socialLinks.otherUrl}
                        onChange={(event) => updateSocialLink("otherUrl", event.target.value)}
                        placeholder="https://seusite.com"
                      />
                    </label>
                  </div>
                </div>
              </section>

              {error ? (
                <p className="profile-form-message error" role="alert">
                  {error}
                </p>
              ) : null}
              {notice ? <p className="profile-form-message success">{notice}</p> : null}
              <div className="profile-form-actions">
                <Link to="/" onClick={returnToLooma}>
                  Cancelar
                </Link>
                <button type="submit" disabled={isSaving || isLoadingDetails}>
                  {isSaving ? (
                    <>
                      <LoaderCircle size={16} /> Salvando…
                    </>
                  ) : (
                    "Salvar alterações"
                  )}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <AvatarCropDialog
        file={cropSource?.file ?? null}
        previewUrl={cropSource?.previewUrl ?? null}
        onCancel={cancelCrop}
        onConfirm={confirmCrop}
      />
      <Dialog
        open={navigationBlocker.status === "blocked"}
        onOpenChange={(open) => !open && continueEditing()}
      >
        <DialogContent showClose={false} className="profile-discard-dialog">
          <DialogHeader>
            <DialogTitle className="profile-discard-title">Descartar alterações?</DialogTitle>
            <DialogDescription className="profile-discard-description">
              Você tem alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="profile-discard-actions">
            <button type="button" className="profile-discard-continue" onClick={continueEditing}>
              Continuar editando
            </button>
            <button type="button" className="profile-discard-leave" onClick={discardAndLeave}>
              Sair assim mesmo
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
