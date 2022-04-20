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
	aliases: ['clear', 'reset'],
	description: 'Buat hapus semua kenangan masa lalumu... Ehh, ngga, mksdnya semua antrean lagu. xixixi',
	detailedDescription: getDefaultPrefix() + ' bersihkan',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class BersihkanCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	@RequiresUserInVoiceChannel()
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message) {
		return getGuildMusicPlayer(message.guildId!)?.clear(message);
	}
}
