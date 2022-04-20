import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import { Message, MessageEmbed } from 'discord.js';

import { getDefaultPrefix } from '../../lib/utils';

@ApplyOptions<SubCommandPluginCommandOptions>({
	description: 'Buat cek delay anu 🤖',
	detailedDescription: getDefaultPrefix() + ' ping',
	fullCategory: ['Other']
})
export class PingCommand extends SubCommandPluginCommand {
	public async messageRun(message: Message) {
		const pingLoadingMsg = await message.reply({
			content: 'Ngitung ping bentar ya mz . . . :thinking:',
			failIfNotExists: false
		});

		const embed = new MessageEmbed()
			.setTitle('PONG!! 🏓 HALOO')
			.setColor(65280)
			.setDescription(`:signal_strength: *Bot Latency: ${this.container.client.ws.ping}ms*\n:globe_with_meridians: *API Latency: ${pingLoadingMsg.createdTimestamp - message.createdTimestamp}ms*`)
			.setTimestamp();

		return pingLoadingMsg.edit({
			content: null,
			embeds: [embed]
		});
	}
}
