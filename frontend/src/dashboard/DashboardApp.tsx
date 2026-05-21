import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";
import {toastError} from "@/hooks/use-toast";
import {dashboardApi} from "./api/dashboardApi";
import {buildDashboardFolders, mergeDashboardItems} from "./adapters";
import {AllUnitsView} from "./components/Dashboard/AllUnitsView/AllUnitsView";
import {CreateUnitButton} from "./components/Dashboard/AllUnitsView/AllUnitsHeader";
import {AnalyticsView} from "./components/Dashboard/SettingsViews/AnalyticsView";
import {PreferencesView} from "./components/Dashboard/SettingsViews/PreferencesView";
import {ProfileView} from "./components/Dashboard/SettingsViews/ProfileView";
import {SubscriptionView} from "./components/Dashboard/SettingsViews/SubscriptionView";
import {Sidebar} from "./components/Dashboard/Sidebar/Sidebar";
import {MobileBottomNav} from "./components/Dashboard/Mobile/MobileBottomNav";
import {MobileDashboardView} from "./components/Dashboard/Mobile/MobileDashboardView";
import {UnitEditor} from "./components/Editor/UnitEditor";
import {CreateUnitWizard} from "./components/Setup/CreateUnitWizard";
import {useMediaQuery} from "./hooks/useMediaQuery";
import type {DashboardListItem, DashboardSection} from "./types";
import type {BackendFolder} from "./api/dashboardApi";

function renderSettingsView(section: DashboardSection) {
	switch (section) {
		case "subscription":
			return <SubscriptionView />;
		case "profile-security":
			return <ProfileView />;
		case "preferences":
			return <PreferencesView />;
		case "analytics":
			return <AnalyticsView />;
		case "all-units":
			return null;
	}
}

function isDashboardSection(value: string | null): value is DashboardSection {
	return (
		value === "all-units" ||
		value === "subscription" ||
		value === "profile-security" ||
		value === "preferences" ||
		value === "analytics"
	);
}

function normalizeDashboardSection(value: string | null): DashboardSection | null {
	if (value === "profile" || value === "security") {
		return "profile-security";
	}

	return isDashboardSection(value) ? value : null;
}

function DidacticUnitRoute({onDataChanged}: {onDataChanged: () => void}) {
	const params = useParams();

	if (!params.didacticUnitId) {
		return (
			<div className="flex min-w-0 flex-1 items-center justify-center text-[#86868B]">
				Didactic unit workspace unavailable.
			</div>
		);
	}

	return (
		<UnitEditor
			didacticUnitId={params.didacticUnitId}
			onDataChanged={onDataChanged}
		/>
	);
}

export default function DashboardApp() {
	const navigate = useNavigate();
	const location = useLocation();
	const isMobileViewport = useMediaQuery("(max-width: 767px)");
	const isDidacticUnitEditorRoute = /^\/dashboard\/unit\/[^/]+$/.test(
		location.pathname,
	);
	const [isSidebarOpen] = useState(true);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
	const [activeSection, setActiveSection] =
		useState<DashboardSection>("all-units");
	const [items, setItems] = useState<DashboardListItem[]>([]);
	const [allFolders, setAllFolders] = useState<BackendFolder[]>([]);
	const [isLoadingIndex, setIsLoadingIndex] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);
	const pendingEditorRefreshRef = useRef(false);
	const [modalState, setModalState] = useState<{
		isOpen: boolean;
		didacticUnitId: string | null;
	}>({
		isOpen: false,
		didacticUnitId: null,
	});

	useLayoutEffect(() => {
		if (
			location.pathname !== "/dashboard" &&
			activeSection !== "all-units"
		) {
			setActiveSection("all-units");
		}
	}, [activeSection, location.pathname]);

	useLayoutEffect(() => {
		if (location.pathname !== "/dashboard") {
			return;
		}

		const section = normalizeDashboardSection(
			new URLSearchParams(location.search).get("section"),
		);
		const nextSection = section ?? "all-units";
		if (nextSection !== activeSection) {
			setActiveSection(nextSection);
		}
	}, [activeSection, location.pathname, location.search]);

	useEffect(() => {
		const loadDashboardIndex = async () => {
			setIsLoadingIndex(true);

			try {
				const [didacticUnitResponse, folderResponse] =
					await Promise.all([
						dashboardApi.listDidacticUnits(),
						dashboardApi.listFolders(),
					]);
				setItems(
					mergeDashboardItems({
						didacticUnits: didacticUnitResponse.didacticUnits,
					}),
				);
				setAllFolders(folderResponse.folders);
			} catch (loadError) {
				toastError(
					loadError instanceof Error ?
						loadError.message
					:	"Failed to load dashboard library.",
				);
			} finally {
				setIsLoadingIndex(false);
			}
		};

		void loadDashboardIndex();
	}, [refreshKey]);

	const sidebarFolders = useMemo(
		() => buildDashboardFolders(allFolders, items),
		[allFolders, items],
	);
	const filteredItems = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		if (!normalizedQuery) {
			return items;
		}

		return items.filter(
			(item) =>
				item.title.toLowerCase().includes(normalizedQuery) ||
				item.subtitle.toLowerCase().includes(normalizedQuery) ||
				item.folder.name.toLowerCase().includes(normalizedQuery),
		);
	}, [items, searchQuery]);
	const averageProgress = useMemo(() => {
		if (items.length === 0) {
			return 0;
		}

		return Math.round(
			items.reduce(
				(total, item) => total + item.primaryProgressPercent,
				0,
			) / items.length,
		);
	}, [items]);

	const toggleFolder = (folderId: string) => {
		setExpandedFolders((previous) =>
			previous.includes(folderId) ?
				previous.filter((id) => id !== folderId)
			:	[...previous, folderId],
		);
	};

	const refreshDashboard = () => {
		setRefreshKey((previous) => previous + 1);
	};

	const refreshDashboardFromEditor = () => {
		pendingEditorRefreshRef.current = true;

		if (!isDidacticUnitEditorRoute) {
			pendingEditorRefreshRef.current = false;
			refreshDashboard();
		}
	};

	useEffect(() => {
		if (isDidacticUnitEditorRoute || !pendingEditorRefreshRef.current) {
			return;
		}

		pendingEditorRefreshRef.current = false;
		refreshDashboard();
	}, [isDidacticUnitEditorRoute]);

	const createFolder = async (name: string, icon: string, color: string) => {
		await dashboardApi.createFolder({name, icon, color});
		refreshDashboard();
	};

	const editFolder = async (
		folderId: string,
		name: string,
		icon: string,
		color: string,
	) => {
		await dashboardApi.updateFolder(folderId, {name, icon, color});
		refreshDashboard();
	};

	const deleteFolder = async (folderId: string) => {
		try {
			await dashboardApi.deleteFolder(folderId);
			refreshDashboard();
		} catch (deleteError) {
			toastError(
				deleteError instanceof Error ?
					deleteError.message
				:	"Failed to remove folder.",
			);
		}
	};

	const openEditor = (itemId: string) => {
		setActiveSection("all-units");
		navigate(`/dashboard/unit/${itemId}`);
	};

	const openSetup = async (itemId: string) => {
		setActiveSection("all-units");
		setModalState({isOpen: true, didacticUnitId: itemId});
	};

	const openItem = (itemId: string) => {
		const item = items.find((entry) => entry.id === itemId);
		if (!item) {
			return;
		}

		if (item.canOpenEditor) {
			openEditor(itemId);
			return;
		}

		openSetup(itemId);
	};

	const moveItemToFolder = async (itemId: string, folderId: string) => {
		try {
			await dashboardApi.updateDidacticUnitFolder(itemId, {
				mode: "manual",
				folderId,
			});
			refreshDashboard();
		} catch (moveError) {
			toastError(
				moveError instanceof Error ?
					moveError.message
				:	"Failed to move unit.",
			);
		}
	};

	const deleteItem = async (itemId: string) => {
		try {
			await dashboardApi.deleteDidacticUnit(itemId);
			refreshDashboard();
		} catch (deleteError) {
			toastError(
				deleteError instanceof Error ?
					deleteError.message
				:	"Failed to remove unit.",
			);
		}
	};

	const openCreateView = () => {
		setActiveSection("all-units");
		setModalState({isOpen: true, didacticUnitId: null});
	};

	const handleSetActiveSection: Dispatch<SetStateAction<DashboardSection>> = (
		value,
	) => {
		const nextSection =
			typeof value === "function" ? value(activeSection) : value;
		setActiveSection(nextSection);
		navigate(
			nextSection === "all-units" ?
				"/dashboard"
			:	`/dashboard?section=${nextSection}`,
		);
	};

	const indexView =
		activeSection === "all-units" ?
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{isLoadingIndex && items.length === 0 ?
					<div className="flex min-w-0 flex-1 items-center justify-center bg-[#F5F5F7] text-[#86868B]">
						Loading library...
					</div>
				:	<AllUnitsView
						averageProgress={averageProgress}
						allFolders={allFolders}
						filteredUnits={filteredItems}
						folderCount={allFolders.length}
						onCreateUnit={openCreateView}
						onDeleteItem={deleteItem}
						onMoveToFolder={moveItemToFolder}
						onOpenEditor={openEditor}
						onOpenItem={openItem}
						onOpenSetup={openSetup}
						searchQuery={searchQuery}
						setSearchQuery={setSearchQuery}
						setViewMode={setViewMode}
						totalUnits={items.length}
						viewMode={viewMode}
					/>
				}
			</div>
		:	<div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
			{renderSettingsView(activeSection)}
			<div className="absolute right-8 top-4">
				<CreateUnitButton onClick={openCreateView} />
			</div>
		</div>;

	if (isDidacticUnitEditorRoute) {
		return (
			<Routes>
				<Route
					path="unit/:didacticUnitId"
					element={
						<DidacticUnitRoute
							onDataChanged={refreshDashboardFromEditor}
						/>
					}
				/>
				<Route
					path="*"
					element={<Navigate replace to="/dashboard" />}
				/>
			</Routes>
		);
	}

	if (isMobileViewport && location.pathname === "/dashboard") {
		const mobileContent =
			activeSection === "all-units" ?
				isLoadingIndex && items.length === 0 ?
					<div className="flex min-h-screen items-center justify-center bg-[#F7F7F8] pb-24 text-[15px] font-medium text-[#8E8E93] md:hidden">
						Loading library...
					</div>
				:	<MobileDashboardView
						allFolders={allFolders}
						filteredUnits={filteredItems}
						onCreateFolder={createFolder}
						onCreateUnit={openCreateView}
						onDeleteItem={deleteItem}
						onDeleteFolder={deleteFolder}
						onEditFolder={editFolder}
						onMoveToFolder={moveItemToFolder}
						onOpenEditor={openEditor}
						onOpenItem={openItem}
						onOpenSetup={openSetup}
						searchQuery={searchQuery}
						setSearchQuery={setSearchQuery}
					/>
			:	<div className="min-h-screen bg-[#F7F7F8] pb-[calc(env(safe-area-inset-bottom)+92px)] text-[#1D1D1F] md:hidden">
					<header className="sticky top-0 z-20 border-b border-[#E5E5E7] bg-white/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl">
						<div className="mx-auto flex w-full max-w-[min(100%,900px)] items-center justify-between gap-4">
							<img
								src="/assets/logos/logo-horizontal.png"
								alt="Didactio"
								className="h-10 min-w-0 max-w-[150px] object-contain"
							/>
							<CreateUnitButton onClick={openCreateView} />
						</div>
					</header>
					<div className="min-h-0 overflow-x-hidden">
						{renderSettingsView(activeSection)}
					</div>
				</div>;

		return (
			<>
				<Routes>
					<Route index element={mobileContent} />
					<Route
						path="*"
						element={<Navigate replace to="/dashboard" />}
					/>
				</Routes>

				<MobileBottomNav
					activeSection={activeSection}
					onSelectSection={handleSetActiveSection}
				/>

				{modalState.isOpen && (
					<CreateUnitWizard
						didacticUnitId={modalState.didacticUnitId}
						onClose={() =>
							setModalState({
								isOpen: false,
								didacticUnitId: null,
							})
						}
						onDataChanged={refreshDashboard}
						onOpenEditor={(didacticUnitId) => {
							setModalState({
								isOpen: false,
								didacticUnitId: null,
							});
							refreshDashboard();
							navigate(`/dashboard/unit/${didacticUnitId}`);
						}}
					/>
				)}
			</>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden bg-[#F5F5F7] font-sans text-[#1D1D1F]">
			<Sidebar
				activeSection={activeSection}
				allFolders={allFolders}
				expandedFolders={expandedFolders}
				folders={sidebarFolders}
				isSidebarOpen={isSidebarOpen}
				items={items}
				onCreateFolder={createFolder}
				onEditFolder={editFolder}
				onDeleteFolder={deleteFolder}
				onDeleteItem={deleteItem}
				onMoveToFolder={moveItemToFolder}
				onOpenEditor={openEditor}
				onOpenItem={openItem}
				onOpenSetup={openSetup}
				setActiveSection={handleSetActiveSection}
				toggleFolder={toggleFolder}
			/>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				<Routes>
					<Route index element={indexView} />
					<Route
						path="*"
						element={<Navigate replace to="/dashboard" />}
					/>
				</Routes>
			</div>

			{modalState.isOpen && (
				<CreateUnitWizard
					didacticUnitId={modalState.didacticUnitId}
					onClose={() =>
						setModalState({isOpen: false, didacticUnitId: null})
					}
					onDataChanged={refreshDashboard}
					onOpenEditor={(didacticUnitId) => {
						setModalState({isOpen: false, didacticUnitId: null});
						refreshDashboard();
						navigate(`/dashboard/unit/${didacticUnitId}`);
					}}
				/>
			)}
		</div>
	);
}
