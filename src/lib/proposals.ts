import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_PROPOSAL_MESSAGE_LENGTH = 1000;

type CreateWorkProposalInput = {
  senderId: string;
  recipientId: string;
  postId: string;
  postContent: string;
  message: string;
};

export function getWorkProposalTitle(postContent: string) {
  return `Proposta para: ${postContent.trim().slice(0, 72)}`;
}

export async function createWorkProposal(
  supabase: SupabaseClient,
  { senderId, recipientId, postId, postContent, message }: CreateWorkProposalInput,
) {
  return supabase.from("proposals").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    post_id: postId,
    title: getWorkProposalTitle(postContent),
    message,
  });
}
