import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom'
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
import { DidacticUnitSetupModal } from './components/Setup/DidacticUnitSetupModal'
import { DidacticUnitSyllabusModal } from './components/Setup/DidacticUnitSyllabusModal'
import type { DashboardListItem, DashboardSection } from './types'

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
    const [expandedFolders, setExpandedFolders] = useState<string[]>(['general'])
    const [activeSection, setActiveSection] = useState<DashboardSection>('all-units')
    const [items, setItems] = useState<DashboardListItem[]>([])
    const [isLoadingIndex, setIsLoadingIndex] = useState(true)
    const [indexError, setIndexError] = useState<string | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [modalState, setModalState] = useState<
        | {
              isOpen: false
              didacticUnitId: null
              kind: null
          }
        | {
              isOpen: true
              didacticUnitId: string | null
              kind: 'setup' | 'syllabus'
          }
    >({
        isOpen: false,
        didacticUnitId: null,
        kind: null,
    })

    const isSyllabusStage = (nextAction: string) =>
        nextAction === 'generate_syllabus_prompt' ||
        nextAction === 'review_syllabus_prompt' ||
        nextAction === 'review_syllabus' ||
        nextAction === 'approve_syllabus'

    useEffect(() => {
        if (location.pathname !== '/dashboard' && activeSection !== 'all-units') {
            setActiveSection('all-units')
        }
    }, [activeSection, location.pathname])

    useEffect(() => {
        const loadDashboardIndex = async () => {
            setIsLoadingIndex(true)
            setIndexError(null)

            try {
                const didacticUnitResponse = await dashboardApi.listDidacticUnits()
                setItems(
                    mergeDashboardItems({
                        didacticUnits: didacticUnitResponse.didacticUnits,
                    })
                )
            } catch (loadError) {
                setIndexError(
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

    const folders = useMemo(() => buildDashboardFolders(items), [items])
    const filteredItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase()
        if (!normalizedQuery) {
            return items
        }

        return items.filter(
            (item) =>
                item.title.toLowerCase().includes(normalizedQuery) ||
                item.subtitle.toLowerCase().includes(normalizedQuery) ||
                item.subject.toLowerCase().includes(normalizedQuery)
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

    const openItem = async (itemId: string) => {
        const item = items.find((entry) => entry.id === itemId)
        if (!item) {
            return
        }

        setActiveSection('all-units')
        if (item.canOpenEditor) {
            navigate(`/dashboard/unit/${item.id}`)
            return
        }

        try {
            const detail = await dashboardApi.getDidacticUnit(item.id)
            setModalState({
                isOpen: true,
                didacticUnitId: item.id,
                kind: isSyllabusStage(detail.nextAction) ? 'syllabus' : 'setup',
            })
        } catch (loadError) {
            setIndexError(
                loadError instanceof Error ? loadError.message : 'Failed to open didactic unit.'
            )
        }
    }

    const openCreateView = () => {
        setActiveSection('all-units')
        setModalState({
            isOpen: true,
            didacticUnitId: null,
            kind: 'setup',
        })
    }

    const handleSetActiveSection: Dispatch<SetStateAction<DashboardSection>> = (value) => {
        const nextSection = typeof value === 'function' ? value(activeSection) : value
        setActiveSection(nextSection)
        navigate('/dashboard')
    }

    const indexView =
        activeSection === 'all-units' ? (
            <div className="flex min-w-0 flex-1 flex-col">
                {indexError && (
                    <div className="border-b border-red-200 bg-red-50 px-8 py-3 text-[13px] text-red-600">
                        {indexError}
                    </div>
                )}
                {isLoadingIndex && items.length === 0 ? (
                    <div className="flex min-w-0 flex-1 items-center justify-center bg-[#F5F5F7] text-[#86868B]">
                        Loading library...
                    </div>
                ) : (
                    <AllUnitsView
                        averageProgress={averageProgress}
                        filteredUnits={filteredItems}
                        folderCount={folders.length}
                        onCreateUnit={openCreateView}
                        onOpenItem={openItem}
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
                    element={<DidacticUnitRoute onDataChanged={refreshDashboard} />}
                />
                <Route path="*" element={<Navigate replace to="/dashboard" />} />
            </Routes>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
            <Sidebar
                activeSection={activeSection}
                expandedFolders={expandedFolders}
                folders={folders}
                isSidebarOpen={isSidebarOpen}
                items={items}
                onOpenItem={openItem}
                setActiveSection={handleSetActiveSection}
                toggleFolder={toggleFolder}
            />

            <Routes>
                <Route index element={indexView} />
                <Route path="*" element={<Navigate replace to="/dashboard" />} />
            </Routes>

            {modalState.isOpen && modalState.kind === 'setup' && (
                <DidacticUnitSetupModal
                    didacticUnitId={modalState.didacticUnitId}
                    onClose={() =>
                        setModalState({
                            isOpen: false,
                            didacticUnitId: null,
                            kind: null,
                        })
                    }
                    onDataChanged={refreshDashboard}
                    onOpenSyllabusReview={(didacticUnitId) => {
                        setModalState({
                            isOpen: true,
                            didacticUnitId,
                            kind: 'syllabus',
                        })
                        refreshDashboard()
                    }}
                />
            )}

            {modalState.isOpen && modalState.kind === 'syllabus' && modalState.didacticUnitId && (
                <DidacticUnitSyllabusModal
                    didacticUnitId={modalState.didacticUnitId}
                    onClose={() =>
                        setModalState({
                            isOpen: false,
                            didacticUnitId: null,
                            kind: null,
                        })
                    }
                    onDataChanged={refreshDashboard}
                    onOpenSetup={(didacticUnitId) => {
                        setModalState({
                            isOpen: true,
                            didacticUnitId,
                            kind: 'setup',
                        })
                    }}
                    onOpenEditor={(didacticUnitId) => {
                        setModalState({
                            isOpen: false,
                            didacticUnitId: null,
                            kind: null,
                        })
                        refreshDashboard()
                        navigate(`/dashboard/unit/${didacticUnitId}`)
                    }}
                />
            )}
        </div>
    )
}
