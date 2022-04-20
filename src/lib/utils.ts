import { container } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { Message, MessageEmbed } from 'discord.js';

import { RandomLoadingMessage } from './constants';

/**
 * Picks a random item from an array
 * @param array The array to pick a random item from
 * @example
 * const randomEntry = pickRandom([1, 2, 3, 4]) // 1
 */
export function pickRandom<T>(array: readonly T[]): T {
	const { length } = array;
	return array[Math.floor(Math.random() * length)];
}

/**
 * Sends a loading message to the current channel
 * @param message The message data for which to send the loading message
 */
export function sendLoadingMessage(message: Message): Promise<typeof message> {
	return send(message, { embeds: [new MessageEmbed().setDescription(pickRandom(RandomLoadingMessage)).setColor('#FF0000')] });
}

export function getDefaultPrefix() {
	return container.client.options.defaultPrefix as string || '<@' + container.client.options.id + '>';
}

export function getCurrentTimeStr() {
	return (new Date()).toLocaleString();
}

export function getDurationStr(seconds_num: number) {
	let hours: string | number = Math.floor(seconds_num / 3600);
	let minutes: string | number = Math.floor((seconds_num - hours * 3600) / 60);
	let seconds: string | number = seconds_num - (hours * 3600) - (minutes * 60);
	let hasHour = true;

	if (hours == 0) {
		hasHour = false;
	}

	if (hours < 10) {
		hours = '0' + hours;
	}

	if (minutes < 10) {
		minutes = '0' + minutes;
	}

	if (seconds < 10) {
		seconds = '0' + seconds;
	}

	if (hasHour) {
		return `${hours}:${minutes}:${seconds}`;
	}

	return `${minutes}:${seconds}`;
}
