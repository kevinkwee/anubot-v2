import { AudioPlayerStatus } from '@discordjs/voice';
import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import { Time } from '@sapphire/time-utilities';
import { Message, MessageEmbed } from 'discord.js';

import { musicCommandEmbedColor } from '../../lib/commands/Music/constants';
import { RequiresClientInVoiceChannel } from '../../lib/commands/Music/functionPreconditions';
import { LoopMode, MusicPlayer, ShuffleMode } from '../../lib/commands/Music/MusicPlayer';
import { getGuildMusicPlayer } from '../../lib/commands/Music/utils';
import { PaginatedComponentMessage } from '../../lib/PaginatedComponentMessage/PaginatedComponentMessage';
import { getDefaultPrefix, getDurationStr } from '../../lib/utils';

import type { Track } from '../../lib/commands/Music/Track';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['a', 'queue', 'q', 'playlist'],
	description: 'Buat lihat daftar antrean lagu.',
	detailedDescription: getDefaultPrefix() + ' antrean',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class AntreanCommand extends SubCommandPluginCommand {
	@RequiresClientInVoiceChannel()
	public async messageRun(message: Message) {
		const musicPlayer = getGuildMusicPlayer(message.guildId!)!;
		const paginatedComponentMessage = new PaginatedComponentMessage({
			template: new MessageEmbed()
				.setTitle('Daftar Antrean Anu')
				.setColor(musicCommandEmbedColor)
				.setFields(this.createFields(musicPlayer))
				.setTimestamp(),
			lazyLoad: true
		})
			.addPageEmbeds(this.createPages(musicPlayer))
			.setIdle(Time.Minute * 3);

		return paginatedComponentMessage.run(message.channel, message.author);
	}

	private createPages(musicPlayer: MusicPlayer) {
		const queue = musicPlayer.queue;
		const trackCount = queue.length;

		if (trackCount === 0) {
			return [new MessageEmbed().setDescription('*K O S O N G*')];
		}

		const itemCountPerPage = 10;
		const pageCount = Math.ceil(trackCount / itemCountPerPage);
		const pages: MessageEmbed[] = [];

		for (let page = 1; page <= pageCount; page++) {
			const startIndex = itemCountPerPage * page - itemCountPerPage;
			const endIndex = itemCountPerPage * page - 1;
			let description = '';

			queue.forEach((track, index) => {
				if (index < startIndex || index > endIndex) return;
				description += `${index + 1}. [${track.title}](${track.url})\n`;
			});

			// Remove last new line (\n)
			description = description.slice(0, -1);

			pages.push(new MessageEmbed().setDescription(description));
		}

		return pages;
	}

	private createFields(musicPlayer: MusicPlayer) {
		return [
			this.createNowPlayingField(musicPlayer),
			this.createTotalDurationField(musicPlayer),
			this.createShuffleModeField(musicPlayer),
			this.createLoopModeField(musicPlayer)
		];
	}

	private createNowPlayingField(musicPlayer: MusicPlayer) {
		let value = '-';

		if (musicPlayer.audioPlayer.state.status === AudioPlayerStatus.Playing) {
			const track = musicPlayer.audioPlayer.state.resource.metadata as Track;
			value = `[${track.title}](${track.url})`;
		}

		return {
			name: 'Baru diputar',
			value,
			inline: false
		};
	}

	private createTotalDurationField(musicPlayer: MusicPlayer) {
		const durationInSec = this.getTotalDurationInSec(musicPlayer);
		const durationStr = `\`${getDurationStr(durationInSec)}\``;
		return {
			name: 'Durasi total',
			value: durationStr,
			inline: false
		};
	}

	private createShuffleModeField(musicPlayer: MusicPlayer) {
		return {
			name: 'Mode acak',
			value: musicPlayer.shuffleMode === ShuffleMode.On
				? ':twisted_rightwards_arrows: Hidup'
				: ':regional_indicator_x: Mati',
			inline: true
		};
	}

	private createLoopModeField(musicPlayer: MusicPlayer) {
		let value: string;

		switch (musicPlayer.loopMode) {
			case LoopMode.Track:
				value = ':repeat_one: Satu lagu';
				break;
			case LoopMode.Queue:
				value = ':repeat: Playlist';
				break;
			default:
				value = ':regional_indicator_x: Mati';
				break;
		}

		return {
			name: 'Mode ulang',
			value,
			inline: true
		};
	}

	private getTotalDurationInSec(musicPlayer: MusicPlayer) {
		let durationInsec = 0;
		musicPlayer.queue.forEach((track) => {
			durationInsec += track.durationInSec;
		});
		return durationInsec;
	}
}
