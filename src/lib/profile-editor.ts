import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Profile } from "@/lib/profile";

export const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

type SaveProfileDetailsInput = {
  user: User;
  profile: Profile | null;
  fullName: string;
  bio: string;
  avatarFile: File | null;
  username?: string;
};

export function getAvatarFileValidationError(file: File) {
  if (ACCEPTED_AVATAR_TYPES.includes(file.type) && file.size <= MAX_AVATAR_SIZE) return null;
  return "Escolha uma imagem JPG, PNG, WebP ou GIF de até 2 MB.";
}

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export async function saveProfileDetails({
  user,
  profile,
  fullName,
  bio,
  avatarFile,
  username,
}: SaveProfileDetailsInput) {
  const normalizedName = fullName.trim();
  if (!normalizedName) throw new Error("Informe seu nome de exibição.");

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

  const update = {
    full_name: normalizedName,
    bio: bio.trim() || null,
    avatar_url: avatarUrl,
    ...(username === undefined ? {} : { username }),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("id, username, full_name, avatar_url, bio, created_at, onboarding_completed_at, experience_level")
    .single();

  if (error) {
    console.error("[Looma] Falha ao atualizar profiles.", {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === "23505") throw new Error("Esse username já está em uso. Escolha outro.");
    throw new Error("Não foi possível salvar seu perfil. Tente novamente.");
  }

  return data as Profile;
}
