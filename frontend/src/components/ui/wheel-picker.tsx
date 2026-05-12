import {
	WheelPicker,
	WheelPickerWrapper,
	type WheelPickerOption,
	type WheelPickerValue,
} from "@ncdai/react-wheel-picker";
import "@ncdai/react-wheel-picker/style.css";

import {cn} from "../../lib/utils";

type DidactioWheelPickerProps<T extends WheelPickerValue> = {
	className?: string;
	optionItemHeight?: number;
	options: WheelPickerOption<T>[];
	value: T;
	visibleCount?: number;
	onValueChange: (value: T) => void;
};

export function DidactioWheelPicker<T extends WheelPickerValue>({
	className,
	optionItemHeight = 22,
	options,
	value,
	visibleCount = 8,
	onValueChange,
}: DidactioWheelPickerProps<T>) {
	const wheelAngle = 360 / visibleCount;
	const wheelRadius =
		optionItemHeight / Math.tan((wheelAngle * Math.PI) / 180);
	const wheelHeight = Math.round(wheelRadius * 2 + optionItemHeight * 0.25);

	return (
		<div className={cn("relative", className)}>
			<div style={{height: `${wheelHeight}px`}}>
				<WheelPickerWrapper className="h-full w-full">
					<WheelPicker
						options={options}
						value={value}
						onValueChange={onValueChange}
						infinite={false}
						visibleCount={visibleCount}
						optionItemHeight={optionItemHeight}
						dragSensitivity={1.1}
						scrollSensitivity={0.9}
						classNames={{
							optionItem:
								"text-[12px] font-medium tabular-nums text-[#8E8E93]",
							highlightWrapper: "rounded-full bg-white shadow-none",
							highlightItem:
								"text-[13px] font-medium tabular-nums text-[#1D1D1F]",
						}}
					/>
				</WheelPickerWrapper>
			</div>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-white/80 to-transparent"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-white/80 to-transparent"
			/>
		</div>
	);
}

export type {WheelPickerOption, WheelPickerValue};
