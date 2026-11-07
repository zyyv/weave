import { c as isObject, d as isString } from "./predicate-3rF1m2uv.js";
import { n as getRegisteredMedia } from "./registered-media-Xx5cjTln.js";
import { t as HTMLMediaAdapter } from "./html-media-adapter-DxrqvGBv.js";

//#region ../media/dist/dev/dom/utils/media-target.js
/**
* The media adapter behind a media the player resolved: the adapter itself, or the one a media component such as
* `<mux-video>` exposes as `adapter`. `null` for a plain `<video>` / `<audio>` or an unrelated media implementation.
*
* @internal
*/
function getMediaAdapter(media) {
	media = getRegisteredMedia(media);
	if (media instanceof HTMLMediaAdapter) return media;
	const adapter = isObject(media) ? media.adapter : null;
	return adapter instanceof HTMLMediaAdapter ? adapter : null;
}
/**
* The name of the engine playing a media the player resolved, such as `hlsjs`, `spf`, or `youtube`. An adapter's
* instance `engineName` wins over the static one its class declares, and a plain `<video>` / `<audio>` is played by the
* `browser`. A media component is read through the adapter it exposes as `adapter`, embeds included.
*
* @returns `undefined` when the media names no engine.
* @internal
*/
function getMediaEngineName(media) {
	media = getRegisteredMedia(media);
	if (media instanceof HTMLMediaElement) return "browser";
	if (!isObject(media)) return void 0;
	const adapter = "adapter" in media && isObject(media.adapter) ? media.adapter : media;
	const instanceName = adapter.engineName;
	if (isString(instanceName)) return instanceName;
	const staticName = adapter.constructor?.engineName;
	return isString(staticName) ? staticName : void 0;
}
/**
* The native element behind a media the player resolved: the element itself, or the one a media component or adapter
* fronts as `target`. `null` when the media is not backed by an `HTMLMediaElement` (an embed, for example).
*
* @internal
*/
function getMediaElement(media) {
	media = getRegisteredMedia(media);
	if (media instanceof HTMLMediaElement) return media;
	const target = isObject(media) ? media.target : null;
	return target instanceof HTMLMediaElement ? target : null;
}

//#endregion
export { getMediaElement as n, getMediaEngineName as r, getMediaAdapter as t };
//# sourceMappingURL=media-target-DFTMiFGP.js.map