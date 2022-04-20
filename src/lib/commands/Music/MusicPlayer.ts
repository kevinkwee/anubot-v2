import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    entersState,
    VoiceConnection,
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import { container } from '@sapphire/framework';
import { isNullOrUndefined, isNullOrUndefinedOrEmpty } from '@sapphire/utilities';
import { Guild, Message, MessageEmbed, TextBasedChannel } from 'discord.js';
import { promisify } from 'util';

import { getCurrentTimeStr, getDurationStr } from '../../utils';
import { musicCommandEmbedColor, musicCommandErrorEmbedColor } from './constants';

import type { Track } from "./Track";

const wait = promisify(setTimeout);

export class MusicPlayer {
    voiceConnection: VoiceConnection;
    audioPlayer: AudioPlayer;
    queue: Track[];
    lastPlayerMessage: Message | null;
    boundGuild: Guild;
    boundTextChannel: TextBasedChannel;
    loopMode: LoopMode;
    shuffleMode: ShuffleMode;
    loopedTrack: Track | null;
    loopedQueue: Track[];

    queueLock = false;
    readyLock = false;
    isLeaving = false;

    constructor(boundTextChannel: TextBasedChannel, boundGuild: Guild, voiceConnection: VoiceConnection) {
        this.voiceConnection = voiceConnection;
        this.audioPlayer = createAudioPlayer();
        this.queue = [];
        this.loopMode = LoopMode.Off;
        this.shuffleMode = ShuffleMode.Off;
        this.boundGuild = boundGuild;
        this.boundTextChannel = boundTextChannel;
        this.lastPlayerMessage = null;
        this.loopedTrack = null;
        this.loopedQueue = [];

        this.voiceConnection.on<'stateChange'>('stateChange', async (_, newState) => {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    try {
                        await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000);
                    } catch {
                        this.voiceConnection.destroy();
                    }
                } else if (this.voiceConnection.rejoinAttempts < 5) {
                    await wait((this.voiceConnection.rejoinAttempts + 1) * 5_000);
                    this.voiceConnection.rejoin();
                } else {
                    this.voiceConnection.destroy();
                }
            } else if (newState.status === VoiceConnectionStatus.Destroyed) {
                this.stop();
                container.musicCommandCache.musicPlayers.delete(boundGuild.id);
            } else if (!this.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)) {
                this.readyLock = true;
                try {
                    await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 10_000);
                    container.musicCommandCache.musicPlayers.set(boundGuild.id, this);
                    const embed = new MessageEmbed()
                        .setDescription(`Anu udah join <#${this.voiceConnection.joinConfig.channelId}> nihh. :relaxed:\nAnu bakal kirim info di <#${this.boundTextChannel.id}> yaa. :call_me:`)
                        .setColor(musicCommandEmbedColor)
                        .setTimestamp();
                    this.boundTextChannel.send({ embeds: [embed] });
                    this.voiceConnection.subscribe(this.audioPlayer);
                } catch (error) {
                    if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
                } finally {
                    this.readyLock = false;
                }
            }
        });

        this.audioPlayer.on<'stateChange'>('stateChange', (oldState, newState) => {
            if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
                this.onFinish();
            } else if (oldState.status !== AudioPlayerStatus.AutoPaused && newState.status === AudioPlayerStatus.Playing) {
                this.onStart(newState.resource.metadata as Track);
            }
        });

        this.audioPlayer.on<'error'>('error', (error) => {
            this.onError(error, error.resource.metadata as Track);
        });
    }

    private lockQueue() {
        this.queueLock = true;
    }

    private unlockQueue() {
        this.queueLock = false;
    }

    private stop() {
        if (this.queueLock) {
            setImmediate(() => {
                this.stop();
            });
            return;
        }

        this.lockQueue();
        this.queue = [];
        this.audioPlayer.stop(true);
        this.unlockQueue();
    }

    private async processQueue(isSkipping = false): Promise<void> {
        if ((this.audioPlayer.state.status !== AudioPlayerStatus.Idle && !isSkipping)
            || isNullOrUndefinedOrEmpty(this.queue)) {
            if (this.queueLock) {
                setImmediate(() => {
                    this.processQueue(isSkipping);
                });
            }
            return;
        }

        this.lockQueue();

        let nextTrack: Track;

        if (this.loopMode === LoopMode.Track) {
            if (isSkipping) {
                nextTrack = this.shiftQueueByShuffleMode();
                this.loopedTrack = nextTrack;
            } else {
                nextTrack = this.loopedTrack!;
            }
        } else {
            nextTrack = this.shiftQueueByShuffleMode();
            if (this.loopMode === LoopMode.Queue) {
                this.loopedQueue.push(nextTrack);
            }
        }

        try {
            const audioResource = await nextTrack.createAudioResource();
            this.audioPlayer.play(audioResource);
            this.unlockQueue();
        } catch (error) {
            this.onError(error as Error, nextTrack);
            this.unlockQueue();
            return this.processQueue(isSkipping);
        }
    }

    private shiftQueueByShuffleMode() {
        let nextTrack: Track;
        if (this.shuffleMode === ShuffleMode.On) {
            const randomIndex = Math.floor(Math.random() * this.queue.length);
            nextTrack = this.queue[randomIndex];
            this.queue = this.queue.filter((track, index) => {
                if (index == randomIndex) return;
                return track;
            });
        } else {
            nextTrack = this.queue.shift()!;
        }
        return nextTrack;
    }

    private async onStart(audioResourceMetadata: Track) {
        const embed = new MessageEmbed()
            .setTitle('Anu Baru Muter Lagu')
            .setDescription(`[${audioResourceMetadata.title}](${audioResourceMetadata.url})`)
            .setFooter({
                text: 'Selamat mendengarkan!'
            })
            .setThumbnail(audioResourceMetadata.thumbnailUrl)
            .addFields([
                {
                    name: 'Durasi',
                    value: `\`${getDurationStr(audioResourceMetadata.durationInSec)}\``,
                    inline: true
                },
                {
                    name: 'Pengunggah',
                    value: `[${audioResourceMetadata.uploader}](${audioResourceMetadata.uploaderUrl})`,
                    inline: true
                },
                {
                    name: 'Yang minta',
                    value: `<@${audioResourceMetadata.requesterId}>`,
                    inline: true
                }
            ])
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        this.lastPlayerMessage = await this.boundTextChannel.send({ embeds: [embed] });
    }

    private onFinish() {
        if (!isNullOrUndefined(this.lastPlayerMessage)) {
            this.lastPlayerMessage.delete();
            this.lastPlayerMessage = null;
        }

        if (isNullOrUndefinedOrEmpty(this.queue) && !this.isLeaving) {
            if (this.loopMode === LoopMode.Off) {
                const embed = new MessageEmbed()
                    .setDescription(`:eject: Playlistnya uda habis mz.`)
                    .setColor(musicCommandEmbedColor)
                    .setTimestamp();
                this.boundTextChannel.send({ embeds: [embed] });
                return;
            }

            if (this.loopMode === LoopMode.Queue) {
                this.queue = this.loopedQueue;
                this.loopedQueue = [];
            }
        }

        this.processQueue();
    }

    private onError(error: Error, audioResourceMetadata: Track) {
        container.client.logger.info('[' + getCurrentTimeStr() + '] ERROR WHEN PLAYING ' + audioResourceMetadata.title);
        container.client.logger.error(error);
        const embed = new MessageEmbed()
            .setDescription(`:x: Duhh, ada eror pas muter \`${audioResourceMetadata.title}\` nihh.`)
            .setColor(musicCommandErrorEmbedColor)
            .setTimestamp();
        this.boundTextChannel.send({ embeds: [embed] });
    }

    onAlone() {
        this.isLeaving = true;
        this.lockQueue();
        if (this.loopMode === LoopMode.Queue) {
            this.queue.push(...this.loopedQueue);
        }
        container.musicCommandCache.savedQueues.set(this.boundGuild.id, this.queue);
        this.unlockQueue();

        this.voiceConnection.destroy();

        const embed = new MessageEmbed()
            .setDescription(`Ishh aku ditinggal sendiri :unamused:\nDahlah, aku juga keluar dari <#${this.voiceConnection.joinConfig.channelId}>.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        this.boundTextChannel.send({ embeds: [embed] });
    }

    enqueue(track: Track, loadingMessage: Message) {
        if (this.queueLock) {
            setImmediate(() => {
                this.enqueue(track, loadingMessage);
            });
            return;
        }

        this.lockQueue();
        this.queue.push(track);
        this.unlockQueue();

        const embed = new MessageEmbed()
            .setDescription(`:dvd: Yeay, kuberhasil masukin lagu \`${track.title}\` ke playlist. Durasi lagunya \`${getDurationStr(track.durationInSec)}\`.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();

        loadingMessage.edit({
            content: null,
            embeds: [embed]
        });

        this.processQueue();
    }

    enqueuePlaylist(
        loadingMessage: Message,
        queuedPlaylist: { fulfilledTracks: Track[], rejectedTrackCount: number, playlistName: string }
    ) {
        if (this.queueLock) {
            setImmediate(() => {
                this.enqueuePlaylist(loadingMessage, queuedPlaylist);
            });
            return;
        }

        this.lockQueue();
        this.queue.push(...queuedPlaylist.fulfilledTracks);
        this.unlockQueue();

        let description: string;
        let durationInSec = 0;

        queuedPlaylist.fulfilledTracks.forEach((track) => {
            durationInSec += track.durationInSec;
        });

        if (queuedPlaylist.rejectedTrackCount == 0) {
            description = `:dvd: Yeay, kuberhasil masukin \`${queuedPlaylist.fulfilledTracks.length} lagu\` dari playlist \`${queuedPlaylist.playlistName}\`. Durasi totalnya \`${getDurationStr(durationInSec)}\`.`;
        } else {
            description = `:dvd: Yahh, kuhanya bisa masukin \`${queuedPlaylist.fulfilledTracks.length} lagu\` dari playlist \`${queuedPlaylist.playlistName}\`. Ada ${queuedPlaylist.rejectedTrackCount} lagu yang eror. :sob: Jadi durasi totalnya tinggal \`${getDurationStr(durationInSec)}\`.`;
        }

        const embed = new MessageEmbed()
            .setDescription(description)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();

        loadingMessage.edit({
            content: null,
            embeds: [embed]
        });

        this.processQueue();
    }

    skip(userMessage: Message) {
        if (this.queueLock) {
            setImmediate(() => {
                this.skip(userMessage);
            });
            return;
        }

        this.lockQueue();

        if (isNullOrUndefinedOrEmpty(this.queue) && this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            this.unlockQueue();
            const embed = new MessageEmbed()
                .setDescription(`:x: Playlistnya uda kosong <@${userMessage.author.id}>, dan baru ga muter lagu, apa yg mau diskip cobaa...`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }

        const embed = new MessageEmbed()
            .setDescription(`:track_next: Okay <@${userMessage.author.id}>, lagunya aku skip yaa.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });

        if (isNullOrUndefinedOrEmpty(this.queue)) {
            this.unlockQueue();
            this.stop();
        }

        this.unlockQueue();
        this.processQueue(true);
    }

    clear(userMessage: Message) {
        if (this.audioPlayer.state.status === AudioPlayerStatus.Idle && isNullOrUndefinedOrEmpty(this.queue)) {
            const embed = new MessageEmbed()
                .setDescription(`:x: Mz sadar mz, playlist uda bersih, pun ga da lagu yang baru diputar...`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }

        this.stop();

        const embed = new MessageEmbed()
            .setDescription(`:stop_button: Ok mz, udah kuhapus semua kenangan masa lalumu... Ehh, ngga, maksudnya playlist lagunya. :sweat_smile:`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    leave(userMessage: Message) {
        this.isLeaving = true;
        this.voiceConnection.destroy();
        const embed = new MessageEmbed()
            .setDescription(`Dadaahh et <#${this.voiceConnection.joinConfig.channelId}>. Anu pergi yaaa... :wave:`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    loopTrack(userMessage: Message) {
        if (this.queueLock) {
            setImmediate(() => {
                this.loopTrack(userMessage);
            });
            return;
        }

        if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            const embed = new MessageEmbed()
                .setDescription(`:x: Ngga ada lagu yang diputer mz, apa yang mo diulang...`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }

        if (this.loopMode === LoopMode.Track) {
            const embed = new MessageEmbed()
                .setDescription(`:x: Lagu yang sekarang dimainkan uda di mode ulang mz...`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }

        this.lockQueue();
        if (this.loopMode === LoopMode.Queue) {
            this.queue.push(...this.loopedQueue);
            this.loopedQueue = [];
        }
        this.loopMode = LoopMode.Track;
        this.loopedTrack = this.audioPlayer.state.resource.metadata as Track;
        this.unlockQueue();

        const embed = new MessageEmbed()
            .setDescription(`:repeat_one: Lagu \`${this.loopedTrack.title}\` bakal kuulang-ulang ya mz.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    loopQueue(userMessage: Message) {
        if (this.queueLock) {
            setImmediate(() => {
                this.loopQueue(userMessage);
            });
            return;
        }

        this.lockQueue();

        if (isNullOrUndefinedOrEmpty(this.queue) && this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
            this.unlockQueue();
            const embed = new MessageEmbed()
                .setDescription(`:x: Playlistnya kosong mz, pun baru ga muter lagu, apa yang mo diulang coba...`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }

        if (this.loopMode === LoopMode.Queue) {
            this.unlockQueue();
            const embed = new MessageEmbed()
                .setDescription(`:x: Mode ulang playlist uda hidup mz.`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }

        if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
            const nowPlaying = this.audioPlayer.state.resource.metadata as Track;
            this.loopedQueue.push(nowPlaying);
        }

        if (this.loopMode === LoopMode.Track) {
            this.loopedTrack = null;
        }

        this.unlockQueue();
        this.loopMode = LoopMode.Queue;

        const embed = new MessageEmbed()
            .setDescription(`:repeat: Okay, playlistnya bakal aku ulang-ulang ya.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    loopOff(userMessage: Message) {
        if (this.queueLock) {
            setImmediate(() => {
                this.loopOff(userMessage);
            });
            return;
        }

        this.lockQueue();

        switch (this.loopMode) {
            case LoopMode.Track:
                this.loopedTrack = null;
                break;
            case LoopMode.Queue:
                this.queue.push(...this.loopedQueue);
                this.loopedQueue = [];
                break;
            default:
                const embed = new MessageEmbed()
                    .setDescription(`:x: Mode ulang ga nyala mz dari tadi...`)
                    .setColor(musicCommandErrorEmbedColor)
                    .setTimestamp();
                userMessage.channel.send({ embeds: [embed] });
                return;
        }

        this.unlockQueue();
        this.loopMode = LoopMode.Off;

        const embed = new MessageEmbed()
            .setDescription(`:negative_squared_cross_mark: Okay, mode ulang aku matiin yaa.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    turnOnShuffle(userMessage: Message) {
        if (this.shuffleMode === ShuffleMode.On) {
            const embed = new MessageEmbed()
                .setDescription(`:x: Ishh, mode acak udah hidup lhoo... :unamused:`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }
        this.shuffleMode = ShuffleMode.On;
        const embed = new MessageEmbed()
            .setDescription(`:twisted_rightwards_arrows: Ok mz, urutan lagunya kuacak-acak ya.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    turnOffShuffle(userMessage: Message) {
        if (this.shuffleMode === ShuffleMode.Off) {
            const embed = new MessageEmbed()
                .setDescription(`:x: Ishh, mode acak udah ga nyala lhoo... :unamused:`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
            userMessage.channel.send({ embeds: [embed] });
            return;
        }
        this.shuffleMode = ShuffleMode.Off;
        const embed = new MessageEmbed()
            .setDescription(`:negative_squared_cross_mark: Ok mz, urutan lagunya udah ngga acak lagi ya.`)
            .setColor(musicCommandEmbedColor)
            .setTimestamp();
        userMessage.channel.send({ embeds: [embed] });
    }

    remove(songNumber: number, userMessage: Message) {
        if (this.queueLock) {
            setImmediate(() => {
                this.remove(songNumber, userMessage);
            });
            return;
        }

        this.lockQueue();

        let embed: MessageEmbed;

        if (songNumber > this.queue.length || songNumber < 1) {
            embed = new MessageEmbed()
                .setDescription(`:x: Ngga ada lagu nomor \`${songNumber}\` mz.`)
                .setColor(musicCommandErrorEmbedColor)
                .setTimestamp();
        } else {
            let deletedTrack: Track;
            this.queue = this.queue.filter((track, index) => {
                if ((songNumber - 1) == index) {
                    deletedTrack = track;
                    return;
                }
                return track;
            });
            embed = new MessageEmbed()
                .setDescription(`:wastebasket: Lagu \`${deletedTrack!.title}\` udah kuhapus ya mz.`)
                .setColor(musicCommandEmbedColor)
                .setTimestamp();
        }

        this.unlockQueue();

        userMessage.channel.send({ embeds: [embed] });
    }
}

export enum LoopMode {
    Off = 'off',
    Track = 'track',
    Queue = 'queue'
}

export enum ShuffleMode {
    Off,
    On
}
