import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom'
import { toastError } from '@/hooks/use-toast'
import { dashboardApi } from './api/dashboardApi'
import { buildDashboardFolders, mergeDashboardItems } from './adapters'
import { AllUnitsView } from './components/Dashboard/AllUnitsView/AllUnitsView'
import { AnalyticsView } from './components/Dashboard/SettingsViews/AnalyticsView'
import { PreferencesView } from './components/Dashboard/SettingsViews/PreferencesView'
import { ProfileView } from './components/Dashboard/SettingsViews/ProfileView'
import { SecurityView } from './components/Dashboard/SettingsViews/SecurityView'
import { SubscriptionView } from './components/Dashboard/SettingsViews/SubscriptionView'
import { Sidebar } from './components/Dashboard/Sidebar/Sidebar'
import { UnitEditor } from './components/Editor/UnitEditor'
import { CreateUnitWizard } from './components/Setup/CreateUnitWizard'
import type { DashboardListItem, DashboardSection } from './types'
import type { BackendFolder } from './api/dashboardApi'

function renderSettingsView(section: DashboardSection) {
    switch (section) {
        case 'subscription':
            return <SubscriptionView />
        case 'profile':
            return <ProfileView />
        case 'security':
            return <SecurityView />
        case 'preferences':
            return <PreferencesView />
        case 'analytics':
            return <AnalyticsView />
        case 'all-units':
            return null
    }
}

function DidacticUnitRoute({ onDataChanged }: { onDataChanged: () => void }) {
    const params = useParams()

    if (!params.didacticUnitId) {
        return (
            <div className="flex min-w-0 flex-1 items-center justify-center text-[#86868B]">
                Didactic unit workspace unavailable.
            </div>
        )
    }

    return (
        <UnitEditor
            didacticUnitId={params.didacticUnitId}
            onDataChanged={onDataChanged}
        />
    )
}

export default function DashboardApp() {
    const navigate = useNavigate()
    const location = useLocation()
    const isDidacticUnitEditorRoute = /^\/dashboard\/unit\/[^/]+$/.test(location.pathname)
    const [isSidebarOpen] = useState(true)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<string[]>([])
    const [activeSection, setActiveSection] = useState<DashboardSection>('all-units')
    const [items, setItems] = useState<DashboardListItem[]>([])
    const [allFolders, setAllFolders] = useState<BackendFolder[]>([])
    const [isLoadingIndex, setIsLoadingIndex] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)
    const pendingEditorRefreshRef = useRef(false)
    const [modalState, setModalState] = useState<{
        isOpen: boolean
        didacticUnitId: string | null
    }>({
        isOpen: false,
        didacticUnitId: null,
    })

    useEffect(() => {
        if (location.pathname !== '/dashboard' && activeSection !== 'all-units') {
            setActiveSection('all-units')
        }
    }, [activeSection, location.pathname])

    useEffect(() => {
        const loadDashboardIndex = async () => {
            setIsLoadingIndex(true)

            try {
                const [didacticUnitResponse, folderResponse] = await Promise.all([
                    dashboardApi.listDidacticUnits(),
                    dashboardApi.listFolders(),
                ])
                setItems(
                    mergeDashboardItems({
                        didacticUnits: didacticUnitResponse.didacticUnits,
                    })
                )
                setAllFolders(folderResponse.folders)
            } catch (loadError) {
                toastError(
                    loadError instanceof Error
                        ? loadError.message
                        : 'Failed to load dashboard library.'
                )
            } finally {
                setIsLoadingIndex(false)
            }
        }

        void loadDashboardIndex()
    }, [refreshKey])

    const sidebarFolders = useMemo(
        () => buildDashboardFolders(allFolders, items),
        [allFolders, items]
    )
    const filteredItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase()
        if (!normalizedQuery) {
            return items
        }

        return items.filter(
            (item) =>
                item.title.toLowerCase().includes(normalizedQuery) ||
                item.subtitle.toLowerCase().includes(normalizedQuery) ||
                item.folder.name.toLowerCase().includes(normalizedQuery)
        )
    }, [items, searchQuery])
    const averageProgress = useMemo(() => {
        if (items.length === 0) {
            return 0
        }

        return Math.round(
            items.reduce((total, item) => total + item.primaryProgressPercent, 0) / items.length
        )
    }, [items])


    const toggleFolder = (folderId: string) => {
        setExpandedFolders((previous) =>
            previous.includes(folderId)
                ? previous.filter((id) => id !== folderId)
                : [...previous, folderId]
        )
    }

    const refreshDashboard = () => {
        setRefreshKey((previous) => previous + 1)
    }

    const refreshDashboardFromEditor = () => {
        pendingEditorRefreshRef.current = true

        if (!isDidacticUnitEditorRoute) {
            pendingEditorRefreshRef.current = false
            refreshDashboard()
        }
    }

    useEffect(() => {
        if (isDidacticUnitEditorRoute || !pendingEditorRefreshRef.current) {
            return
        }

        pendingEditorRefreshRef.current = false
        refreshDashboard()
    }, [isDidacticUnitEditorRoute])

    const createFolder = async (name: string, icon: string, color: string) => {
        await dashboardApi.createFolder({ name, icon, color })
        refreshDashboard()
    }

    const editFolder = async (folderId: string, name: string, icon: string, color: string) => {
        await dashboardApi.updateFolder(folderId, { name, icon, color })
        refreshDashboard()
    }

    const deleteFolder = async (folderId: string) => {
        try {
            await dashboardApi.deleteFolder(folderId)
            refreshDashboard()
        } catch (deleteError) {
            toastError(
                deleteError instanceof Error ? deleteError.message : 'Failed to remove folder.'
            )
        }
    }

    const openEditor = (itemId: string) => {
        setActiveSection('all-units')
        navigate(`/dashboard/unit/${itemId}`)
    }

    const openSetup = async (itemId: string) => {
        setActiveSection('all-units')
        setModalState({ isOpen: true, didacticUnitId: itemId })
    }

    const openItem = (itemId: string) => {
        const item = items.find((entry) => entry.id === itemId)
        if (!item) {
            return
        }

        if (item.canOpenEditor) {
            openEditor(itemId)
            return
        }

        openSetup(itemId)
    }

    const moveItemToFolder = async (itemId: string, folderId: string) => {
        try {
            await dashboardApi.updateDidacticUnitFolder(itemId, { mode: 'manual', folderId })
            refreshDashboard()
        } catch (moveError) {
            toastError(
                moveError instanceof Error ? moveError.message : 'Failed to move unit.'
            )
        }
    }

    const deleteItem = async (itemId: string) => {
        try {
            await dashboardApi.deleteDidacticUnit(itemId)
            refreshDashboard()
        } catch (deleteError) {
            toastError(
                deleteError instanceof Error ? deleteError.message : 'Failed to remove unit.'
            )
        }
    }

    const openCreateView = () => {
        setActiveSection('all-units')
        setModalState({ isOpen: true, didacticUnitId: null })
    }

    const handleSetActiveSection: Dispatch<SetStateAction<DashboardSection>> = (value) => {
        const nextSection = typeof value === 'function' ? value(activeSection) : value
        setActiveSection(nextSection)
        navigate('/dashboard')
    }

    const indexView =
        activeSection === 'all-units' ? (
            <div className="flex min-w-0 flex-1 flex-col">
                {isLoadingIndex && items.length === 0 ? (
                    <div className="flex min-w-0 flex-1 items-center justify-center bg-[#F5F5F7] text-[#86868B]">
                        Loading library...
                    </div>
                ) : (
                    <AllUnitsView
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
                )}
            </div>
        ) : (
            renderSettingsView(activeSection)
        )

    if (isDidacticUnitEditorRoute) {
        return (
            <Routes>
                <Route
                    path="unit/:didacticUnitId"
                    element={<DidacticUnitRoute onDataChanged={refreshDashboardFromEditor} />}
                />
                <Route path="*" element={<Navigate replace to="/dashboard" />} />
            </Routes>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
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

            <Routes>
                <Route index element={indexView} />
                <Route path="*" element={<Navigate replace to="/dashboard" />} />
            </Routes>

            {modalState.isOpen && (
                <CreateUnitWizard
                    didacticUnitId={modalState.didacticUnitId}
                    onClose={() => setModalState({ isOpen: false, didacticUnitId: null })}
                    onDataChanged={refreshDashboard}
                    onOpenEditor={(didacticUnitId) => {
                        setModalState({ isOpen: false, didacticUnitId: null })
                        refreshDashboard()
                        navigate(`/dashboard/unit/${didacticUnitId}`)
                    }}
                />
            )}
        </div>
    )
}
