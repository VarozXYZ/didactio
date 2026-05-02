import Heading from "@tiptap/extension-heading";
import {mergeAttributes} from "@tiptap/core";

export const HeadingWithId = Heading.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			id: {
				default: null,
				parseHTML: (element) => element.getAttribute("id"),
				renderHTML: (attributes) =>
					attributes.id ? {id: attributes.id} : {},
			},
		};
	},

	renderHTML({node, HTMLAttributes}) {
		const level = this.options.levels.includes(node.attrs.level) ?
			node.attrs.level
		:	this.options.levels[0];
		return [
			`h${level}`,
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0,
		];
	},
}).configure({levels: [2, 3, 4]});
