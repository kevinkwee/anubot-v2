import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import { Message, MessageEmbed } from 'discord.js';

import { musicCommandEmbedColor } from '../../lib/commands/Music/constants';
import {
	RequiresClientInVoiceChannel,
	RequiresUserInClientVoiceChannel,
	RequiresUserInVoiceChannel,
} from '../../lib/commands/Music/functionPreconditions';
import { getGuildMusicPlayer } from '../../lib/commands/Music/utils';
import { getDefaultPrefix } from '../../lib/utils';

import type { Args } from '@sapphire/framework';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['u', 'loop', 'repeat'],
	description: 'Buat ngulang-ngulang lagu atau playlist',
	detailedDescription: getDefaultPrefix() + ' ulang [mati/off/lagu/song/track/t/one/1/a/antrean/playlist/all/queue/q]',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class UlangCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	@RequiresUserInVoiceChannel()
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message, args: Args) {
		const musicPlayer = getGuildMusicPlayer(message.guildId!)!;
		const arg = await args.pickResult('string');

		if (!arg.success) return musicPlayer.loopTrack(message);

		switch (arg.value) {
			case 'lagu':
			case 'song':
			case 'track':
			case 't':
			case 'one':
			case '1':
				musicPlayer.loopTrack(message);
				break;
			case 'a':
			case 'antrean':
			case 'playlist':
			case 'all':
			case 'queue':
			case 'q':
				musicPlayer.loopQueue(message);
				break;
			case 'mati':
			case 'off':
				musicPlayer.loopOff(message);
				break;
			default:
				message.channel.send({
					embeds: [this.createCommandDetailEmbed()]
				});
				break;
		}
	}

	private createCommandDetailEmbed() {
		const embed = new MessageEmbed()
			.setTitle('Command')
			.setDescription('`' + this.name + '`')
			.addField('Deskripsi', '`' + this.description + '`')
			.addField('Cara pake', '`' + this.detailedDescription + '`')
			.setColor(musicCommandEmbedColor);

		if (this.aliases.length >= 1) {
			let fieldValue = '';
			this.aliases.forEach(alias => {
				fieldValue += ', `' + alias + '`';
			});
			fieldValue = fieldValue.slice(2);
			embed.addField('Alias', fieldValue);
		}

		return embed;
	}
}
