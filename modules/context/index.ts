import Bot from "Bot";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  GuildTextBasedChannel,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
  MessageCreateOptions,
  MessagePayload,
  MessageReplyOptions,
  TextBasedChannel,
  User,
} from "discord.js";
import { getUserLang } from "modules/utils";
import CommandOptions from "./options";

export interface BaseContext<GuildOnly extends boolean = false> {
  bot: Bot<true>;
  lang: Bot["lang"][keyof Bot["lang"]];
  channel: GuildOnly extends true ? GuildTextBasedChannel : TextBasedChannel;
  guild: GuildOnly extends true ? Guild : Guild | null;
  author: User;
  member: GuildOnly extends true ? GuildMember : GuildMember | null;

  original: Message | ChatInputCommandInteraction | InteractionResponse | ButtonInteraction;

  options: CommandOptions;

  send(options: string | MessagePayload | MessageCreateOptions): Promise<BaseContext>;
  reply(options: string | MessageReplyOptions | InteractionReplyOptions): Promise<BaseContext>;
}

export interface MessageContext<GuildOnly extends boolean = false> extends BaseContext<GuildOnly> {
  original: Message;

  send(options: string | MessagePayload | MessageCreateOptions): Promise<MessageContext>;
  reply(options: string | MessageReplyOptions): Promise<MessageContext>;
}

export const MessageContext = async (message: Message): Promise<MessageContext> => {
  const ctx: Omit<MessageContext, "lang"> = {
    bot: message.client,
    channel: message.channel,
    guild: message.guild,
    author: message.author,
    member: message.member,
    original: message,
    options: new CommandOptions(),
    send: async (options) => await MessageContext(await message.channel.send(options)),
    reply: async (options) => await MessageContext(await message.reply(options)),
  };

  return {
    ...ctx,
    lang: await getUserLang(ctx),
  };
};

export interface ChatInputInteractionContext<GuildOnly extends boolean = false> extends BaseContext<GuildOnly> {
  original: ChatInputCommandInteraction;

  send(options: string | MessagePayload | MessageCreateOptions): Promise<MessageContext>;
  reply(options: string | InteractionReplyOptions): Promise<InteractionResponseContext>;
}

export const ChatInputInteractionContext = async (interaction: ChatInputCommandInteraction): Promise<ChatInputInteractionContext> => {
  const ctx: Omit<ChatInputInteractionContext, "lang"> = {
    bot: interaction.client,
    channel: interaction.channel!,
    guild: interaction.guild,
    author: interaction.user,
    member: interaction.member as GuildMember | null,
    original: interaction,
    options: new CommandOptions(),
    send: async (options) => await MessageContext(await interaction.channel!.send(options)),
    reply: async (options) => await InteractionResponseContext(await interaction.reply(options)),
  };

  return {
    ...ctx,
    lang: await getUserLang(ctx),
  };
};

export interface InteractionResponseContext extends BaseContext {
  original: InteractionResponse<true>;

  send(options: string | MessagePayload | MessageCreateOptions): Promise<MessageContext>;
  reply(options: string | MessageReplyOptions): Promise<MessageContext>;
}

export const InteractionResponseContext = async (response: InteractionResponse<true>): Promise<InteractionResponseContext> => {
  const ctx: Omit<InteractionResponseContext, "lang"> = {
    bot: response.client as Bot<true>,
    channel: response.interaction.channel!,
    guild: response.interaction.guild,
    author: response.interaction.user,
    member: response.interaction.member,
    original: response,
    options: new CommandOptions(),
    send: async (options) => await MessageContext(await response.interaction.channel!.send(options)),
    reply: async (options) => await MessageContext(await (await response.fetch()).reply(options)),
  };

  return {
    ...ctx,
    lang: await getUserLang(ctx),
  };
};

export interface ButtonInteractionContext extends BaseContext {
  original: ButtonInteraction;

  send(options: string | MessagePayload | MessageCreateOptions): Promise<MessageContext>;
  reply(options: string | InteractionReplyOptions): Promise<InteractionResponseContext>;
}

export const ButtonInteractionContext = async (interaction: ButtonInteraction): Promise<ButtonInteractionContext> => {
  const ctx: Omit<ButtonInteractionContext, "lang"> = {
    bot: interaction.client,
    author: interaction.user,
    channel: interaction.channel!,
    guild: interaction.guild,
    member: interaction.member as GuildMember | null,
    original: interaction,
    options: new CommandOptions(),
    send: async (options) => await MessageContext(await interaction.channel!.send(options)),
    reply: async (options) => await InteractionResponseContext(await interaction.reply(options)),
  };
  return {
    ...ctx,
    lang: await getUserLang(ctx),
  };
};
