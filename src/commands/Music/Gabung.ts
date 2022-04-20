import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import { Message } from 'discord.js';

import { RequiresClientNotInVoiceChannel, RequiresUserInVoiceChannel } from '../../lib/commands/Music/functionPreconditions';
import { MusicMessage } from '../../lib/commands/Music/MusicMessage';
import { createMusicPlayer, sendContinueSavedQueueMessage } from '../../lib/commands/Music/utils';
import { getDefaultPrefix } from '../../lib/utils';

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['g', 'j', 'join', 'sini'],
	description: 'Buat ngajak anu masuk ke vc.',
	detailedDescription: getDefaultPrefix() + ' gabung',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class GabungCommand extends SubCommandPluginCommand {
	@RequiresClientNotInVoiceChannel({
		fallback: (message: Message) => {
			const clientVoiceChannelId = message.guild!.me!.voice.channelId;
			const userVoiceChannelId = message.guild!.voiceStates.cache.get(message.author.id)?.channelId;
			return message.channel.send({
				content: clientVoiceChannelId === userVoiceChannelId
					? MusicMessage.UDAH_GABUNG_LOH
					: MusicMessage.UDAH_SAMA_YANG_LAIN
			});
		}
	})
	@RequiresUserInVoiceChannel()
	public async messageRun(message: Message) {
		const musicPlayer = createMusicPlayer(message);
		await sendContinueSavedQueueMessage(musicPlayer, message);
	}
}
