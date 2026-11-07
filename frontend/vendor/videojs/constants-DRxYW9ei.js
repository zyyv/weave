//#region ../media/dist/dev/core/constants.js
/**
* A frozen, empty `TimeRanges`-like placeholder for hosts that never report ranges. `isMediaBufferCapable` rejects it,
* so the player stops listening for ranges for good. A host that has no ranges yet returns `NO_TIME_RANGES_YET`.
*
* @internal
*/
const EMPTY_TIME_RANGES = Object.freeze({
	length: 0,
	start: () => 0,
	end: () => 0
});
/**
* A frozen, empty `TimeRanges`-like value for hosts that report ranges but have none yet, such as an embed before it
* loads. Unlike `EMPTY_TIME_RANGES`, `isMediaBufferCapable` accepts it.
*
* @internal
*/
const NO_TIME_RANGES_YET = Object.freeze({
	length: 0,
	start: () => 0,
	end: () => 0
});
/**
* A frozen, empty `TextTrackList`-like value for hosts with no text tracks.
*
* @internal
*/
const EMPTY_TEXT_TRACKS = Object.assign(new EventTarget(), {
	length: 0,
	*[Symbol.iterator]() {},
	getTrackById: () => null
});
/** @internal */
const EMPTY_REMOTE = new EventTarget();

//#endregion
export { NO_TIME_RANGES_YET as i, EMPTY_TEXT_TRACKS as n, EMPTY_TIME_RANGES as r, EMPTY_REMOTE as t };
//# sourceMappingURL=constants-DRxYW9ei.js.map