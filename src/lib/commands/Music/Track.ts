import { createAudioResource } from '@discordjs/voice';
import { container } from '@sapphire/framework';
import { soundcloud, SoundCloudTrack, stream, YouTubeVideo } from 'play-dl';
import playdl from 'play-dl';

export class Track {
    url: string;
    title: string;
    thumbnailUrl: string;
    durationInSec: number;
    uploader: string;
    uploaderUrl: string;
    requesterId: string;

    private constructor({ url, title, thumbnailUrl, durationInSec, uploader, uploaderUrl, requesterId }: TrackProperties) {
        this.url = url;
        this.title = title;
        this.thumbnailUrl = thumbnailUrl;
        this.durationInSec = durationInSec;
        this.uploader = uploader;
        this.uploaderUrl = uploaderUrl;
        this.requesterId = requesterId;
    }

    static async fromYoutube(source: string | YouTubeVideo, requesterId: string) {
        try {
            let ytVideo: YouTubeVideo;

            if (source instanceof YouTubeVideo) {
                ytVideo = source;
            } else {
                const yt_info = await playdl.video_basic_info(source);
                ytVideo = yt_info.video_details;
            }

            const thumnails = ytVideo.thumbnails;

            return new Track({
                url: ytVideo.url,
                title: ytVideo.title ?? '*No Title*',
                thumbnailUrl: thumnails.pop()?.url ?? '*No Url*',
                durationInSec: ytVideo.durationInSec,
                uploader: ytVideo.channel?.name ?? '*No Channel Name*',
                uploaderUrl: ytVideo.channel?.url ?? '*No Channel Url*',
                requesterId: requesterId
            });
        } catch (error) {
            container.client.logger.error(error);
            throw error;
        }
    }

    static async fromSoundcloud(source: string | SoundCloudTrack, requesterId: string) {
        try {
            let scInfo: SoundCloudTrack;

            if (source instanceof SoundCloudTrack) {
                scInfo = source;
            } else {
                scInfo = await soundcloud(source) as SoundCloudTrack;
            }

            return new Track({
                url: scInfo.url,
                title: scInfo.name,
                durationInSec: scInfo.durationInSec,
                thumbnailUrl: scInfo.thumbnail,
                uploader: scInfo.publisher?.artist ?? scInfo.user.full_name ?? '*No Artist*',
                uploaderUrl: scInfo.user.url,
                requesterId: requesterId
            });
        } catch (error) {
            container.client.logger.error(error);
            throw error;
        }
    }

    async createAudioResource() {
        try {
            let trackStream = await stream(this.url);
            return createAudioResource(trackStream.stream, {
                inputType: trackStream.type,
                metadata: this
            });
        } catch (error) {
            container.client.logger.error(error);
            throw error;
        }
    }
}

interface TrackProperties {
    url: string;
    title: string;
    thumbnailUrl: string;
    durationInSec: number;
    uploader: string;
    uploaderUrl: string;
    requesterId: string;
}