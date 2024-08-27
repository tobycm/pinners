import { EmbedBuilder, Message, SlashCommandBuilder } from "discord.js";
import { Pin } from "models/pin";
import Command from "modules/command";
import { makePinEntry } from "modules/utils";

const data = new SlashCommandBuilder().setName("list").setDescription("List all of your pins with Pinners.");

data.addBooleanOption((option) => option.setName("personal").setDescription("Include your personal pins."));

export default new Command({
  data,
  async run(ctx) {
    const personal = ctx.options.get<boolean>("personal") ?? false;

    const scopes: string[] = [];

    const pins: Pin[] = (
      await Promise.all<Pin[]>([
        (async () => {
          if (!ctx.guild) return [];
          scopes.push("Server");
          const s = await ctx.bot.db.ref("pins").child(ctx.guild.id).get<{ [key: string]: Pin }>();
          if (!s.exists()) return [];
          return Object.values(s.val()!);
        })(),
        (async () => {
          scopes.push("Channel");
          const s = await ctx.bot.db.ref("pins").child(ctx.channel.id).get<{ [key: string]: Pin }>();
          if (!s.exists()) return [];
          return Object.values(s.val()!);
        })(),
        (async () => {
          if (!personal) return [];
          const s = await ctx.bot.db.ref("pins").child(ctx.author.id).get<{ [key: string]: Pin }>();
          scopes.push("Personal");
          if (!s.exists()) return [];
          return Object.values(s.val()!);
        })(),
      ])
    ).flat();

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
      .setAuthor({ name: `${ctx.author.displayName}'s pins`, iconURL: ctx.author.avatarURL() ?? undefined })
      .setColor("Random")
      .setDescription(`You have ${pinsWithMessages.length} pins. ${pinsWithMessages.filter((pin) => !pin).length} pins failed to retrieve.`)
      .setFooter({ text: `Scope: ${scopes.join(", ")}` })
      .setTimestamp()
      .addFields(pinsWithMessages.filter((pin) => pin).map((pin) => makePinEntry(pin!)));

    return ctx.send({ embeds: [embed], allowedMentions: { parse: [] } });
  },
});
