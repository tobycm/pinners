import { EmbedBuilder, inlineCode, Message, SlashCommandBuilder } from "discord.js";
import { Pin } from "models/pin";
import Command from "modules/command";
import { makePinEntry } from "modules/utils";

const data = new SlashCommandBuilder().setName("list").setDescription("List all of your pins with Pinners.");

// data.addChannelOption((option) => option.setName("channel").setDescription("The channel to pin the message in.").setRequired(true));

export default new Command({
  data,
  async run(ctx) {
    const pins: Pin[] = [];

    const s = await ctx.bot.db.ref("pins").child(ctx.channel.id).get<Pin[]>();

    if (s.exists()) pins.push(...s.val()!);

    if (!pins.length) return ctx.reply("You don't have any pins yet.");

    const pinsWithMessages: ((Pin & { message: Message }) | undefined)[] = await Promise.all(
      pins.map(async (pin) => {
        try {
          return {
            ...pin,
            message: await ctx.channel.messages.fetch(pin.messageId),
          };
        } catch {
          return;
        }
      })
    );

    const embed = new EmbedBuilder()
      .setTitle("Your Pins")
      .setAuthor({ name: `${inlineCode(ctx.author.displayName)}'s pins`, iconURL: ctx.author.avatarURL() ?? undefined })
      .setColor("Random")
      .setDescription(`You have ${pinsWithMessages.length} pins. ${pinsWithMessages.filter((pin) => !pin).length} pins' messages failed to retrieve.`)
      .setFooter({ text: "Scope: Channel" })
      .setTimestamp()
      .addFields(pinsWithMessages.filter((pin) => pin).map((pin) => makePinEntry(pin!)));

    return ctx.send({ embeds: [embed] });
  },
});
