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
	aliases: ['remove', 'delete', 'rm', 'del'],
	description: 'Buat hapus lagu yang km mau.',
	detailedDescription: getDefaultPrefix() + ' hapus <nomor lagu di antrean>',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class HapusCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	@RequiresUserInVoiceChannel()
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message, args: Args) {
		const musicPlayer = getGuildMusicPlayer(message.guildId!)!;
		const arg = await args.pickResult('number');

		if (!arg.success) {
			return message.channel.send('> *Kasih nomor lagu yang mau dihapus ya mz, ku tak bisa membaca pikiranmu.*');
		}

		return musicPlayer.remove(arg.value, message);
	}
}
