import { EmbedBuilder, Message, SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import { Pin } from "models/pin";
import Command from "modules/command";
import { makePinEntry } from "modules/utils";

type PinWithMessage = Pin & { message: Message };

const data = new SlashCommandBuilder().setName("list").setDescription("List all of your pins with Pinners.");

data.addBooleanOption((option) => option.setName("personal").setDescription("Include your personal pins."));

data.addStringOption((option) => option.setName("filter").setDescription('Filter the pins. (input "help" for options)').setRequired(false));

const filterHelp = `
Filters will be in key=value format, separated by "&".

- \`author=authorId\` - Filter by author ID.
- \`before=timestamp\` - Filter by pins before the timestamp. (seconds)
- \`after=timestamp\` - Filter by pins after the timestamp. (seconds)
- \`includes=string\` - Filter by message content includes the string.

Example: \`author=123456789012345678\` will only show pins from the author with the ID of 123456789012345678.
\`includes=hello\` will only show pins that include the word "hello" in the message content.
\`before=1630000000\` will only show pins that are pinned before the timestamp of 1630000000, which is before ${time(
  new Date(1630000000 * 1000),
  TimestampStyles.ShortDateTime
)}.
\`includes=hello&author=123456789012345678\` will only show pins that include the word "hello" in the message content and are from the author with the ID of 123456789012345678.

` as const;

type Filter = (pin: PinWithMessage) => boolean;

const parseFilters = (filters: string): Filter[] =>
  filters.split("&").map((filter) => {
    const [key, value] = filter.split("=");
    switch (key) {
      case "author":
        return (pin: PinWithMessage) => pin.message.author.id === value;
      case "before":
        return (pin: PinWithMessage) => pin.created < Number(value) * 1000;
      case "after":
        return (pin: PinWithMessage) => pin.created > Number(value) * 1000;
      case "includes":
        return (pin: PinWithMessage) => pin.message.content.includes(value);
      default:
        return () => true;
    }
  });

const filterPins = (pins: PinWithMessage[], filters: Filter[]): PinWithMessage[] => pins.filter((pin) => filters.every((filter) => filter(pin)));

export default new Command({
  data,
  async run(ctx) {
    const personal = ctx.options.get<boolean>("personal") ?? false;

    const filter = ctx.options.get<string>("filter") ?? "";

    if (filter === "help") return ctx.reply({ content: filterHelp, ephemeral: true });

    const parsedFilters = parseFilters(filter);

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

    const pinsWithMessages: (PinWithMessage | undefined)[] = await Promise.all(
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

    const filteredPins = filterPins(pinsWithMessages.filter((pin) => pin) as PinWithMessage[], parsedFilters);

    const description = `You have ${pinsWithMessages.length} pins. ${pinsWithMessages.filter((pin) => !pin).length} pins failed to retrieve. ${
      filteredPins.length
    } after filtered.`;

    const embed = new EmbedBuilder()
      .setTitle("Your Pins")
      .setAuthor({ name: `${ctx.author.displayName}'s pins`, iconURL: ctx.author.avatarURL() ?? undefined })
      .setColor("Random")
      .setDescription(description)
      .setFooter({ text: `Scope: ${scopes.join(", ")}` })
      .setTimestamp()
      .addFields(pinsWithMessages.filter((pin) => pin).map((pin) => makePinEntry(pin!)));

    return ctx.send({ embeds: [embed], allowedMentions: { parse: [] } });
  },
});
