import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Camera, Check, LoaderCircle, Plus, Search, X } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { getProfileName, type Profile } from "@/lib/profile";
import { ACCEPTED_AVATAR_TYPES, getAvatarFileValidationError, saveProfileDetails } from "@/lib/profile-editor";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const ONBOARDING_STEPS = ["Sobre você", "O que você faz", "Experiência", "Onde te encontrar"];
const MAX_SELECTED_SKILLS = 3;
const EXPERIENCE_LEVELS = [
  { value: "iniciante", title: "Iniciante", description: "Você começou agora, ou há pouco tempo." },
  { value: "intermediario", title: "Intermediário", description: "Você sabe o que está fazendo." },
  { value: "experiente", title: "Experiente", description: "Você é craque nisso!" },
] as const;

type SkillTag = { id: string; name: string };
type SelectedSkill = SkillTag & { isCustom?: boolean };
type SimilarSkill = SkillTag & { similarity: number };
type ExperienceLevel = NonNullable<Profile["experience_level"]>;
type SocialLinkType = "instagram" | "youtube" | "tiktok";
type SocialLinkValues = Record<SocialLinkType, string>;
type SubmittedProfileLink = { type: SocialLinkType | "outro"; label: string | null; url: string };

const SOCIAL_LINK_FIELDS: Array<{ type: SocialLinkType; label: string; placeholder: string }> = [
  { type: "instagram", label: "Instagram", placeholder: "https://instagram.com/seu-perfil" },
  { type: "youtube", label: "YouTube", placeholder: "https://youtube.com/@seucanal" },
  { type: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@seuperfil" },
];

type OnboardingGateProps = {
  user: User;
  profile: Profile;
  refreshProfile: (knownUser?: User | null) => Promise<Profile | null>;
};

function searchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function normalizeCustomSkill(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? `${cleaned.charAt(0).toLocaleUpperCase("pt-BR")}${cleaned.slice(1)}` : "";
}

function getValidHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** The account-wide gate keeps onboarding data in Supabase as the source of truth. */
export function OnboardingGate({ user, profile, refreshProfile }: OnboardingGateProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [skillTags, setSkillTags] = useState<SkillTag[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [showCustomSkill, setShowCustomSkill] = useState(false);
  const [similarSuggestion, setSimilarSuggestion] = useState<SimilarSkill | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinkValues>({ instagram: "", youtube: "", tiktok: "" });
  const [otherLinkLabel, setOtherLinkLabel] = useState("");
  const [otherLinkUrl, setOtherLinkUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const [isSavingExperience, setIsSavingExperience] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  const filteredSkillTags = useMemo(() => {
    const term = searchKey(skillSearch);
    if (!term) return skillTags.slice(0, 12);
    return skillTags.filter((tag) => searchKey(tag.name).includes(term)).slice(0, 12);
  }, [skillSearch, skillTags]);

  useEffect(() => {
    setFullName(profile.full_name ?? user.user_metadata["full_name"] ?? user.user_metadata["name"] ?? "");
    setBio(profile.bio ?? "");
    setExperienceLevel(profile.experience_level);
  }, [profile, user]);

  useEffect(() => {
    if (currentStep !== 2) return;
    let isCurrent = true;

    async function loadSkills() {
      setIsLoadingSkills(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const [{ data: tags, error: tagsError }, { data: savedSkills, error: savedSkillsError }] = await Promise.all([
          supabase.from("skill_tags").select("id, name").order("name"),
          supabase.from("user_skills").select("skill_tag_id, custom_label").eq("profile_id", user.id),
        ]);
        if (tagsError) throw tagsError;
        if (savedSkillsError) throw savedSkillsError;
        if (!isCurrent) return;

        const availableTags = (tags ?? []) as SkillTag[];
        const tagsById = new Map(availableTags.map((tag) => [tag.id, tag]));
        const restored = (savedSkills ?? []).flatMap((skill) => {
          if (skill.skill_tag_id) {
            const tag = tagsById.get(skill.skill_tag_id);
            return tag ? [tag] : [];
          }
          return skill.custom_label ? [{ id: `custom:${searchKey(skill.custom_label)}`, name: skill.custom_label, isCustom: true }] : [];
        });

        setSkillTags(availableTags);
        setSelectedSkills(restored.slice(0, MAX_SELECTED_SKILLS));
      } catch (caught) {
        console.error("[Looma] Não foi possível carregar as áreas de atuação.", caught);
        if (isCurrent) setError("Não foi possível carregar as áreas de atuação. Tente novamente.");
      } finally {
        if (isCurrent) setIsLoadingSkills(false);
      }
    }

    void loadSkills();
    return () => { isCurrent = false; };
  }, [currentStep, user.id]);

  useEffect(() => {
    if (currentStep !== 4) return;
    let isCurrent = true;

    async function loadLinks() {
      setIsLoadingLinks(true);
      setError(null);
      try {
        const { data, error: linksError } = await getSupabaseBrowserClient()
          .from("profile_links")
          .select("type, label, url")
          .eq("profile_id", user.id);
        if (linksError) throw linksError;
        if (!isCurrent) return;

        const restoredLinks: SocialLinkValues = { instagram: "", youtube: "", tiktok: "" };
        let restoredOtherLabel = "";
        let restoredOtherUrl = "";

        for (const link of data ?? []) {
          const linkType = link.type as string | null;
          if (linkType === "instagram" || linkType === "youtube" || linkType === "tiktok") {
            restoredLinks[linkType] = link.url ?? "";
          }
          if (linkType === "outro") {
            restoredOtherLabel = link.label ?? "";
            restoredOtherUrl = link.url ?? "";
          }
        }

        setSocialLinks(restoredLinks);
        setOtherLinkLabel(restoredOtherLabel);
        setOtherLinkUrl(restoredOtherUrl);
      } catch (caught) {
        console.error("[Looma] Não foi possível carregar os links do perfil.", caught);
        if (isCurrent) setError("Não foi possível carregar seus links. Tente novamente.");
      } finally {
        if (isCurrent) setIsLoadingLinks(false);
      }
    }

    void loadLinks();
    return () => { isCurrent = false; };
  }, [currentStep, user.id]);

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

  function addSkill(skill: SelectedSkill) {
    if (selectedSkills.some((selected) => searchKey(selected.name) === searchKey(skill.name))) return;
    if (selectedSkills.length >= MAX_SELECTED_SKILLS) {
      setLimitNotice("Você já selecionou 3 áreas. Remova uma para trocar.");
      return;
    }
    setSelectedSkills((current) => [...current, skill]);
    setLimitNotice(null);
    setSkillSearch("");
  }

  function removeSkill(skill: SelectedSkill) {
    setSelectedSkills((current) => current.filter((selected) => selected.id !== skill.id));
    setLimitNotice(null);
  }

  async function checkCustomSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCustomSkill(customSkill);
    if (!normalized) {
      setError("Digite uma área de atuação para continuar.");
      return;
    }
    if (selectedSkills.some((selected) => searchKey(selected.name) === searchKey(normalized))) {
      setError("Essa área já foi selecionada.");
      return;
    }
    if (selectedSkills.length >= MAX_SELECTED_SKILLS) {
      setLimitNotice("Você já selecionou 3 áreas. Remova uma para trocar.");
      return;
    }

    setIsCheckingSimilar(true);
    setError(null);
    try {
      const { data, error: similarityError } = await getSupabaseBrowserClient()
        .rpc("find_similar_skill_tags", { search_term: normalized, result_limit: 1 });
      if (similarityError) throw similarityError;
      const suggestion = (data?.[0] ?? null) as SimilarSkill | null;
      if (suggestion) {
        setSimilarSuggestion(suggestion);
        return;
      }
      addSkill({ id: `custom:${searchKey(normalized)}`, name: normalized, isCustom: true });
      setCustomSkill("");
      setShowCustomSkill(false);
    } catch (caught) {
      console.error("[Looma] Não foi possível verificar a sugestão de área.", caught);
      setError("Não foi possível verificar sugestões agora. Tente novamente.");
    } finally {
      setIsCheckingSimilar(false);
    }
  }

  function acceptSuggestion() {
    if (!similarSuggestion) return;
    addSkill({ id: similarSuggestion.id, name: similarSuggestion.name });
    setSimilarSuggestion(null);
    setCustomSkill("");
    setShowCustomSkill(false);
  }

  function keepCustomSkill() {
    const normalized = normalizeCustomSkill(customSkill);
    if (normalized) addSkill({ id: `custom:${searchKey(normalized)}`, name: normalized, isCustom: true });
    setSimilarSuggestion(null);
    setCustomSkill("");
    setShowCustomSkill(false);
  }

  async function saveAboutYou(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim()) {
      setError("Informe seu nome de exibição.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveProfileDetails({ user, profile, fullName, bio, avatarFile });
      setAvatarFile(null);
      setCurrentStep(2);
      setNotice("Informações salvas com sucesso.");
      void refreshProfile(user).catch((refreshError) => {
        console.error("[Looma] Não foi possível atualizar o perfil após salvar o onboarding.", refreshError);
      });
    } catch (caught) {
      console.error("[Looma] Não foi possível salvar a Etapa 1 do onboarding.", caught);
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar seu perfil. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSkills() {
    if (!selectedSkills.length) {
      setError("Escolha pelo menos uma área de atuação.");
      return;
    }
    setIsSavingSkills(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("user_skills").delete().eq("profile_id", user.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("user_skills").insert(
        selectedSkills.map((skill) => skill.isCustom
          ? { profile_id: user.id, custom_label: normalizeCustomSkill(skill.name), skill_tag_id: null }
          : { profile_id: user.id, skill_tag_id: skill.id, custom_label: null }),
      );
      if (insertError) throw insertError;
      setCurrentStep(3);
      setNotice("Áreas de atuação salvas com sucesso.");
    } catch (caught) {
      console.error("[Looma] Não foi possível salvar as áreas de atuação.", caught);
      setError("Não foi possível salvar suas áreas de atuação. Tente novamente.");
    } finally {
      setIsSavingSkills(false);
    }
  }

  async function saveExperience() {
    if (!experienceLevel) {
      setError("Escolha seu nível de experiência para continuar.");
      return;
    }

    setIsSavingExperience(true);
    setError(null);
    try {
      const { data: updatedProfile, error: updateError } = await getSupabaseBrowserClient()
        .from("profiles")
        .update({ experience_level: experienceLevel })
        .eq("id", user.id)
        .select("experience_level")
        .single();
      if (updateError) throw updateError;
      if (updatedProfile.experience_level !== experienceLevel) {
        throw new Error("O nível de experiência não foi confirmado pelo banco.");
      }

      setCurrentStep(4);
      setNotice("Nível de experiência salvo com sucesso.");
      void refreshProfile(user).catch((refreshError) => {
        console.error("[Looma] Não foi possível atualizar o perfil após salvar a experiência.", refreshError);
      });
    } catch (caught) {
      console.error("[Looma] Não foi possível salvar o nível de experiência.", caught);
      setError("Não foi possível salvar seu nível de experiência. Tente novamente.");
    } finally {
      setIsSavingExperience(false);
    }
  }

  function getSubmittedLinks() {
    const links: SubmittedProfileLink[] = [];

    for (const field of SOCIAL_LINK_FIELDS) {
      const rawValue = socialLinks[field.type].trim();
      if (!rawValue) continue;

      const url = getValidHttpUrl(rawValue);
      if (!url) throw new Error(`Informe uma URL válida para ${field.label}, começando com http:// ou https://.`);
      links.push({ type: field.type, label: field.label, url });
    }

    const customLabel = otherLinkLabel.trim().replace(/\s+/g, " ");
    const rawOtherUrl = otherLinkUrl.trim();
    if (customLabel && !rawOtherUrl) throw new Error("Informe o link correspondente ao campo Outro.");
    if (!customLabel && rawOtherUrl) throw new Error("Dê um nome ao seu link em Outro.");
    if (customLabel && rawOtherUrl) {
      const url = getValidHttpUrl(rawOtherUrl);
      if (!url) throw new Error("Informe uma URL válida para Outro, começando com http:// ou https://.");
      links.push({ type: "outro", label: customLabel, url });
    }

    return links;
  }

  async function completeOnboarding(saveLinks: boolean) {
    let links: SubmittedProfileLink[] | null = null;
    try {
      if (saveLinks) links = getSubmittedLinks();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verifique os links antes de concluir.");
      return;
    }

    setIsCompletingOnboarding(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: completionError } = saveLinks
        ? await supabase.rpc("complete_onboarding", { submitted_links: links })
        : await supabase.rpc("complete_onboarding");
      if (completionError) throw completionError;

      const completedAt = Array.isArray(data) ? data[0]?.onboarding_completed_at : null;
      if (!completedAt) throw new Error("A conclusão do onboarding não foi confirmada pelo banco.");

      const refreshedProfile = await refreshProfile(user);
      if (!refreshedProfile?.onboarding_completed_at) {
        throw new Error("A conclusão do onboarding ainda não foi confirmada no seu perfil.");
      }

      await router.navigate({ to: "/" });
    } catch (caught) {
      console.error("[Looma] Não foi possível concluir o onboarding.", caught);
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir seu onboarding. Tente novamente.");
    } finally {
      setIsCompletingOnboarding(false);
    }
  }

  return (
    <section className="onboarding-gate" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <span className="looma-logo-mark onboarding-logo" role="img" aria-label="Looma" />
        <div className="onboarding-progress" aria-label={`Etapa ${currentStep} de ${ONBOARDING_STEPS.length}`}>
          <span>Etapa {currentStep} de {ONBOARDING_STEPS.length}</span>
          <ol>{ONBOARDING_STEPS.map((step, index) => <li className={index < currentStep ? "is-current" : ""} key={step} aria-label={step} />)}</ol>
        </div>

        {currentStep === 1 ? <>
          <header><h1 id="onboarding-title">Conte-nos mais sobre você</h1><p>Essas informações ajudam a deixar seu perfil reconhecível para novas conexões.</p></header>
          <form className="onboarding-about-form" onSubmit={saveAboutYou}>
            <div className="onboarding-avatar-row"><ProfileAvatar className="onboarding-avatar" fullName={fullName || getProfileName(profile, user)} avatarUrl={profile.avatar_url} /><div><strong>Foto de perfil</strong><span>JPG, PNG, WebP ou GIF, até 2 MB.</span><label className="avatar-upload-button"><Camera size={16} /> {avatarFile ? "Trocar imagem" : "Enviar imagem"}<input type="file" accept={ACCEPTED_AVATAR_TYPES.join(",")} onChange={chooseAvatar} /></label>{avatarFile ? <small className="selected-avatar-file">{avatarFile.name}</small> : null}</div></div>
            <label className="onboarding-field"><span>Nome de exibição</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} autoComplete="name" autoFocus /></label>
            <label className="onboarding-field"><span>Bio</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} placeholder="Conte um pouco sobre o seu trabalho." /><small>{bio.length}/160</small></label>
            {error ? <p className="onboarding-form-error" role="alert" aria-live="assertive">{error}</p> : null}
            <button type="submit" className="onboarding-primary-action" disabled={isSaving}>{isSaving ? <><LoaderCircle size={17} /> Salvando…</> : "Próximo"}</button>
          </form>
        </> : null}

        {currentStep === 2 ? <>
          <header><h1 id="onboarding-title">Conte-nos o que você faz</h1><p>Escolha até três áreas para tornar suas conexões mais relevantes.</p></header>
          <div className="onboarding-skills" aria-busy={isLoadingSkills}>
            <label className="onboarding-skill-search"><Search size={18} /><input value={skillSearch} onChange={(event) => setSkillSearch(event.target.value)} placeholder="Busque uma área de atuação" autoComplete="off" /></label>
            {selectedSkills.length ? <div className="onboarding-selected-skills" aria-label="Áreas selecionadas">{selectedSkills.map((skill) => <button type="button" className="onboarding-skill-chip is-selected" key={skill.id} onClick={() => removeSkill(skill)}>{skill.name} <X size={14} aria-label={`Remover ${skill.name}`} /></button>)}</div> : null}
            <div className="onboarding-skill-results" aria-label="Resultados da busca">
              {isLoadingSkills ? <p className="onboarding-skills-loading"><LoaderCircle size={16} /> Carregando áreas…</p> : null}
              {!isLoadingSkills && filteredSkillTags.map((tag) => { const isSelected = selectedSkills.some((selected) => selected.id === tag.id); return <button type="button" className="onboarding-skill-chip" key={tag.id} onClick={() => addSkill(tag)} disabled={isSelected || selectedSkills.length >= MAX_SELECTED_SKILLS}>{isSelected ? <Check size={14} /> : <Plus size={14} />} {tag.name}</button>; })}
              {!isLoadingSkills && !filteredSkillTags.length ? <p className="onboarding-skills-empty">Nenhuma área encontrada. Tente “Outro”.</p> : null}
            </div>
            <button type="button" className="onboarding-other-button" onClick={() => { setShowCustomSkill((visible) => !visible); setSimilarSuggestion(null); setError(null); }}><Plus size={16} /> Outro</button>
            {showCustomSkill ? <form className="onboarding-custom-skill" onSubmit={checkCustomSkill}><label><span>Qual área você quer adicionar?</span><input value={customSkill} onChange={(event) => { setCustomSkill(event.target.value); setSimilarSuggestion(null); }} placeholder="Ex.: Especialista em motion" maxLength={80} autoFocus /></label><button type="submit" disabled={isCheckingSimilar}>{isCheckingSimilar ? "Buscando…" : "Adicionar"}</button></form> : null}
            {similarSuggestion ? <div className="onboarding-similar-suggestion" role="status"><strong>Você quis dizer “{similarSuggestion.name}”?</strong><span>Encontramos uma área parecida no catálogo. Você decide qual usar.</span><div><button type="button" onClick={acceptSuggestion}>Usar “{similarSuggestion.name}”</button><button type="button" onClick={keepCustomSkill}>Manter “{normalizeCustomSkill(customSkill)}”</button></div></div> : null}
            <p className="onboarding-skill-count">{selectedSkills.length}/{MAX_SELECTED_SKILLS} áreas selecionadas</p>
            {limitNotice ? <p className="onboarding-limit-notice" role="status">{limitNotice}</p> : null}
            {error ? <p className="onboarding-form-error" role="alert" aria-live="assertive">{error}</p> : null}
            {notice ? <p className="onboarding-form-notice" role="status" aria-live="polite">{notice}</p> : null}
            <button type="button" className="onboarding-primary-action" onClick={() => void saveSkills()} disabled={isSavingSkills || !selectedSkills.length}>{isSavingSkills ? <><LoaderCircle size={17} /> Salvando…</> : "Próximo"}</button>
            <button type="button" className="onboarding-back" onClick={() => setCurrentStep(1)}>Voltar</button>
          </div>
        </> : null}

        {currentStep === 3 ? <>
          <header><h1 id="onboarding-title">Há quanto tempo você faz isso?</h1><p>Isso nos ajuda a apresentar oportunidades no ritmo certo para você.</p></header>
          <div className="onboarding-experience-options" role="radiogroup" aria-label="Nível de experiência">
            {EXPERIENCE_LEVELS.map((level) => <button type="button" role="radio" aria-checked={experienceLevel === level.value} className={`onboarding-experience-option ${experienceLevel === level.value ? "is-selected" : ""}`} key={level.value} onClick={() => { setExperienceLevel(level.value); setError(null); }}><strong>{level.title}</strong><span>{level.description}</span></button>)}
          </div>
          {error ? <p className="onboarding-form-error" role="alert" aria-live="assertive">{error}</p> : null}
          <button type="button" className="onboarding-primary-action" onClick={() => void saveExperience()} disabled={isSavingExperience || !experienceLevel}>{isSavingExperience ? <><LoaderCircle size={17} /> Salvando…</> : "Próximo"}</button>
          <button type="button" className="onboarding-back" onClick={() => setCurrentStep(2)}>Voltar</button>
        </> : null}

        {currentStep === 4 ? <>
          <header><h1 id="onboarding-title">Onde mais podem te encontrar?</h1><p>Adicione seus links profissionais. Esta etapa é opcional e você pode completar depois.</p></header>
          <div className="onboarding-social-links" aria-busy={isLoadingLinks}>
            {SOCIAL_LINK_FIELDS.map((field) => <label className="onboarding-field" key={field.type}><span>{field.label}</span><input type="url" inputMode="url" value={socialLinks[field.type]} onChange={(event) => { setSocialLinks((current) => ({ ...current, [field.type]: event.target.value })); setError(null); }} placeholder={field.placeholder} autoComplete="url" /></label>)}
            <div className="onboarding-other-link"><label className="onboarding-field"><span>Outro</span><input value={otherLinkLabel} onChange={(event) => { setOtherLinkLabel(event.target.value); setError(null); }} placeholder="Ex.: Meu site" maxLength={60} /></label><label className="onboarding-field"><span>Link</span><input type="url" inputMode="url" value={otherLinkUrl} onChange={(event) => { setOtherLinkUrl(event.target.value); setError(null); }} placeholder="https://seusite.com" autoComplete="url" /></label></div>
            {isLoadingLinks ? <p className="onboarding-links-loading"><LoaderCircle size={16} /> Carregando links…</p> : null}
          </div>
          {error ? <p className="onboarding-form-error" role="alert" aria-live="assertive">{error}</p> : null}
          <div className="onboarding-final-actions"><button type="button" className="onboarding-skip-action" onClick={() => void completeOnboarding(false)} disabled={isCompletingOnboarding || isLoadingLinks}>Pular por agora</button><button type="button" className="onboarding-primary-action" onClick={() => void completeOnboarding(true)} disabled={isCompletingOnboarding || isLoadingLinks}>{isCompletingOnboarding ? <><LoaderCircle size={17} /> Concluindo…</> : "Concluir"}</button></div>
          <button type="button" className="onboarding-back" onClick={() => setCurrentStep(3)} disabled={isCompletingOnboarding}>Voltar</button>
        </> : null}
      </div>
    </section>
  );
}
