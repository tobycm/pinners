import { GuildBasedChannel, Message, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Pin } from "models/pin";
import { collectFirstMessage } from "modules/asyncCollectors";
import Command from "modules/command";

const data = new SlashCommandBuilder()
  .setName("new")
  .setDescription("Create a new pin.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

data.addBooleanOption((option) =>
  option.setName("personal").setDescription("Save in your pins collection instead of the channel.").setRequired(false)
);
data.addChannelOption((option) => option.setName("channel").setDescription("The channel to pin the message in."));

export default new Command({
  data,
  async run(ctx) {
    const original = await ctx.reply("Please reply to the message you want to pin.");

    const channel = ctx.options.get<GuildBasedChannel>("channel") ?? ctx.channel;
    if (!channel.isTextBased()) return original.original.edit({ content: "Text based channel only please." });

    let message: Message;
    try {
      message = await collectFirstMessage(ctx.channel, {
        filter: (m) => m.author.id === ctx.author.id && m.reference !== null,
        time: 120000,
      });
    } catch {
      return original.original.edit({ content: "Sory, you took too long to reply. :(" });
    }

    ctx.bot.db.ref("pins").child<Pin[]>(ctx.channel.id).push({
      created: Date.now(),

      channelId: channel.id,
      messageId: message.reference!.messageId!,
    });

    message.react("📌");

    return original.original.edit({ content: "Message pinned successfully!" });
  },
});
