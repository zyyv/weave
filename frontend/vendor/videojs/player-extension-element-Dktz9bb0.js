import { t as ContextConsumer } from "./context-BVVXMx3G.js";
import { t as UIElement } from "./ui-element-IK2mi4kx.js";
import { n as extensionContext } from "./context-CL8SSE10.js";

//#region ../html/dist/dev/extensions/player-extension-element.js
/**
* Abstract base for elements that register a player extension (e.g. Mux Data, Google Cast) with the surrounding player.
*
* Place anywhere inside a player. The extension is registered when the element connects, follows the player's media
* (plain `<video>` / `<audio>` included) through the player itself, is released when this element disconnects, and is
* destroyed with this element.
*/
var PlayerExtensionElement = class extends UIElement {
	#extension = null;
	#register = null;
	#release = null;
	/** The player extension instance registered with the player. */
	get extension() {
		return this.#getExtension();
	}
	constructor() {
		super();
		new ContextConsumer(this, {
			context: extensionContext,
			subscribe: true,
			callback: (value) => this.#setRegister(value.registerExtension)
		});
	}
	disconnectedCallback() {
		this.#setRegister(null);
		super.disconnectedCallback();
	}
	destroyCallback() {
		this.#setRegister(null);
		this.#extension?.destroy?.();
		super.destroyCallback();
	}
	#setRegister(register) {
		if (this.#register === register) return;
		this.#release?.();
		this.#release = null;
		this.#register = register;
		if (register) this.#release = register(this.#getExtension());
	}
	#getExtension() {
		return this.#extension ??= this.createExtension();
	}
};

//#endregion
export { PlayerExtensionElement as t };
//# sourceMappingURL=player-extension-element-Dktz9bb0.js.map