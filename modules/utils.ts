import Bot from "Bot";
import {
  APIEmbedField,
  ApplicationCommandOptionBase,
  ApplicationCommandOptionType,
  codeBlock,
  escapeCodeBlock,
  GuildMember,
  messageLink,
  PermissionFlagsBits,
  time,
  TimestampStyles,
} from "discord.js";
import { MessagePin } from "models/pin";
import Command from "./command";
import { BaseContext } from "./context";

export type Perm = keyof typeof PermissionFlagsBits;

export const intToBitField = (int: bigint): Perm[] => (Object.keys(PermissionFlagsBits) as Perm[]).filter((perm) => int & PermissionFlagsBits[perm]);

export const checkPermissions = (member: GuildMember, permissions: bigint): Perm[] =>
  intToBitField(permissions).filter((perm) => !member.permissions.has(perm));

type ValueOf<T> = T[keyof T];

function getEnumKeyFromValue<R extends string | number, T extends { [key: string]: R }>(myEnum: T, enumValue: ValueOf<T>): string {
  let keys = Object.keys(myEnum).filter((x) => myEnum[x] == enumValue);
  return keys.length > 0 ? keys[0] : "";
}

export function commandUsage(command: Command): string {
  const options = command.data.options as ApplicationCommandOptionBase[];

  const args: string[] = [];

  for (const option of options) {
    const type = getEnumKeyFromValue(ApplicationCommandOptionType, option.type) as keyof typeof ApplicationCommandOptionType;

    if (type === "Subcommand" || type === "SubcommandGroup") {
      // not supported
      continue;
    }

    const name = option.name;

    let wrappers = ["[", "]"]; // optional
    if (option.required) wrappers = ["<", ">"]; // required

    args.push(`${wrappers[0]}${name}: ${type}${wrappers[1]}`);
  }

  return args.join(" ");
}

export function parseIdFromUserMention(mention: string): string {
  if (!mention.startsWith("<@") || !mention.endsWith(">")) return "";

  mention = mention.slice(2, -1);

  if (mention.startsWith("!")) mention = mention.slice(1);

  return mention;
}

export function parseIdFromChannelMention(mention: string): string {
  if (!mention.startsWith("<#") || !mention.endsWith(">")) return "";

  return mention.slice(2, -1);
}

export function trimString(str: string, max: number, end: string = "..."): string {
  return str.length > max ? `${str.slice(0, max - end.length)}...` : str;
}

export function makePinEntry(pin: MessagePin<true>): APIEmbedField {
  const date = new Date(pin.created);

  return {
    name: `Pin on ${time(date, TimestampStyles.ShortDateTime)} ${messageLink(pin.message.channel.id, pin.message.id)}\n`,
    value: codeBlock(escapeCodeBlock(trimString(pin.message.content, 900))),
    inline: false,
  };
}

export async function getUserLang(ctx: Omit<BaseContext, "lang">): Promise<Bot["lang"][keyof Bot["lang"]]> {
  const lang = ctx.bot.cache.get(`users:${ctx.author.id}:lang`) as keyof Bot["lang"];

  if (lang) return ctx.bot.lang[lang];

  const user = await ctx.bot.db.ref("users").child(ctx.author.id).get<keyof Bot["lang"]>();

  if (!user.exists()) return ctx.bot.lang["en-us"];

  return ctx.bot.lang[user.val()!];
}

export const toTitleCase = (str: string) => str.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());
