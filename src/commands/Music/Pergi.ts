import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';

import { getDefaultPrefix } from '../../lib/utils';
import {
	RequiresClientInVoiceChannel,
	RequiresUserInClientVoiceChannel,
	RequiresUserInVoiceChannel,
} from '../../lib/commands/Music/functionPreconditions';

import type { Message } from 'discord.js';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['pg', 'leave', 'l', 'stop'],
	description: 'Buat minta anu keluar dari vc.',
	detailedDescription: getDefaultPrefix() + ' pergi',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class PergiCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	@RequiresUserInVoiceChannel()
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message) {
		const musicPlayer = this.container.musicCommandCache.musicPlayers.get(message.guildId!);
		musicPlayer?.leave(message);
		this.container.musicCommandCache.musicPlayers.delete(message.guildId!);
	}
}
