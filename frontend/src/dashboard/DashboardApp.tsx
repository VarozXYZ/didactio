import { useState } from 'react'
import { getDetailedUnitById, isUnitEditable, mockFolders, mockUnits } from './data/dashboardMockData'
import { Sidebar } from './components/Dashboard/Sidebar/Sidebar'
import { AllUnitsView } from './components/Dashboard/AllUnitsView/AllUnitsView'
import { SubscriptionView } from './components/Dashboard/SettingsViews/SubscriptionView'
import { ProfileView } from './components/Dashboard/SettingsViews/ProfileView'
import { SecurityView } from './components/Dashboard/SettingsViews/SecurityView'
import { PreferencesView } from './components/Dashboard/SettingsViews/PreferencesView'
import { AnalyticsView } from './components/Dashboard/SettingsViews/AnalyticsView'
import { UnitEditor } from './components/Editor/UnitEditor'
import type { DashboardSection } from './types'

export default function DashboardApp() {
    const [isSidebarOpen] = useState(true)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<number[]>([])
    const [activeSection, setActiveSection] = useState<DashboardSection>('all-units')
    const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)

    const averageProgress = Math.round(
        mockUnits.reduce((total, unit) => total + unit.progress, 0) / mockUnits.length
    )

    const toggleFolder = (folderId: number) => {
        setExpandedFolders((previous) =>
            previous.includes(folderId)
                ? previous.filter((id) => id !== folderId)
                : [...previous, folderId]
        )
    }

    const filteredUnits = mockUnits.filter(
        (unit) =>
            unit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            unit.subject.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const selectedUnit = getDetailedUnitById(selectedUnitId)

    const openUnit = (unitId: number) => {
        if (!isUnitEditable(unitId)) {
            return
        }

        setActiveSection('all-units')
        setSelectedUnitId(unitId)
    }

    const closeEditor = () => {
        setSelectedUnitId(null)
    }

    if (selectedUnit) {
        return <UnitEditor onBack={closeEditor} unit={selectedUnit} />
    }

    return (
        <div className="flex min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
            <Sidebar
                activeSection={activeSection}
                expandedFolders={expandedFolders}
                folders={mockFolders}
                isSidebarOpen={isSidebarOpen}
                isUnitEditable={isUnitEditable}
                onOpenUnit={openUnit}
                setActiveSection={setActiveSection}
                toggleFolder={toggleFolder}
                units={mockUnits}
            />
            {activeSection === 'all-units' && (
                <AllUnitsView
                    averageProgress={averageProgress}
                    filteredUnits={filteredUnits}
                    folderCount={mockFolders.length}
                    isUnitEditable={isUnitEditable}
                    onOpenUnit={openUnit}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    setViewMode={setViewMode}
                    totalUnits={mockUnits.length}
                    viewMode={viewMode}
                />
            )}
            {activeSection === 'subscription' && <SubscriptionView />}
            {activeSection === 'profile' && <ProfileView />}
            {activeSection === 'security' && <SecurityView />}
            {activeSection === 'preferences' && <PreferencesView />}
            {activeSection === 'analytics' && <AnalyticsView />}
        </div>
    )
}
