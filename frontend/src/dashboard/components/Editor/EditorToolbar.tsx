import type {Editor} from "@tiptap/react";
import {
	Bold,
	Check,
	ChevronDown,
	Code2,
	Heading2,
	Heading3,
	Italic,
	Link2,
	List,
	ListOrdered,
	Redo2,
	RemoveFormatting,
	Type,
	Underline,
	Undo2,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import type {ReactNode} from "react";
import {cn} from "@/lib/utils";

type EditorToolbarProps = {
	activeEditor: Editor | null;
	compact?: boolean;
};

type BlockType = "paragraph" | "h2" | "h3" | "h4" | "code";

const BLOCK_TYPE_OPTIONS: Array<{
	value: BlockType;
	label: string;
	icon?: ReactNode;
}> = [
	{value: "paragraph", label: "Paragraph", icon: <Type size={14} />},
	{value: "h2", label: "Heading 2", icon: <Heading2 size={14} />},
	{value: "h3", label: "Heading 3", icon: <Heading3 size={14} />},
	{value: "h4", label: "Heading 4", icon: <Heading3 size={14} />},
	{value: "code", label: "Code block", icon: <Code2 size={14} />},
];

function ToolbarButton({
	compact = false,
	disabled = false,
	label,
	icon,
	onClick,
}: {
	compact?: boolean;
	disabled?: boolean;
	label: string;
	icon: ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			aria-label={compact ? label : undefined}
			onClick={onClick}
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full border border-transparent text-[12px] font-medium text-[#1D1D1F] transition-all hover:border-[#E3E1DA] hover:bg-[#F7F4EC] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent",
				compact ? "h-8 w-8 px-0" : "h-9 gap-2 px-3",
			)}
		>
			{icon}
			{!compact ? <span>{label}</span> : null}
		</button>
	);
}

function ToolbarDivider({compact = false}: {compact?: boolean}) {
	return (
		<div
			className={cn(
				"mx-0.5 h-6 w-px shrink-0 bg-[#E5DED0]",
				compact ? "block" : "mx-1 hidden sm:block",
			)}
		/>
	);
}

export function EditorToolbar({
	activeEditor,
	compact = false,
}: EditorToolbarProps) {
	const [open, setOpen] = useState(false);
	const toolbarRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!toolbarRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const blockType: BlockType =
		activeEditor?.isActive("codeBlock") ? "code"
		: activeEditor?.isActive("heading", {level: 2}) ? "h2"
		: activeEditor?.isActive("heading", {level: 3}) ? "h3"
		: activeEditor?.isActive("heading", {level: 4}) ? "h4"
		: "paragraph";

	const applyBlockType = (nextType: BlockType) => {
		if (!activeEditor) {
			return;
		}

		if (nextType === "paragraph") {
			activeEditor.chain().focus().setParagraph().run();
		} else if (nextType === "code") {
			activeEditor.chain().focus().toggleCodeBlock().run();
		} else {
			activeEditor
				.chain()
				.focus()
				.toggleHeading({level: Number(nextType.slice(1)) as 2 | 3 | 4})
				.run();
		}

		setOpen(false);
	};

	const toggleLink = () => {
		if (!activeEditor) {
			return;
		}

		const previous = activeEditor.getAttributes("link").href as
			| string
			| undefined;
		const url = window.prompt("Enter link URL", previous ?? "");
		if (url === null) {
			return;
		}

		const trimmed = url.trim();
		if (!trimmed) {
			activeEditor.chain().focus().unsetLink().run();
			return;
		}

		activeEditor.chain().focus().setLink({href: trimmed}).run();
	};

	return (
		<div
			ref={toolbarRef}
			className={cn(
				"flex shrink-0 flex-nowrap items-center",
				compact ? "gap-0.5" : "gap-1.5",
			)}
		>
			<ToolbarButton
				compact={compact}
				disabled={!activeEditor?.can().undo()}
				icon={<Undo2 size={compact ? 14 : 15} />}
				label="Undo"
				onClick={() => activeEditor?.chain().focus().undo().run()}
			/>
			<ToolbarButton
				compact={compact}
				disabled={!activeEditor?.can().redo()}
				icon={<Redo2 size={compact ? 14 : 15} />}
				label="Redo"
				onClick={() => activeEditor?.chain().focus().redo().run()}
			/>

			<ToolbarDivider compact={compact} />

			<div className="relative">
				<button
					type="button"
					disabled={!activeEditor}
					onClick={() => setOpen((current) => !current)}
					className={cn(
						"flex shrink-0 items-center rounded-full border text-[12px] font-medium transition-all disabled:opacity-40",
						compact ? "h-8 gap-1 px-2" : "h-9 gap-2 px-3",
						open ?
							"border-[#D9D1C1] bg-[#F7F4EC] text-[#1D1D1F]"
						:	"border-transparent text-[#1D1D1F] hover:border-[#E3E1DA] hover:bg-[#F7F4EC]",
					)}
				>
					<Type size={compact ? 14 : 15} />
					{!compact ?
						<span>
							{BLOCK_TYPE_OPTIONS.find(
								(option) => option.value === blockType,
							)?.label ?? "Paragraph"}
						</span>
					:	null}
					<ChevronDown
						size={14}
						className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</button>

				{open ? (
					<div className="absolute bottom-[calc(100%+8px)] left-0 z-30 min-w-[180px] rounded-2xl border border-[#E7E1D6] bg-white p-2 shadow-[0_18px_48px_rgba(28,24,18,0.12)]">
						{BLOCK_TYPE_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => applyBlockType(option.value)}
								className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[12px] transition-colors ${
									option.value === blockType ?
										"bg-[#F5F1E7] text-[#1D1D1F]"
									:	"text-[#4B4B52] hover:bg-[#F8F6F1]"
								}`}
							>
								<span className="flex items-center gap-2">
									{option.icon}
									<span>{option.label}</span>
								</span>
								{option.value === blockType ? (
									<Check size={14} className="text-[#2E7D32]" />
								) : null}
							</button>
						))}
					</div>
				) : null}
			</div>

			<ToolbarDivider compact={compact} />

			<ToolbarButton
				compact={compact}
				icon={<Bold size={compact ? 14 : 15} />}
				label="Bold"
				onClick={() => activeEditor?.chain().focus().toggleBold().run()}
			/>
			<ToolbarButton
				compact={compact}
				icon={<Italic size={compact ? 14 : 15} />}
				label="Italic"
				onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
			/>
			<ToolbarButton
				compact={compact}
				icon={<Underline size={compact ? 14 : 15} />}
				label="Underline"
				onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
			/>
			<ToolbarButton
				compact={compact}
				icon={<Link2 size={compact ? 14 : 15} />}
				label="Link"
				onClick={toggleLink}
			/>
			<ToolbarButton
				compact={compact}
				icon={<List size={compact ? 14 : 15} />}
				label="Bullets"
				onClick={() => activeEditor?.chain().focus().toggleBulletList().run()}
			/>
			<ToolbarButton
				compact={compact}
				icon={<ListOrdered size={compact ? 14 : 15} />}
				label="Numbered"
				onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()}
			/>
			<ToolbarButton
				compact={compact}
				icon={<Code2 size={compact ? 14 : 15} />}
				label="Code"
				onClick={() => activeEditor?.chain().focus().toggleCodeBlock().run()}
			/>
			<ToolbarButton
				compact={compact}
				icon={<RemoveFormatting size={compact ? 14 : 15} />}
				label="Clear"
				onClick={() =>
					activeEditor?.chain().focus().unsetAllMarks().clearNodes().run()
				}
			/>
		</div>
	);
}
