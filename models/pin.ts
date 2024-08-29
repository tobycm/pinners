import { GuildBasedChannel, Message, Role, User } from "discord.js";

export type PinType = "message" | "channel" | "user" | "slashCommand" | "role";

export interface BasePin {
  created: number;

  type: PinType;
}

export interface MessagePin<Fetched extends boolean = boolean> extends BasePin {
  type: "message";

  messageId: string;
  message: Fetched extends true ? Message : undefined;
}

export interface ChannelPin<Fetched extends boolean = boolean> extends BasePin {
  type: "channel";

  channelId: string;
  channel: Fetched extends true ? GuildBasedChannel : undefined;
}

export interface UserPin<Fetched extends boolean = boolean> extends BasePin {
  type: "user";

  userId: string;
  user: Fetched extends true ? User : undefined;
}

export interface SlashCommandPin extends BasePin {
  type: "slashCommand";

  commandName: string;
  commandId: string;
}

export interface RolePin<Fetched extends boolean = boolean> extends BasePin {
  type: "role";

  roleId: string;
  role: Fetched extends true ? Role : undefined;
}

export type Pin<Fetched extends boolean = boolean> =
  | MessagePin<Fetched>
  | ChannelPin<Fetched>
  | UserPin<Fetched>
  | SlashCommandPin
  | RolePin<Fetched>;
