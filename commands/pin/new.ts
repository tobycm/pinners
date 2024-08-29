import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  GuildBasedChannel,
  Message,
  ModalBuilder,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  User,
} from "discord.js";
import { Pin } from "models/pin";
import { collectFirstInteraction, collectFirstMessage } from "modules/asyncCollectors";
import Command from "modules/command";
import { InteractionResponseContext, MessageContext } from "modules/context";
import { toTitleCase } from "modules/utils";

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
    const personal = ctx.options.get<boolean>("personal") ?? false;
    const channel = ctx.options.get<GuildBasedChannel>("channel") ?? ctx.channel;
    const server = ctx.options.get<boolean>("server") ?? false;
    const type = ctx.options.get<"message" | "channel" | "user" | "slashCommand" | "role">("type") ?? "message";

    if (!ctx.guild) {
      if (server) return ctx.reply({ content: "Server option is only available in a server. :(" });
      if (["channel", "role"].includes(type)) return ctx.reply({ content: "Channel and Role type is only available in a server. :(" });
    }

    if (!channel.isTextBased()) return ctx.reply({ content: "Text based channel only please :(." });

    let pin: Pin<false>;
    let id: string;

    let original: InteractionResponseContext | MessageContext;
    if (type !== "slashCommand") original = await ctx.reply("Creating a new pin...");

    if (type === "message") {
      original!.original.edit("Please reply to the message you want to pin.");

      let message: Message;
      try {
        message = await collectFirstMessage(ctx.channel, {
          filter: (m) => m.author.id === ctx.author.id && m.reference !== null,
          time: 120000,
        });
      } catch {
        return original!.original.edit({ content: "Sory, you took too long to reply. :(" });
      }

      pin = {
        created: Date.now(),

        type: "message",
        messageId: message.reference!.messageId!,
        message: undefined,
      };
      id = message.reference!.messageId!;
    } else if (type === "channel") {
      original!.original.edit("Please mention the channel you want to pin.");

      let channel: GuildBasedChannel;
      try {
        const message = await collectFirstMessage(ctx.channel, {
          filter: (m) => m.author.id === ctx.author.id && m.mentions.channels.size > 0,
          time: 120000,
        });

        channel = message.mentions.channels.first() as GuildBasedChannel;
      } catch {
        return original!.original.edit({ content: "Sory, you took too long to mention the channel. :(" });
      }

      pin = {
        created: Date.now(),

        type: "channel",
        channelId: channel.id,
        channel: undefined,
      };
      id = channel.id;
    } else if (type === "user") {
      original!.original.edit("Please mention the user you want to pin.");

      let user: User;
      try {
        const message = await collectFirstMessage(ctx.channel, {
          filter: (m) => m.author.id === ctx.author.id && m.mentions.users.size > 0,
          time: 120000,
        });

        user = message.mentions.users.first()!;
      } catch {
        return original!.original.edit({ content: "Sory, you took too long to mention the user. :(" });
      }

      pin = {
        created: Date.now(),

        type: "user",
        userId: user.id,
        user: undefined,
      };
      id = user.id;
    } else if (type === "slashCommand") {
      let interaction: ButtonInteraction | ChatInputCommandInteraction;

      if (ctx.original instanceof Message) {
        ctx.reply({
          content: "Please open the modal to enter the command name and ID.",
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId("openModal").setLabel("Open Modal").setStyle(ButtonStyle.Primary)
            ),
          ],
        });
        try {
          interaction = await collectFirstInteraction<ButtonInteraction>(ctx.bot, {
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === ctx.author.id && i.customId === "openModal",
            channel: ctx.channel,
            time: 60000,
          });
        } catch {
          return ctx.reply({ content: "You took too long to open the modal. :(" });
        }
      } else interaction = ctx.original;

      interaction.showModal(
        new ModalBuilder()
          .setCustomId("new slashCommand pin")
          .setTitle("New slash command pin")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("commandName")
                .setLabel("Command Name")
                .setPlaceholder("ping")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(32)
                .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("commandId")
                .setLabel("Command ID")
                .setPlaceholder("123456789012345")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(25)
                .setRequired(true)
            )
          )
      );

      const response = await interaction.awaitModalSubmit({
        time: 60000,
        filter: (i) => i.user.id === ctx.author.id && i.customId === "new slashCommand pin",
      });

      const commandName = response.fields.getTextInputValue("commandName");
      const commandId = response.fields.getTextInputValue("commandId");

      if (commandId.match(/^\d+$/) === null) return response.reply({ content: "Invalid command ID. :(" });

      pin = {
        created: Date.now(),

        type: "slashCommand",
        commandName,
        commandId,
      };
      id = commandId;

      response.reply({ content: "Processing..." });

      original = await ctx.send("Creating a new pin...");
    } else if (type === "role") {
      original!.original.edit("Please mention the role you want to pin.");

      let role: Role;
      try {
        const message = await collectFirstMessage(ctx.channel, {
          filter: (m) => m.author.id === ctx.author.id && m.mentions.roles.size > 0,
          time: 120000,
        });

        role = message.mentions.roles.first()!;
      } catch {
        return original!.original.edit({ content: "Sory, you took too long to mention the role. :(" });
      }

      pin = {
        created: Date.now(),

        type: "role",
        roleId: role.id,
        role: undefined,
      };
      id = role.id;
    } else return;

    {
      const s = ctx.bot.db
        .ref("pins")
        .child(personal ? ctx.author.id : server ? ctx.guild!.id : channel.id)
        .child(id);
      if (await s.exists()) return original!.original.edit({ content: "This pin already exists. :0" });
      s.set(pin);
    }

    if (original!.original instanceof Message) original!.original.react("📌");
    else (await original!.original.fetch()).react("📌");

    return original!.original.edit({ content: `${toTitleCase(type)} pinned successfully!` });
  },
});
