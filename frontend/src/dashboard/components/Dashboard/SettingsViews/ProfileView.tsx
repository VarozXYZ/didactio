import {useState} from "react";
import {useAuth} from "../../../../auth/AuthProvider";

export function ProfileView() {
	const {user} = useAuth();
	const [pictureFailed, setPictureFailed] = useState(false);
	const initials =
		user?.displayName
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() ?? "DU";

	return (
		<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
			<header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Profile Settings
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Manage your account information
					</p>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-8">
				<div className="mx-auto max-w-[740px] space-y-6">
					<div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
						<h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
							Profile Photo
						</h2>
						<div className="flex items-center gap-6">
							{user?.pictureUrl && !pictureFailed ?
								<img
									src={user.pictureUrl}
									alt={user.displayName}
									referrerPolicy="no-referrer"
									onError={() => setPictureFailed(true)}
									className="h-24 w-24 rounded-full object-cover"
								/>
							:	<div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] to-[#2D8F4B] text-3xl font-bold text-white">
									{initials}
								</div>
							}
							<p className="text-[13px] text-[#86868B]">
								Your Google profile photo is used automatically
								for now.
							</p>
						</div>
					</div>

					<div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
						<h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
							Basic Information
						</h2>
						<div className="space-y-4">
							<div>
								<label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
									Full Name
								</label>
								<div className="w-full rounded-[8px] border border-[#E5E5E7] bg-[#F5F5F7] px-4 py-3 text-[14px] text-[#1D1D1F]">
									{user?.displayName ?? "Unknown user"}
								</div>
							</div>
							<div>
								<label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
									Email Address
								</label>
								<div className="w-full rounded-[8px] border border-[#E5E5E7] bg-[#F5F5F7] px-4 py-3 text-[14px] text-[#1D1D1F]">
									{user?.email ?? "No email available"}
								</div>
							</div>
							<div>
								<label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
									Locale
								</label>
								<div className="w-full rounded-[8px] border border-[#E5E5E7] bg-[#F5F5F7] px-4 py-3 text-[14px] text-[#1D1D1F]">
									{user?.locale ?? "Not provided by Google"}
								</div>
							</div>
							<div className="rounded-[8px] border border-[#E5E5E7] bg-[#F5F5F7] px-4 py-3 text-[14px] text-[#1D1D1F]">
								<div className="font-semibold">Account Role</div>
								<div className="mt-1 text-[#86868B]">
									{user?.role === "admin" ? "Admin" : "User"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
