import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';

import {
	RequiresClientInVoiceChannel,
	RequiresUserInClientVoiceChannel,
	RequiresUserInVoiceChannel,
} from '../../lib/commands/Music/functionPreconditions';
import { getGuildMusicPlayer } from '../../lib/commands/Music/utils';
import { getDefaultPrefix } from '../../lib/utils';

import type { Message } from 'discord.js';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['s'],
	description: 'Buat skip lagu di playlist.',
	detailedDescription: getDefaultPrefix() + ' skip',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class SkipCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	@RequiresUserInVoiceChannel()
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message) {
		return getGuildMusicPlayer(message.guildId!)?.skip(message);
	}
}
