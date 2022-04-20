import { createFunctionPrecondition, FunctionFallback } from '@sapphire/decorators';
import { isNullOrUndefined } from '@sapphire/utilities';
import { MusicMessage } from './MusicMessage';
import type { Message } from "discord.js";

interface FunctionPreconditionOptions {
    errorMessageContent?: string,
    fallback?: FunctionFallback
}

export function RequiresUserInVoiceChannel({
    errorMessageContent,
    fallback
}: FunctionPreconditionOptions = {}) {
    return createFunctionPrecondition(
        (message: Message) => !isNullOrUndefined(message.guild?.voiceStates.cache.get(message.author.id)?.channelId),
        fallback ?? ((message: Message) => message.channel.send(errorMessageContent ?? MusicMessage.KAMU_NGGAK_DI_VC))
    );
}

/**
 * Use this precondition only after 
 * these required preconditions are passed.
 * @requires RequiresClientInVoiceChannel ***passed***
 * @requires RequiresUserInVoiceChannel ***passed***
 */
export function RequiresUserInClientVoiceChannel({
    errorMessageContent,
    fallback
}: FunctionPreconditionOptions = {}) {
    return createFunctionPrecondition(
        (message: Message) => {
            const userVoiceChannelId = message.guild!.voiceStates.cache.get(message.author.id)!.channelId;
            const clientVoiceChannelId = message.guild!.me!.voice.channelId;
            return userVoiceChannelId === clientVoiceChannelId;
        },
        fallback ?? ((message: Message) => message.channel.send(errorMessageContent ?? MusicMessage.KAMU_NGGAK_SE_VC))
    );
}

export function RequiresClientInVoiceChannel({
    errorMessageContent,
    fallback
}: FunctionPreconditionOptions = {}) {
    return createFunctionPrecondition(
        (message: Message) => !isNullOrUndefined(message.guild?.me?.voice.channel),
        fallback ?? ((message: Message) => message.channel.send(errorMessageContent ?? MusicMessage.PFT))
    );
}

export function RequiresClientNotInVoiceChannel({
    errorMessageContent,
    fallback
}: FunctionPreconditionOptions = {}) {
    return createFunctionPrecondition(
        (message: Message) => isNullOrUndefined(message.guild?.me?.voice.channelId),
        fallback ?? ((message: Message) => message.channel.send(errorMessageContent ?? MusicMessage.UDAH_SAMA_YANG_LAIN))
    );
}
