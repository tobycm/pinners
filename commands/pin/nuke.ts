import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, SlashCommandBuilder } from "discord.js";
import { collectFirstInteraction } from "modules/asyncCollectors";
import Command from "modules/command";

const data = new SlashCommandBuilder().setName("nuke").setDescription("⚠️⚠️⚠️ Delete all pins ⚠️⚠️⚠️.");

data.addBooleanOption((option) => option.setName("personal").setDescription("Include your personal pins."));
data.addBooleanOption((option) => option.setName("server").setDescription("Include the server's pins."));

export default new Command({
  data: new SlashCommandBuilder().setName("nuke").setDescription("⚠️⚠️⚠️ Delete all pins ⚠️⚠️⚠️."),
  async run(ctx) {
    const personal = ctx.options.get<boolean>("personal") ?? false;
    const server = ctx.options.get<boolean>("server") ?? false;

    ctx.reply({
      content: "⚠️⚠️⚠️ Are you sure you want to delete all pins? This action is irreversible. ⚠️⚠️⚠️",
      ephemeral: true,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setEmoji("✅").setCustomId("no").setLabel("No").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setEmoji("☑️").setCustomId("nostill").setLabel("Not yet").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setEmoji("❌").setCustomId("yes").setLabel("Yes").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setEmoji("➡️").setCustomId("notyet").setLabel("Nah").setStyle(ButtonStyle.Danger)
        ),
      ],
    });

    let confirmation: ButtonInteraction;

    try {
      confirmation = await collectFirstInteraction<ButtonInteraction>(ctx.bot, {
        componentType: ComponentType.Button,
        channel: ctx.channel,
        time: 15000,
      });
    } catch {
      return;
    }

    if (confirmation.customId !== "yes") return;

    if (personal) await ctx.bot.db.ref("pins").child(ctx.author.id).remove();
    if (server) await ctx.bot.db.ref("pins").child(ctx.guild!.id).remove();
    await ctx.bot.db.ref("pins").child(ctx.channel.id).remove();
    return confirmation.update({ content: "All pins have been deleted." });
  },
});
