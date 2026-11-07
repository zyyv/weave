import { s as isShadowRoot } from "./ui-element-IK2mi4kx.js";

//#region ../utils/dist/dom/tree.js
/** @internal */
function containsComposed(root, element) {
	let current = element;
	while (current) {
		if (current === root || root.contains(current)) return true;
		const nodeRoot = current.getRootNode();
		current = current.assignedSlot ?? current.parentElement ?? (isShadowRoot(nodeRoot) ? nodeRoot.host : null);
	}
	return false;
}

//#endregion
export { containsComposed as t };
//# sourceMappingURL=tree-DznOyPc7.js.map