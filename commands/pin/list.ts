import { channelMention, EmbedBuilder, SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import { MessagePin, Pin } from "models/pin";
import Command from "modules/command";
import { makePinEntry } from "modules/utils";

const data = new SlashCommandBuilder().setName("list").setDescription("List all of your pins with Pinners.");

data.addBooleanOption((option) => option.setName("personal").setDescription("Include your personal pins."));
data.addStringOption((option) => option.setName("filter").setDescription('Filter the pins. (input "help" for options)').setRequired(false));

const filterHelp = `
Filters will be in \`key=value\` format, separated by \`&\`. %%include_examples%%

- \`author=authorId\` - Filter by author ID.
- \`before=timestamp\` - Filter by pins before the timestamp. (seconds)
- \`after=timestamp\` - Filter by pins after the timestamp. (seconds)
- \`includes=string\` - Filter by message content includes the string.
- \`type=type\` - Filter by pin type: \`message\`, \`channel\` (server only), \`user\`, \`slashCommand\`, \`role\` (server only). Comma-separated for multiple types.
%%examples%%`;

const includeExamples = `Rerun the command with \`help=examples\` to see examples.`;

const examples = `
Example: \`author=123456789012345678\` will only show pins from the author with the ID of 123456789012345678.
\`includes=hello\` will only show pins that include the word "hello" in the message content.
\`before=1630000000\` will only show pins that are pinned before the timestamp of 1630000000, which is before ${time(
  new Date(1630000000 * 1000),
  TimestampStyles.ShortDateTime
)}.
\`includes=hello&author=123456789012345678\` will only show pins that include the word "hello" in the message content and are from the author with the ID of 123456789012345678.`;

type Filter = (pin: Pin<true>) => boolean;

const parseFilters = (filters: string): Filter[] =>
  filters.split("&").map((filter) => {
    const [key, value] = filter.split("=");
    switch (key) {
      case "author":
        return (pin) => pin.type === "message" && pin.message.author.id === value;
      case "before":
        return (pin) => pin.created < Number(value) * 1000;
      case "after":
        return (pin) => pin.created > Number(value) * 1000;
      case "includes":
        return (pin) =>
          (pin.type === "message" && pin.message.content.includes(value)) ||
          (pin.type === "channel" && pin.channel.name.includes(value)) ||
          (pin.type === "user" && pin.user.username.includes(value)) ||
          (pin.type === "slashCommand" && pin.commandName.includes(value)) ||
          (pin.type === "role" && pin.role.name.includes(value)) ||
          false;
      default:
        return () => true;
    }
  });

const filterPins = (pins: Pin<true>[], filters: Filter[]): Pin<true>[] => pins.filter((pin) => filters.every((filter) => filter(pin)));

export default new Command({
  data,
  async run(ctx) {
    const personal = ctx.options.get<boolean>("personal") ?? false;

    const filter = ctx.options.get<string>("filter") ?? "";

    if (filter === "help" || filter === "help=examples") {
      const withExamples = filter === "help=examples";

      return ctx.reply({
        content: filterHelp
          .replace("%%include_examples%%", withExamples ? "" : includeExamples)
          .replace("%%examples%%", withExamples ? examples : ""),
        ephemeral: true,
      });
    }

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

    const fetchedPins: (Pin<true> | undefined)[] = await Promise.all(
      pins.map(async (pin) => {
        try {
          switch (pin.type) {
            case "message":
              return { ...pin, message: await ctx.channel.messages.fetch(pin.messageId) };
            case "channel":
              const channel = await ctx.guild!.channels.fetch(pin.channelId);
              if (!channel) return;
              return { ...pin, channel };
            case "user":
              return { ...pin, user: await ctx.bot.users.fetch(pin.userId) };
            case "slashCommand":
              return pin;
            case "role":
              const role = await ctx.guild!.roles.fetch(pin.roleId);
              if (!role) return;
              return { ...pin, role };
          }
        } catch {
          return;
        }
      })
    );

    const filteredPins = filterPins(fetchedPins.filter((pin) => pin) as Pin<true>[], parsedFilters);

    const description = `You have ${fetchedPins.length} pins. ${fetchedPins.filter((pin) => !pin).length} pins failed to retrieve. ${
      filteredPins.length
    } after filtered.`;

    const embed = new EmbedBuilder()
      .setTitle("Your Pins")
      .setAuthor({ name: `${ctx.author.displayName}'s pins`, iconURL: ctx.author.avatarURL() ?? undefined })
      .setColor("Random")
      .setDescription(description)
      .setFooter({ text: `Scope: ${scopes.join(", ")}` })
      .setTimestamp();

    const channelPins = filteredPins.filter((pin) => pin?.type === "channel");
    if (channelPins.length)
      embed.addFields({
        name: "Channel pins",
        value: channelPins.map((pin) => channelMention(pin.channelId)).join("\n"),
      });

    const userPins = filteredPins.filter((pin) => pin?.type === "user");
    if (userPins.length)
      embed.addFields({
        name: "User pins",
        value: userPins.map((pin) => pin.user.toString()).join("\n"),
      });

    const rolePins = filteredPins.filter((pin) => pin?.type === "role");
    if (rolePins.length)
      embed.addFields({
        name: "Role pins",
        value: rolePins.map((pin) => pin.role.toString()).join("\n"),
      });

    const slashCommandPins = filteredPins.filter((pin) => pin?.type === "slashCommand");
    if (slashCommandPins.length)
      embed.addFields({
        name: "Slash Command pins",
        value: slashCommandPins.map((pin) => `</${pin.commandName}:${pin.commandId}>`).join("\n"),
      });

    const messagePins = filteredPins.filter((pin) => pin?.type === "message") as MessagePin<true>[];
    if (messagePins.length)
      embed.addFields((fetchedPins.filter((pin) => pin?.type === "message") as MessagePin<true>[]).map((pin) => makePinEntry(pin)));

    return ctx.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
});
