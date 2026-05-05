import parse, {
	Element,
	domToReact,
	type DOMNode,
	type HTMLReactParserOptions,
} from "html-react-parser";
import {Children, type CSSProperties, type ReactNode} from "react";
import {motion as Motion, useReducedMotion} from "motion/react";
import type {StylePresetId} from "../../utils/typography";
import {CodeBlock} from "./CodeBlock";

type ChapterRendererProps = {
	html: string;
	className?: string;
	style?: CSSProperties;
	animateBlocks?: boolean;
	animationSeed?: string;
	stylePreset?: StylePresetId;
};

function getText(node: DOMNode): string {
	if ("data" in node && typeof node.data === "string") {
		return node.data;
	}

	if ("children" in node && Array.isArray(node.children)) {
		return node.children.map((child) => getText(child as DOMNode)).join("");
	}

	return "";
}

function getLanguage(className: string | undefined): string | undefined {
	return className?.match(/\blanguage-([a-z0-9+#-]+)/)?.[1];
}

function stableChildKey(child: ReactNode, index: number, seed: string): string {
	if (
		typeof child === "object" &&
		child !== null &&
		"key" in child &&
		child.key !== null
	) {
		return `${seed}:${String(child.key)}`;
	}

	return `${seed}:${index}`;
}

export function ChapterRenderer({
	html,
	className,
	style,
	animateBlocks = false,
	animationSeed = "chapter",
	stylePreset = "classic",
}: ChapterRendererProps) {
	const prefersReducedMotion = useReducedMotion();
	const options: HTMLReactParserOptions = {
		replace(node) {
			if (!(node instanceof Element)) {
				return undefined;
			}

			if (node.name === "pre") {
				const codeChild = node.children.find(
					(child): child is Element =>
						child instanceof Element && child.name === "code",
				);
				const language = getLanguage(codeChild?.attribs.class);
				const continuation =
					node.attribs["data-code-continuation"] === "continued" ?
						"continued"
					: node.attribs["data-code-continues-next"] === "true" ?
						"continues-next"
					:	undefined;
				return (
					<CodeBlock
						code={getText(codeChild ?? node)}
						language={language}
						continuation={continuation}
						stylePreset={stylePreset}
					/>
				);
			}

			if (node.name === "a") {
				return (
					<a {...node.attribs}>
						{domToReact(node.children as DOMNode[], options)}
					</a>
				);
			}

			return undefined;
		},
	};
	const content = parse(html, options);
	const shouldAnimate = animateBlocks && !prefersReducedMotion;

	return (
		<div className={className} style={style}>
			{shouldAnimate ?
				Children.toArray(content).map((child, index) => (
					<Motion.div
						key={stableChildKey(child, index, animationSeed)}
						initial={{opacity: 0, y: 10, filter: "blur(3px)"}}
						animate={{opacity: 1, y: 0, filter: "blur(0px)"}}
						transition={{
							duration: 0.36,
							ease: [0.22, 1, 0.36, 1],
							delay: Math.min(index * 0.035, 0.18),
						}}
					>
						{child}
					</Motion.div>
				))
			:	content}
		</div>
	);
}
