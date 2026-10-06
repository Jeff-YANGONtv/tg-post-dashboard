import {
  downloadTelegramFile,
  getConfiguredTelegramToken,
  TelegramError,
  telegramCall,
} from "./client";

export type ChatPhoto = {
  small_file_id: string;
  small_file_unique_id: string;
  big_file_id: string;
  big_file_unique_id: string;
};
export type Chat = {
  id: number;
  title?: string;
  username?: string;
  type: string;
  photo?: ChatPhoto;
};
export type TelegramFile = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
};
export type Member = {
  status: string;
  can_post_messages?: boolean;
  can_delete_messages?: boolean;
  can_manage_chat?: boolean;
  can_post_stories?: boolean;
};
export const getMe = (token?: string) =>
  telegramCall<{ id: number; username: string }>("getMe", {}, 0, token);
export const getChat = (chat_id: number | string, token?: string) =>
  telegramCall<Chat>("getChat", { chat_id }, 0, token);
export const getFile = (file_id: string, token?: string) =>
  telegramCall<TelegramFile>("getFile", { file_id }, 0, token);

export async function getChatProfilePhoto(chat_id: number | string) {
  const token = await getConfiguredTelegramToken();
  if (!token) throw new TelegramError("Telegram bot token is not configured");

  const chat = await getChat(chat_id, token);
  const fileId = chat.photo?.small_file_id;
  if (!fileId) return null;

  const file = await getFile(fileId, token);
  if (!file.file_path) return null;
  return downloadTelegramFile(file.file_path, token);
}

export const getChatMemberCount = (chat_id: number | string) =>
  telegramCall<number>("getChatMemberCount", { chat_id });
export const getChatMember = (
  chat_id: number | string,
  user_id: number | string
) => telegramCall<Member>("getChatMember", { chat_id, user_id });
export const sendMessage = (chat_id: number | string, text: string) =>
  telegramCall<{ message_id: number }>("sendMessage", { chat_id, text });
export const sendPhoto = (
  chat_id: number | string,
  photo: string,
  caption?: string
) =>
  telegramCall<{ message_id: number }>("sendPhoto", {
    chat_id,
    photo,
    caption,
  });
export const sendVideo = (
  chat_id: number | string,
  video: string,
  caption?: string
) =>
  telegramCall<{ message_id: number }>("sendVideo", {
    chat_id,
    video,
    caption,
  });
export const forwardMessage = (
  chat_id: number | string,
  from_chat_id: number | string,
  message_id: number
) =>
  telegramCall<{ message_id: number }>("forwardMessage", {
    chat_id,
    from_chat_id,
    message_id,
  });
export const deleteMessage = (chat_id: number | string, message_id: number) =>
  telegramCall<boolean>("deleteMessage", { chat_id, message_id });
export type WebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
  last_error_date?: number;
  allowed_updates?: string[];
};
export const setWebhook = (
  url: string,
  secret_token?: string,
  token?: string
) =>
  telegramCall<boolean>(
    "setWebhook",
    {
      url,
      secret_token,
      allowed_updates: ["channel_post"],
      drop_pending_updates: false,
    },
    0,
    token
  );
export const getWebhookInfo = (token?: string) =>
  telegramCall<WebhookInfo>("getWebhookInfo", {}, 0, token);
