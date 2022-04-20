import { Precondition } from '@sapphire/framework';
import { envParseArray } from '../lib/env-parser';
import type { Message } from 'discord.js';

const OWNERS = envParseArray('OWNERS');

export class OwnerOnlyPrecondition extends Precondition {
	public async run(message: Message) {
		return OWNERS.includes(message.author.id) ? this.ok() : this.error({ message: 'Maap ya mz, cuma owner yang bisa pake command ini.' });
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
	}
}
