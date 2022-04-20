import type { MusicPlayer } from "./MusicPlayer";
import type { Track } from "./Track";

export class MusicCommandCacheManager {
    readonly musicPlayers: Map<string, MusicPlayer>;
    readonly savedQueues: Map<string, Track[]>

    constructor() {
        this.musicPlayers = new Map();
        this.savedQueues = new Map();
    }
}
