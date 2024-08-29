import { GuildBasedChannel, Message, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Pin } from "models/pin";
import { collectFirstMessage } from "modules/asyncCollectors";
import Command from "modules/command";

const data = new SlashCommandBuilder()
  .setName("new")
  .setDescription("Create a new pin.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

data.addBooleanOption((option) =>
  option.setName("personal").setDescription("Save in your personal pins collection instead of the channel's. (Also DMs is not personal.)")
);
data.addBooleanOption((option) => option.setName("server").setDescription("Save in the server's pins collection instead of the channel's."));
data.addChannelOption((option) =>
  option.setName("channel").setDescription("Save in a different channel's pins collection. (Server only) (Different from channel type)")
);

data.addStringOption((option) =>
  option
    .setName("type")
    .setDescription("Type of pin.")
    .setChoices(
      { name: "Message", value: "message" },
      { name: "Channel (server only)", value: "channel" },
      { name: "User", value: "user" },
      { name: "Slash Command", value: "slashCommand" },
      { name: "Role (server only)", value: "role" }
    )
    .setRequired(false)
);

export default new Command({
  data,
  async run(ctx) {
    const original = await ctx.reply("Please reply to the message you want to pin.");

    const personal = ctx.options.get<boolean>("personal") ?? false;
    const channel = ctx.options.get<GuildBasedChannel>("channel") ?? ctx.channel;
    const server = ctx.options.get<boolean>("server") ?? false;
    const type = ctx.options.get<"message" | "channel" | "user" | "slashCommand" | "role">("type") ?? "message";

    if (!ctx.guild) {
      if (server) return original.original.edit({ content: "Server option is only available in a server. :(" });
      if (["channel", "role"].includes(type)) return original.original.edit({ content: "Channel and Role type is only available in a server. :(" });
    }

    if (!channel.isTextBased()) return original.original.edit({ content: "Text based channel only please :(." });

    let message: Message;
    try {
      message = await collectFirstMessage(ctx.channel, {
        filter: (m) => m.author.id === ctx.author.id && m.reference !== null,
        time: 120000,
      });
    } catch {
      return original.original.edit({ content: "Sory, you took too long to reply. :(" });
    }

    ctx.bot.db
      .ref("pins")
      .child<Pin[]>(personal ? ctx.author.id : server ? ctx.guild!.id : channel.id)
      .push({
        created: Date.now(),

        messageId: message.reference!.messageId!,
      });

    message.react("📌");

    return original.original.edit({ content: "Message pinned successfully!" });
  },
});
