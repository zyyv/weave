import { t as safeDefine } from "./safe-define-THEasJ9B.js";
import { a as liveVideoFeatures, t as createPlayer } from "./create-player-2LyRPy7L.js";

//#region ../html/dist/dev/presets/live-video/player.js
const { PlayerElement, PlayerController: LiveVideoPlayerController } = createPlayer({ features: liveVideoFeatures });
var LiveVideoPlayerElement = class extends PlayerElement {
	static {
		this.tagName = "live-video-player";
	}
};

//#endregion
//#region ../html/dist/dev/define/live-video/player.js
safeDefine(LiveVideoPlayerElement);

//#endregion
//# sourceMappingURL=player-C9qdlI67.js.map