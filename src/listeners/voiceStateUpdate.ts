import { Listener } from '@sapphire/framework';
import { isNullOrUndefined } from '@sapphire/utilities';

import type { VoiceState } from 'discord.js';

/**
 * Client leaves voice channel when alone.
 */
export class VoiceStateUpdateEvent extends Listener {
    musicPlayerOnAloneTimeout: NodeJS.Timeout | null = null;

    public run(oldState: VoiceState, newState: VoiceState) {
        const clientVoiceChannel = newState.guild.me?.voice.channel;
        if (!isNullOrUndefined(clientVoiceChannel) && (newState.channelId === clientVoiceChannel.id || oldState.channelId === clientVoiceChannel.id)) {
            if (clientVoiceChannel.members.size === 1) {
                this.musicPlayerOnAloneTimeout = setTimeout(() => {
                    this.container.musicCommandCache.musicPlayers.get(clientVoiceChannel.guildId)?.onAlone();
                    this.musicPlayerOnAloneTimeout = null;
                }, 5_000);
            } else {
                if (!isNullOrUndefined(this.musicPlayerOnAloneTimeout)) {
                    clearTimeout(this.musicPlayerOnAloneTimeout);
                    this.musicPlayerOnAloneTimeout = null;
                }
            }
        }
    }
}
