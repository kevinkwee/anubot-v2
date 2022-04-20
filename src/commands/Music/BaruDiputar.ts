import { AudioPlayerStatus } from '@discordjs/voice';
import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import { Message, MessageEmbed } from 'discord.js';

import { musicCommandEmbedColor, musicCommandErrorEmbedColor } from '../../lib/commands/Music/constants';
import { getGuildMusicPlayer } from '../../lib/commands/Music/utils';
import { getDefaultPrefix, getDurationStr } from '../../lib/utils';

import type { Track } from '../../lib/commands/Music/Track';
import { RequiresClientInVoiceChannel } from '../../lib/commands/Music/functionPreconditions';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['bd', 'sekarang', 'now', 'nowplaying', 'np', 'currentsong', 'currenttrack', 'current'],
	description: 'Buat lihat lagu yang baru diputar.',
	detailedDescription: getDefaultPrefix() + ' barudiputar',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class BaruDiputarCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	public async messageRun(message: Message) {
		const musicPlayer = getGuildMusicPlayer(message.guildId!)!;

		// No song is playing
		if (musicPlayer.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
			return message.channel.send({
				embeds: [new MessageEmbed()
					.setDescription(`:stop_button: Ngga ada lagu yang baru kuputar mz.`)
					.setColor(musicCommandErrorEmbedColor)
					.setTimestamp()
				]
			});
		}

		// There is a song playing
		const track = musicPlayer.audioPlayer.state.resource.metadata as Track;
		const durationPlayedInSec = Math.floor(musicPlayer.audioPlayer.state.resource.playbackDuration / 1_000);
		const embed = new MessageEmbed()
			.setTitle('Anu Baru Muter Lagu')
			.setDescription(`[${track.title}](${track.url})`)
			.setThumbnail(track.thumbnailUrl)
			.setFooter({
				text: 'Selamat mendengarkan!'
			})
			.setColor(musicCommandEmbedColor)
			.addFields([
				{
					name: 'Durasi',
					value: `\`${getDurationStr(durationPlayedInSec)}/${getDurationStr(track.durationInSec)}\``,
					inline: true
				},
				{
					name: 'Pengunggah',
					value: `[${track.uploader}](${track.uploaderUrl})`,
					inline: true
				},
				{
					name: 'Yang minta',
					value: `<@${track.requesterId}>`,
					inline: true
				}
			])
			.setTimestamp();
		return message.channel.send({ embeds: [embed] });
	}
}
