import { Precondition } from '@sapphire/framework';
import { isNullOrUndefined } from '@sapphire/utilities';
import type { Message } from 'discord.js';

export class GuildOnlyPrecondition extends Precondition {
  public run(message: Message) {
    return !isNullOrUndefined(message.guildId)
      ? this.ok()
      : this.error({ message: '> *Command ini cm bisa di server mz. :sweat_smile:*' });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    ClientIsNotInVoiceChannel: never;
  }
}
