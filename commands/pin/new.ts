import { Message, SlashCommandBuilder } from "discord.js";
import { Pin } from "models/pin";
import { collectFirstMessage } from "modules/asyncCollectors";
import Command from "modules/command";

const data = new SlashCommandBuilder().setName("new").setDescription("Create a new pin.");

// data.addChannelOption((option) => option.setName("channel").setDescription("The channel to pin the message in.").setRequired(true));

export default new Command({
  data,
  async run(ctx) {
    const original = await ctx.reply("Please reply to the message you want to pin.");

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
      messageId: message.reference!.messageId!,
      created: Date.now(),
    });

    return original.original.edit({ content: "Message pinned successfully!" });
  },
});
