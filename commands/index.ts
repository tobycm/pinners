import Bot from "Bot";
import Command from "modules/command";
import help from "./help";
import pin from "./pin";
import ping from "./ping";

const commands: Command[] = [
  ping, // add your commands here
  pin._new,
  pin.list,
  help,
];

export default function setupCommands(bot: Bot) {
  commands.forEach((command) => bot.commands.set(command.data.name, command));
}
