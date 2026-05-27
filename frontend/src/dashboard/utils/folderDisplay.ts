import {
	Atom,
	Binary,
	BookOpen,
	Calculator,
	FlaskConical,
	Folder,
	Globe,
	Landmark,
	Microscope,
	Palette,
	PenLine,
	ScrollText,
	type LucideIcon,
} from "lucide-react";

const folderIconMap: Record<string, LucideIcon> = {
	atom: Atom,
	binary: Binary,
	"book-open": BookOpen,
	calculator: Calculator,
	"flask-conical": FlaskConical,
	folder: Folder,
	globe: Globe,
	landmark: Landmark,
	microscope: Microscope,
	palette: Palette,
	"pen-line": PenLine,
	"scroll-text": ScrollText,
};

function clampColorChannel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(
	color: string,
): {red: number; green: number; blue: number} | null {
	const normalized = color.trim().replace("#", "");

	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
		return null;
	}

	return {
		red: Number.parseInt(normalized.slice(0, 2), 16),
		green: Number.parseInt(normalized.slice(2, 4), 16),
		blue: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

function toRgba(color: string, alpha: number): string {
	const rgb = hexToRgb(color);

	if (!rgb) {
		return color;
	}

	return `rgba(${clampColorChannel(rgb.red)}, ${clampColorChannel(rgb.green)}, ${clampColorChannel(rgb.blue)}, ${alpha})`;
}

export function getFolderIcon(iconName: string): LucideIcon {
	return folderIconMap[iconName] ?? Folder;
}

export function getFolderVisuals(folder: {color: string; icon: string}) {
	return {
		accentColor: folder.color,
		bgColor: toRgba(folder.color, 0.16),
		iconColor: folder.color,
		icon: getFolderIcon(folder.icon),
	};
}

const folderEmojiMap: Record<string, string> = {
	atom: "\u269b\ufe0f",
	binary: "\ud83d\udcbb",
	"book-open": "\ud83d\udcda",
	calculator: "\ud83d\udcd0",
	"flask-conical": "\ud83e\uddea",
	folder: "\ud83d\udcc1",
	globe: "\ud83c\udf0d",
	landmark: "\ud83c\udfdb\ufe0f",
	microscope: "\ud83d\udd2c",
	palette: "\ud83c\udfa8",
	"pen-line": "\u270d\ufe0f",
	"scroll-text": "\ud83d\udcdc",
};

export function getFolderEmoji(iconName: string): string {
	return folderEmojiMap[iconName] ?? "\ud83d\udcc1";
}
