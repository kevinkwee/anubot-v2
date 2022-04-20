import { ApplyOptions } from '@sapphire/decorators';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import { Message, MessageEmbed } from 'discord.js';

import { getDefaultPrefix } from '../../lib/utils';

import type { Args, Command } from '@sapphire/framework';


@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['h', 'tolong', 'commands'],
	description: 'Kalo gapaham bisa buka ini',
	detailedDescription: getDefaultPrefix() + ' help',
	fullCategory: ['Other']
})
export class HelpCommand extends SubCommandPluginCommand {
	public async messageRun(message: Message, args: Args) {
		const commandStore = this.container.stores.get('commands');
		const commandNameArg = args.finished ? undefined : await args.pickResult('string');
		let embed: MessageEmbed | undefined;

		if (commandNameArg && commandNameArg.success) {
			const command = commandStore.get(commandNameArg.value!);

			if (command) {
				embed = this.createCommandDetailEmbed(command);
			}
		}

		if (!embed) {
			embed = this.createCommandListEmbed();
		}

		return message.channel.send({
			embeds: [embed]
		});
	}

	private createCommandDetailEmbed(command: Command) {
		const embed = new MessageEmbed()
			.setTitle('Command')
			.setDescription('`' + command.name + '`')
			.addField('Deskripsi', '`' + command.description + '`')
			.addField('Cara pake', '`' + command.detailedDescription + '`')
			.setColor(10717951);

		if (command.aliases.length >= 1) {
			let fieldValue = '';
			command.aliases.forEach(alias => {
				fieldValue += ', `' + alias + '`';
			});
			fieldValue = fieldValue.slice(2);
			embed.addField('Alias', fieldValue);
		}

		return embed;
	}

	private createCommandListEmbed() {
		const commandStore = this.container.stores.get('commands');
		const embed = new MessageEmbed()
			.setTitle('Buat yg Blom Tau atau Lupa')
			.setDescription('--------------------')
			.setFooter({
				text: 'Buat liat detail: anu help <command>'
			})
			.setColor(10717951);

		commandStore.categories.forEach(category => {
			let fieldValue = '';

			commandStore.forEach(command => {
				if (category === command.category) {
					fieldValue += ', `' + command.name + '`';
				}
			});

			fieldValue = fieldValue.slice(2);

			if (!fieldValue) {
				fieldValue = '-';
			}

			embed.addField(
				category,
				fieldValue
			);
		});

		return embed;
	}
}
