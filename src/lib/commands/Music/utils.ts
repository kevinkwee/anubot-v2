import { joinVoiceChannel } from '@discordjs/voice';
import { container } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import { isNullOrUndefinedOrEmpty } from '@sapphire/utilities';
import { Constants, Message, MessageEmbed } from 'discord.js';
import playdl from 'play-dl';

import { PaginatedComponentMessage } from '../../PaginatedComponentMessage/PaginatedComponentMessage';
import { musicCommandEmbedColor, musicCommandErrorEmbedColor } from './constants';
import { MusicPlayer } from './MusicPlayer';

import type { Track } from "./Track";

/**
 * Gets guild's {@link MusicPlayer} if any.
 * @param guildId The id of the guild to get the @{@link MusicPlayer}
 */
export function getGuildMusicPlayer(guildId: string) {
    return container.musicCommandCache.musicPlayers.get(guildId);
}

/**
 * Creates a {@link MusicPlayer} and join the user voice channel.
 * @param message The {@link Message} command from the user.
 * @returns ```MusicPlayer```
 */
export function createMusicPlayer(message: Message) {
    const userVoiceChannel = message.guild!.voiceStates.cache.get(message.author.id)!.channel!;

    const voiceConnection = joinVoiceChannel({
        channelId: userVoiceChannel.id,
        guildId: userVoiceChannel.guildId,
        adapterCreator: userVoiceChannel.guild.voiceAdapterCreator
    });

    const musicPlayer = new MusicPlayer(
        message.channel,
        message.guild!,
        voiceConnection
    );

    container.musicCommandCache.musicPlayers.set(userVoiceChannel.guildId, musicPlayer);

    return musicPlayer;
}

/**
 * Sends a {@link PaginatedComponentMessage} which will asks
 * the user if they want to continue the saved queue.
 * @param musicPlayer The current {@link MusicPlayer} of the guild.
 * @param message The {@link Message} command from the user.
 */
export async function sendContinueSavedQueueMessage(musicPlayer: MusicPlayer, message: Message) {
    return new Promise<void>((resolve) => {
        const savedQueue = container.musicCommandCache.savedQueues.get(message.guildId ?? '');
        if (isNullOrUndefinedOrEmpty(savedQueue)) return resolve();

        const paginatedComponentMessage = new PaginatedComponentMessage({
            template: new MessageEmbed()
                .setTitle('Playlist Lama')
                .setColor(musicCommandEmbedColor)
                .setTimestamp(),
            lazyLoad: true
        })
            .addActions([
                {
                    customId: 'paginated-component-message.resetSavedQueueButton',
                    type: Constants.MessageComponentTypes.BUTTON,
                    label: 'Ngga',
                    style: 'DANGER',
                    run: ({ handler, collector }) => {
                        const embed = new MessageEmbed()
                            .setTitle('Reset Playlist Lama')
                            .setColor(musicCommandErrorEmbedColor)
                            .setDescription('Playlist yang lama aku hapus ya mz. Ganti sama playlist yang baru. :sparkles:')
                            .setTimestamp();

                        collector.stop();
                        handler.message?.reply({
                            content: null,
                            embeds: [embed],
                            components: []
                        });

                        container.musicCommandCache.savedQueues.delete(message.guildId ?? '');
                        resolve();
                    }
                },
                {
                    customId: 'paginated-component-message.continueSavedQueueButton',
                    type: Constants.MessageComponentTypes.BUTTON,
                    label: 'Lanjut',
                    style: 'SUCCESS',
                    run: async ({ handler, collector }) => {
                        const embed = new MessageEmbed()
                            .setTitle('Lanjutin Playlist Lama')
                            .setColor(musicCommandEmbedColor)
                            .setDescription('Playlist yang lama aku lanjutin ya mz. :sparkles:')
                            .setTimestamp();

                        collector.stop();
                        handler.message?.reply({
                            content: null,
                            embeds: [embed],
                            components: []
                        });

                        const loadingMessage = await message.channel.send('> *Bentar ya mzz...*');
                        musicPlayer.enqueuePlaylist(
                            loadingMessage,
                            {
                                fulfilledTracks: savedQueue,
                                rejectedTrackCount: 0,
                                playlistName: 'Playlist Lama'
                            }
                        );

                        container.musicCommandCache.savedQueues.delete(message.guildId ?? '');
                        resolve();
                    }
                }
            ], 1)
            .setIdle(Time.Minute * 1)
            .setStopPaginatedComponentMessageCustomIds([
                'paginated-component-message.resetSavedQueueButton',
                'paginated-component-message.continueSavedQueueButton'
            ])
            .setOnEnd((reason) => {
                if (reason === 'time') resolve();
            });

        resolvePagesFromQueue(savedQueue, 10, paginatedComponentMessage);

        paginatedComponentMessage.run(message.channel, message.author);
    });
}

function resolvePagesFromQueue(savedQueue: Track[], itemCountPerPage: number, paginatedComponentMessage: PaginatedComponentMessage) {
    const pageCount = Math.ceil(savedQueue.length / itemCountPerPage);

    for (let page = 1; page <= pageCount; page++) {
        const startIndex = itemCountPerPage * page - itemCountPerPage;
        const endIndex = itemCountPerPage * page - 1;
        let description = 'Ini ada daftar lagu dari orang yang terakhir kali ninggalin aku nih mz.\n\n**Antrean:**\n';

        savedQueue.forEach((track, index) => {
            if (index < startIndex || index > endIndex) return;
            description += `${index + 1}. [${track.title}](${track.url})\n`;
        });

        description += '\n***Mau dilanjut ngga mazzeh??***';

        paginatedComponentMessage.addPageEmbed(embed => embed.setDescription(description));
    }
}

export async function refreshSoundcloudClientId() {
    const clientId = await playdl.getFreeClientID();
    return playdl.setToken({
        soundcloud: {
            client_id: clientId
        }
    });
}
