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
import type { Args } from '@sapphire/framework';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['shuffle', 'random', 'mix'],
	description: 'Buat ngacak-acak urutan lagu.',
	detailedDescription: getDefaultPrefix() + ' acak [mati/off]',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class AcakCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	@RequiresUserInVoiceChannel()
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message, args: Args) {
		const musicPlayer = getGuildMusicPlayer(message.guildId!)!;
		const arg = await args.pickResult('string');

		switch (arg.value) {
			case 'mati':
			case 'off':
				musicPlayer.turnOffShuffle(message);
				break;
			default:
				musicPlayer.turnOnShuffle(message);
				break;
		}
	}
}
