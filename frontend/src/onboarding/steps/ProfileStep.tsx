import {ChevronRight} from "lucide-react";
import type {AuthUser} from "../../auth/authClient";
import {LanguageSelector} from "../LanguageSelector";

type Props = {
	user: AuthUser;
	displayName: string;
	onDisplayNameChange: (value: string) => void;
	language: string;
	onLanguageChange: (value: string) => void;
	onNext: () => void;
};

export function ProfileStep({
	user,
	displayName,
	onDisplayNameChange,
	language,
	onLanguageChange,
	onNext,
}: Props) {
	const canProceed = displayName.trim().length > 0 && language.trim().length > 0;

	return (
		<div className="flex flex-col gap-5 py-2">
			<div>
				<h2 className="font-sora text-[22px] font-bold text-[#1D1D1F] leading-tight">
					Welcome to Didactio
				</h2>
				<p className="mt-1 text-[14px] text-[#6E6E73]">
					Let&apos;s quickly set up your profile before you dive in.
				</p>
			</div>

			<div className="flex items-center gap-4 rounded-[12px] border border-black/[0.07] bg-white/60 px-4 py-3.5">
				<div className="flex shrink-0 flex-col items-center gap-1">
					{user.pictureUrl ?
						<img
							src={user.pictureUrl}
							alt="Profile"
							className="h-12 w-12 rounded-full object-cover ring-1 ring-black/[0.08]"
						/>
					:	<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D1D1F] text-white font-bold">
							{displayName.trim().charAt(0).toUpperCase() || "?"}
						</div>
					}
					<span className="text-[10px] text-[#AEAEB2]">Google photo</span>
				</div>

				<div className="flex flex-1 flex-col gap-1">
					<label
						htmlFor="display-name"
						className="text-[12px] font-semibold text-[#6E6E73]"
					>
						Display name
					</label>
					<input
						id="display-name"
						type="text"
						value={displayName}
						onChange={(e) => onDisplayNameChange(e.target.value)}
						className="w-full rounded-[10px] border border-black/[0.12] bg-white px-3.5 py-2 text-[14px] text-[#1D1D1F] outline-none transition placeholder:text-[#AEAEB2] focus:border-[#1D1D1F]/50"
						placeholder="Your display name"
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter" && canProceed) onNext();
						}}
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2.5 rounded-[12px] border border-black/[0.07] bg-white/60 px-4 py-3.5">
				<div>
					<p className="text-[13.5px] font-semibold text-[#1D1D1F]">Content language</p>
					<p className="mt-0.5 text-[12.5px] text-[#6E6E73]">
						All generated lessons and materials will be in this language.
					</p>
				</div>
				<LanguageSelector value={language} onChange={onLanguageChange} />
			</div>

			<div className="flex justify-end">
				<button
					type="button"
					onClick={onNext}
					disabled={!canProceed}
					className="flex items-center gap-1.5 rounded-[10px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3A3A3C] disabled:cursor-not-allowed disabled:opacity-40"
				>
					Continue
					<ChevronRight size={15} strokeWidth={2.5} />
				</button>
			</div>
		</div>
	);
}
