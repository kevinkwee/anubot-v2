import { ApplyOptions } from '@sapphire/decorators';
import { Args, container } from '@sapphire/framework';
import { SubCommandPluginCommand, SubCommandPluginCommandOptions } from '@sapphire/plugin-subcommands';
import playdl, { SoundCloudPlaylist, SoundCloudTrack, SpotifyPlaylist, SpotifyTrack, YouTubeVideo } from 'play-dl';

import {
	RequiresClientInVoiceChannel,
	RequiresUserInClientVoiceChannel,
	RequiresUserInVoiceChannel,
} from '../../lib/commands/Music/functionPreconditions';
import { Track } from '../../lib/commands/Music/Track';
import {
	createMusicPlayer,
	getGuildMusicPlayer,
	refreshSoundcloudClientId,
	sendContinueSavedQueueMessage,
} from '../../lib/commands/Music/utils';
import { getDefaultPrefix } from '../../lib/utils';

import type { Message } from 'discord.js';

type PlaydlSupportedInputUnion = "so_playlist" | "so_track" | "sp_track" | "sp_album" | "sp_playlist" | "dz_track" | "dz_playlist" | "dz_album" | "yt_video" | "yt_playlist" | "search" | false;

interface HandleUserRequestOptions {
	urlOrSearchKeyword: string;
	requesterId: string;
	guildId: string;
	loadingMessage: Message;
}

@ApplyOptions<SubCommandPluginCommandOptions>({
	aliases: ['p', 'play'],
	description: 'Buat minta anu muter lagu. Bisa Spotify, Youtube, dan Soundcloud.',
	detailedDescription: getDefaultPrefix() + ' putar [url/kata kunci pencarian]',
	fullCategory: ['Music'],
	preconditions: ['GuildOnly']
})
export class PutarCommand extends SubCommandPluginCommand {
	@RequiresUserInVoiceChannel()
	@RequiresClientInVoiceChannel({
		fallback: (message, args) => {
			createMusicPlayer(message);
			PutarCommand.handleMessageRun(message, args);
		}
	})
	@RequiresUserInClientVoiceChannel()
	public async messageRun(message: Message, args: Args) {
		return PutarCommand.handleMessageRun(message, args);
	}

	private static async handleMessageRun(message: Message, args: Args) {
		// Check saved queue
		const musicPlayer = getGuildMusicPlayer(message.guildId!)!;
		await sendContinueSavedQueueMessage(musicPlayer, message);

		// Parse user request
		let urlOrSearchKeyword: string | undefined;

		try {
			urlOrSearchKeyword = await this.parseArgs(args);
		} catch {
			return message.channel.send('> *Mau dengerin lagu apa mz.. Kasih link ato keywordnya lahh.*');
		}


		// Process user request
		const loadingMessage = await message.channel.send('> *Bentar ya mzz...*');
		await refreshSoundcloudClientId();
		const validationResult = await playdl.validate(urlOrSearchKeyword);

		try {
			await this.processUserRequest({
				playdlInputType: validationResult,
				handleUserRequestOptions: {
					urlOrSearchKeyword,
					requesterId: message.author.id,
					guildId: message.guildId!,
					loadingMessage
				}
			});
		} catch (error) {
			container.client.logger.error(error);
			return message.channel.send('> *Duhh, maaf ya mz, kliatannya ada eror pas aku buka urlnya. :sob:*');
		}

		return;
	}

	/**
	 * Parse user's argument to url string or search keyword string.
	 * @param args The {@link Args} to parse.
	 * @returns string url or search keyword.
	 * @throws Throws error when the user passed no argument.
	 */
	private static async parseArgs(args: Args) {
		const urlOrSearchKeyword = await args.peek('url')
			.then((value) => value.href)
			.catch(async () => await args.rest('string'));

		return urlOrSearchKeyword.match(/^(?:(https?):\/\/).+(?:&playnext=.*)$/)
			? urlOrSearchKeyword.replaceAll(/&playnext=.*/g, '')
			: urlOrSearchKeyword;
	}

	/**
	 * Try to run a method with a max of 3 attemps.
	 * @param method The method to run.
	 * @param runAttempts The number of attemps with a maximum of 3 attemps.
	 */
	private static async tryToRun<T>(method: () => Promise<T>, runAttempts = 0): Promise<T> {
		try {
			return await method();
		} catch (error) {
			container.client.logger.error(
				error instanceof Error
					? `${error.name}: ${error.message}`
					: error
			);

			// Throw error if max attempt number is reached.
			if (runAttempts >= 2) throw error;

			return this.tryToRun(method, runAttempts + 1);
		}
	}

	/**
	 * Resolve items in a list.
	 * @param unresolvedList The list to resolve.
	 * @returns Fulfilled list and rejected item count.
	 */
	private static async resolveList<T>(unresolvedList: Promise<T>[]) {
		const resolvedList = await Promise.allSettled(unresolvedList);
		const fulfilledItems: T[] = [];
		let rejectedItemCount = 0;

		resolvedList.forEach((resolvedItem) => {
			if (resolvedItem.status === 'fulfilled') {
				fulfilledItems.push(resolvedItem.value);
			} else {
				rejectedItemCount++;
			}
		});

		return { fulfilledItems, rejectedItemCount };
	}

	private static createSearchKeywordFromSpotifyTrack(spTrack: SpotifyTrack) {
		let artists = '';

		spTrack.artists.forEach((artist) => {
			artists += artist.name + ' ';
		});

		return `${artists}${spTrack.name}`;
	}

	private static async processUserRequest(options: {
		playdlInputType: PlaydlSupportedInputUnion,
		handleUserRequestOptions: HandleUserRequestOptions
	}) {
		await this.tryToRun(
			async () => {
				switch (options.playdlInputType) {
					case 'search':
						await this.handleSearch(options.handleUserRequestOptions);
						break;
					case 'yt_video':
						await this.handleYoutubeVideo(options.handleUserRequestOptions);
						break;
					case 'yt_playlist':
						await this.handleYoutubePlaylist(options.handleUserRequestOptions);
						break;
					case 'sp_track':
						await this.handleSpotifyTrack(options.handleUserRequestOptions);
						break;
					case 'sp_album':
					case 'sp_playlist':
						await this.handleSpotifyPlaylist(options.handleUserRequestOptions);
						break;
					case 'so_track':
						await this.handleSoundcloudTrack(options.handleUserRequestOptions);
						break;
					case 'so_playlist':
						await this.handleSoundcloudPlaylist(options.handleUserRequestOptions);
						break;
					default:
						await options.handleUserRequestOptions.loadingMessage.edit('> *Duh, maaf ya mz, aku blm support muter lagu dari url itu. :sob:*');
						break;
				}
			}
		);
	}

	private static async handleSearch(options: HandleUserRequestOptions) {
		const ytVideos = await playdl.search(options.urlOrSearchKeyword, {
			source: { youtube: 'video' },
			limit: 1
		});
		const track = await Track.fromYoutube(ytVideos[0], options.requesterId);
		const musicPlayer = getGuildMusicPlayer(options.guildId)!;
		musicPlayer.enqueue(track, options.loadingMessage);
	}

	private static async handleYoutubeVideo(options: HandleUserRequestOptions) {
		const track = await Track.fromYoutube(options.urlOrSearchKeyword, options.requesterId);
		const musicPlayer = getGuildMusicPlayer(options.guildId)!;
		musicPlayer.enqueue(track, options.loadingMessage);
	}

	private static async handleYoutubePlaylist(options: HandleUserRequestOptions) {
		const unresolvedTracks: Promise<Track>[] = [];
		const ytPlaylist = await playdl.playlist_info(options.urlOrSearchKeyword, {
			incomplete: true
		});
		const allVideos = await ytPlaylist.all_videos();

		allVideos.forEach(async (video) => {
			const unresolvedTrack = this.tryToRun(
				async () => await Track.fromYoutube(video, options.requesterId)
			);
			unresolvedTracks.push(unresolvedTrack);
		});

		const {
			fulfilledItems: fulfilledTracks,
			rejectedItemCount: rejectedTrackCount
		} = await this.resolveList(unresolvedTracks);

		const musicPlayer = getGuildMusicPlayer(options.guildId)!;
		musicPlayer.enqueuePlaylist(
			options.loadingMessage,
			{
				fulfilledTracks,
				rejectedTrackCount,
				playlistName: ytPlaylist.title ?? 'Unknown Playlist'
			}
		);
	}

	private static async handleSoundcloudTrack(options: HandleUserRequestOptions) {
		const track = await Track.fromSoundcloud(options.urlOrSearchKeyword, options.requesterId);
		const musicPlayer = getGuildMusicPlayer(options.guildId)!;
		musicPlayer.enqueue(track, options.loadingMessage);
	}

	private static async handleSoundcloudPlaylist(options: HandleUserRequestOptions) {
		const unresolvedTracks: Promise<Track>[] = [];

		let soPlaylist = await playdl.soundcloud(options.urlOrSearchKeyword) as SoundCloudPlaylist;
		soPlaylist = await soPlaylist.fetch();

		soPlaylist.tracks.forEach((soTrack) => {
			const unresolvedTrack = this.tryToRun(
				async () => await Track.fromSoundcloud(soTrack as SoundCloudTrack, options.requesterId)
			);
			unresolvedTracks.push(unresolvedTrack);
		});

		const {
			fulfilledItems: fulfilledTracks,
			rejectedItemCount: rejectedTrackCount
		} = await this.resolveList(unresolvedTracks);

		const musicPlayer = getGuildMusicPlayer(options.guildId)!;
		musicPlayer.enqueuePlaylist(
			options.loadingMessage,
			{
				fulfilledTracks,
				rejectedTrackCount,
				playlistName: soPlaylist.name
			}
		);
	}

	private static async handleSpotifyTrack(options: HandleUserRequestOptions) {
		if (playdl.is_expired()) {
			await playdl.refreshToken();
		}

		const spTrack = await playdl.spotify(options.urlOrSearchKeyword) as SpotifyTrack;
		const searchKeyword = this.createSearchKeywordFromSpotifyTrack(spTrack);

		await this.handleSearch({
			urlOrSearchKeyword: searchKeyword,
			requesterId: options.requesterId,
			guildId: options.guildId,
			loadingMessage: options.loadingMessage
		});
	}

	private static async handleSpotifyPlaylist(options: HandleUserRequestOptions) {
		if (playdl.is_expired()) {
			await playdl.refreshToken();
		}

		// Get playlist details from spotify
		const spPlaylist = await playdl.spotify(options.urlOrSearchKeyword) as SpotifyPlaylist;
		const allTracks = await spPlaylist.all_tracks();

		const unresolvedSearchResults: Promise<YouTubeVideo[]>[] = [];

		// Search spotify tracks on youtube
		allTracks.forEach((spTrack) => {
			const searchKeyword = this.createSearchKeywordFromSpotifyTrack(spTrack);
			unresolvedSearchResults.push(this.tryToRun(
				async () => await playdl.search(searchKeyword, {
					source: { youtube: 'video' },
					limit: 1
				})
			));
		});

		// Resolve searches
		const { fulfilledItems: fulfilledSearchResults } = await this.resolveList(unresolvedSearchResults);
		const ytVideos = fulfilledSearchResults.flat();

		// Convert YoutubeVideo to Track
		const unresolvedTracks: Promise<Track>[] = [];
		ytVideos.forEach((ytVideo) => {
			const unresolvedTrack = this.tryToRun(
				async () => await Track.fromYoutube(ytVideo, options.requesterId)
			);
			unresolvedTracks.push(unresolvedTrack);
		});

		// Resolve tracks
		const { fulfilledItems: fulfilledTracks } = await this.resolveList(unresolvedTracks);

		// Enqueue playlist
		const musicPlayer = getGuildMusicPlayer(options.guildId)!;
		musicPlayer.enqueuePlaylist(
			options.loadingMessage,
			{
				fulfilledTracks,
				rejectedTrackCount: spPlaylist.tracksCount - fulfilledTracks.length,
				playlistName: spPlaylist.name
			}
		);
	}
}
