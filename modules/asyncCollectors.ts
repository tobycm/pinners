import { Interaction, InteractionCollector, Message, MessageCollector } from "discord.js";

export function collectFirstInteraction<Type extends Interaction = Interaction>(...args: ConstructorParameters<typeof InteractionCollector>) {
  if (!args[1]) args[1] = {};
  args[1].max = 1;

  return new Promise<Type>((resolve, reject) => {
    new InteractionCollector(...args).on("collect", resolve);

    setTimeout(() => {
      reject("No interactions collected");
    }, args[1]!.time);
  });
}

export function collectFirstMessage(...args: ConstructorParameters<typeof MessageCollector>) {
  if (!args[1]) args[1] = {};
  args[1].max = 1;

  return new Promise<Message>((resolve, reject) => {
    new MessageCollector(...args).on("collect", resolve);

    setTimeout(() => {
      reject("No messages collected");
    }, args[1]!.time);
  });
}
